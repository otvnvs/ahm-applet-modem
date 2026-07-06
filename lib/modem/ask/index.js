// ./lib/modem/ask/index.js
import { registerModem } from '../registry.js';

const ASK_MODEM_CONFIG = {
  name: 'Amplitude Shift Keying (ASK)',
  
  // Custom Controls Dashboard Specification Schema
  controls: [
    { key: 'baudRate', label: 'Baud Rate (bps)', type: 'numeric', render: 'slider', min: 10, max: 200, step: 10, default: 50 },
    { key: 'carrierFreq', label: 'Carrier Frequency (Hz)', type: 'numeric', render: 'slider', min: 800, max: 4000, default: 1500 },
    { key: 'amplitudeHigh', label: 'Mark Volume (1)', type: 'numeric', render: 'slider', min: 0.1, max: 1.0, step: 0.1, default: 0.8 },
    {
      key: 'operatingMode',
      label: 'Operating Loopback Mode',
      type: 'select',
      render: 'dropdown',
      options: [
        { label: 'Local Loopback (Single Device Test)', value: 'loopback' },
        { label: 'Acoustic Network (Two Phones Peer-to-Peer)', value: 'p2p' }
      ],
      default: 'loopback'
    }
  ],

  // Custom Live Diagnostics Feedback Schema
  feedbackMetadata: [
    { key: 'carrierLock', label: 'Signal Locked', render: 'badge' },
    { key: 'liveAmplitude', label: 'Incoming Amplitude', render: 'progress', min: 0, max: 100 },
    { key: 'ambientThreshold', label: 'Squelch/Noise Floor', render: 'text', suffix: ' %' },
    { key: 'charsDecoded', label: 'Chars Received', render: 'text' }
  ],

  /**
   * BURST MODE TRANSMITTER
   */
  async transmit(text, ctx, runtimeSettings, localBypassNode = null) {
    if (!text) return;
    const { baudRate, carrierFreq, amplitudeHigh, operatingMode } = runtimeSettings;
    
    // 🌟 FIX: Populated the alternating preamble synchronization bits (0xAA)
    const preambleBits = [1, 0, 1, 0, 1, 0, 1, 0,]; 
    const dataBits = stringToBits(text);
    const bits = [...preambleBits, ...dataBits];
    
    const now = ctx.currentTime;
    const bitDuration = 1 / baudRate;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(carrierFreq, now);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (operatingMode === 'loopback' && localBypassNode) {
      gainNode.connect(localBypassNode);
    }

    let bitTime = now;
    bits.forEach((bit) => {
      const targetVolume = bit === 1 ? amplitudeHigh : 0.0;
      gainNode.gain.setValueAtTime(targetVolume, bitTime);
      bitTime += bitDuration;
    });

    gainNode.gain.setValueAtTime(0, bitTime);
    osc.start(now);
    osc.stop(bitTime + 0.02);

    return new Promise(resolve => setTimeout(resolve, (bitTime - now + 0.05) * 1000));
  },

  /**
   * CONTINUOUS STREAMING GENERATOR
   */
  startStream(text, ctx, settingsRef, localBypassNode = null) {
    if (!text) return null;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (settingsRef.operatingMode === 'loopback' && localBypassNode) {
      gainNode.connect(localBypassNode);
    }

    // 🌟 FIX: Populated the alternating continuous stream preamble bits
    const preambleBits =[1, 0, 1, 0, 1, 0, 1, 0,];
    const dataBits = stringToBits(text);
    const bits = [...preambleBits, ...dataBits];
    
    let currentBitIndex = 0;
    let nextBitScheduleTime = ctx.currentTime + 0.02;
    const lookAheadWindow = 0.1;
    const scheduleIntervalTime = 30;

    const streamingInterval = setInterval(() => {
      const bitDuration = 1 / (settingsRef.baudRate || 50);
      osc.frequency.setValueAtTime(settingsRef.carrierFreq || 1500, ctx.currentTime);

      while (nextBitScheduleTime < ctx.currentTime + lookAheadWindow) {
        const bit = bits[currentBitIndex];
        const targetVolume = bit === 1 ? (settingsRef.amplitudeHigh || 0.8) : 0.0;
        
        gainNode.gain.setValueAtTime(targetVolume, nextBitScheduleTime);
        
        nextBitScheduleTime += bitDuration;
        currentBitIndex = (currentBitIndex + 1) % bits.length;
      }
    }, scheduleIntervalTime);

    osc.start(ctx.currentTime);

    return {
      stop() {
        clearInterval(streamingInterval);
        try {
          osc.stop(ctx.currentTime);
        } catch (e) { osc.disconnect(); }
      }
    };
  },

  /**
   * RECEIVER DECODER MODULE (Amplitude Envelope Demodulation)
   */
  initReceiver(ctx, analyserNode, runtimeSettings, onDataDecoded, onFeedbackUpdated) {
    const { baudRate } = runtimeSettings;
    const bufferLength = analyserNode.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    
    let bitBuffer = [];
    let isSynchronized = false;
    let syncShiftRegister = 0;
    let totalCharsRx = 0;

    const liveMetrics = {
      carrierLock: 'SEARCHING',
      liveAmplitude: 0,
      ambientThreshold: '15',
      charsDecoded: 0
    };

    const samplingInterval = setInterval(() => {
      analyserNode.getByteTimeDomainData(dataArray);
      
      let peakAmp = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const sampleDistance = Math.abs(dataArray[i] - 128);
        if (sampleDistance > peakAmp) peakAmp = sampleDistance;
      }

      const computedAmpPct = Math.min(100, Math.round((peakAmp / 128) * 100));
      liveMetrics.liveAmplitude = computedAmpPct;

      let currentBit = computedAmpPct > 15 ? 1 : 0;

      syncShiftRegister = ((syncShiftRegister << 1) | currentBit) & 0xFF;
      
      if (!isSynchronized && syncShiftRegister === 0xAA) {
        isSynchronized = true;
        liveMetrics.carrierLock = 'LOCKED';
        bitBuffer = [];
      }

      if (isSynchronized) {
        bitBuffer.push(currentBit);
        if (bitBuffer.length === 8) {
          const decodedChar = bitsToString(bitBuffer);
          if (decodedChar) {
            onDataDecoded(decodedChar);
            totalCharsRx++;
            liveMetrics.charsDecoded = totalCharsRx;
          }
          bitBuffer = [];
          isSynchronized = false; 
          liveMetrics.carrierLock = 'SEARCHING';
        }
      }

      onFeedbackUpdated({ ...liveMetrics });
    }, (1000 / baudRate) / 2);

    return { kill() { clearInterval(samplingInterval); } };
  }
};

function stringToBits(str) {
  const bits = [];
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    for (let bit = 7; bit >= 0; bit--) bits.push((charCode >> bit) & 1);
  }
  return bits;
}

function bitsToString(bits) {
  let charCode = 0;
  for (let bit = 0; bit < 8; bit++) charCode = (charCode << 1) | bits[bit];
  return charCode > 0 && charCode < 127 ? String.fromCharCode(charCode) : '';
}

registerModem('ask_standard', ASK_MODEM_CONFIG);


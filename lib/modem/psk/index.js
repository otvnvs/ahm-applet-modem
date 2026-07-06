// ./lib/modem/psk/index.js
import { registerModem } from '../registry.js';

const PSK_MODEM_CONFIG = {
  name: 'Phase Shift Keying (PSK)',
  
  // Custom Controls Schema for Phase Modulation
  controls: [
    { key: 'baudRate', label: 'Baud Rate (bps)', type: 'numeric', render: 'slider', min: 10, max: 200, step: 10, default: 50 },
    { key: 'carrierFreq', label: 'Phase Center Freq (Hz)', type: 'numeric', render: 'slider', min: 1000, max: 4000, default: 1800 },
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

  // Specialized Phase Tracking Feedback UI Schema Specs
  feedbackMetadata: [
    { key: 'phaseLock', label: 'Phase Sync Lock', render: 'badge' },
    { key: 'phaseOffset', label: 'Phase Shift Angle', render: 'text', suffix: ' °' },
    { key: 'signalStrength', label: 'Coherent Energy', render: 'progress', min: 0, max: 100 },
    { key: 'wordsDecoded', label: 'Total Words Rx', render: 'text' }
  ],

  /**
   * BURST MODE TRANSMITTER
   */
  async transmit(text, ctx, runtimeSettings, localBypassNode = null) {
    if (!text) return;
    const { baudRate, carrierFreq, operatingMode } = runtimeSettings;
    
    const preambleBits =[1, 0, 1, 0, 1, 0, 1, 0,]; // 8-bit Phase Training Pattern
    const dataBits = stringToBits(text);
    const bits = [...preambleBits, ...dataBits];
    
    const now = ctx.currentTime;
    const bitDuration = 1 / baudRate;

    // Use a custom oscillator or schedule phase properties natively
    // Note: Web Audio API OscillatorNode does not allow scheduling phase properties directly,
    // so we alternate the output gain coefficient values (1 vs -1) to simulate precise 180-degree inversions.
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(carrierFreq, now);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (operatingMode === 'loopback' && localBypassNode) {
      gainNode.connect(localBypassNode);
    }

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.5, now + 0.01);

    let bitTime = now + 0.01;
    bits.forEach((bit) => {
      // 🌟 PSK Modulation Rule: Flip the polarity (0.5 for 0°, -0.5 for 180°)
      const polarity = bit === 1 ? 0.5 : -0.5;
      gainNode.gain.setValueAtTime(polarity, bitTime);
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

    const preambleBits =[1, 0, 1, 0, 1, 0, 1, 0,];
    const dataBits = stringToBits(text);
    const bits = [...preambleBits, ...dataBits];
    
    let currentBitIndex = 0;
    let nextBitScheduleTime = ctx.currentTime + 0.02;
    const lookAheadWindow = 0.1;
    const scheduleIntervalTime = 30;

    const streamingInterval = setInterval(() => {
      const bitDuration = 1 / (settingsRef.baudRate || 50);
      osc.frequency.setValueAtTime(settingsRef.carrierFreq || 1800, ctx.currentTime);

      while (nextBitScheduleTime < ctx.currentTime + lookAheadWindow) {
        const bit = bits[currentBitIndex];
        const polarity = bit === 1 ? 0.5 : -0.5;
        
        gainNode.gain.setValueAtTime(polarity, nextBitScheduleTime);
        
        nextBitScheduleTime += bitDuration;
        currentBitIndex = (currentBitIndex + 1) % bits.length;
      }
    }, scheduleIntervalTime);

    osc.start(ctx.currentTime);

    return {
      stop() {
        clearInterval(streamingInterval);
        try { osc.stop(ctx.currentTime); } catch (e) { osc.disconnect(); }
      }
    };
  },

  /**
   * RECEIVER DECODER MODULE (Differential Coherent Phase Demodulation)
   */
  initReceiver(ctx, analyserNode, runtimeSettings, onDataDecoded, onFeedbackUpdated) {
    const { baudRate } = runtimeSettings;
    const bufferLength = analyserNode.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    
    let bitBuffer = [];
    let isSynchronized = false;
    let syncShiftRegister = 0;
    let wordCount = 0;
    let lastSamplePolarity = 1;

    const liveMetrics = {
      phaseLock: 'SEARCHING',
      phaseOffset: '0',
      signalStrength: 0,
      wordsDecoded: 0
    };

    const samplingInterval = setInterval(() => {
      analyserNode.getByteTimeDomainData(dataArray);
      
      // Calculate zero-crossings to measure phase shift transitions
      let peakAmp = 0;
      let firstCrossingIndex = -1;
      
      for (let i = 1; i < dataArray.length; i++) {
        const amp = Math.abs(dataArray[i] - 128);
        if (amp > peakAmp) peakAmp = amp;
        
        if (firstCrossingIndex === -1 && 
           ((dataArray[i - 1] < 128 && dataArray[i] >= 128) || (dataArray[i - 1] > 128 && dataArray[i] <= 128))) {
          firstCrossingIndex = i;
        }
      }

      liveMetrics.signalStrength = Math.min(100, Math.round((peakAmp / 128) * 100));

      // 🌟 PSK Demodulation Rule: Track relative shifting offsets 
      // If the wave crossing position suddenly shifts by half a wavelength, a phase flip occurred.
      let currentSamplePolarity = (firstCrossingIndex % 2 === 0) ? 1 : -1;
      let currentBit = (currentSamplePolarity === lastSamplePolarity) ? 1 : 0;
      
      liveMetrics.phaseOffset = currentBit === 1 ? '0' : '180';
      lastSamplePolarity = currentSamplePolarity;

      syncShiftRegister = ((syncShiftRegister << 1) | currentBit) & 0xFF;
      
      if (!isSynchronized && syncShiftRegister === 0xAA) {
        isSynchronized = true;
        liveMetrics.phaseLock = 'LOCKED';
        bitBuffer = [];
      }

      if (isSynchronized) {
        bitBuffer.push(currentBit);
        if (bitBuffer.length === 8) {
          const decodedChar = bitsToString(bitBuffer);
          if (decodedChar) {
            onDataDecoded(decodedChar);
            if (decodedChar === ' ') {
              wordCount++;
              liveMetrics.wordsDecoded = wordCount;
            }
          }
          bitBuffer = [];
          isSynchronized = false;
          liveMetrics.phaseLock = 'SEARCHING';
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

registerModem('psk_standard', PSK_MODEM_CONFIG);


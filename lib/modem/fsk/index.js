// ./lib/modem/fsk/index.js
import { registerModem } from '../registry.js';

const FSK_MODEM_CONFIG = {
  name: 'Frequency Shift Keying (FSK)',
  
  controls: [
    { key: 'baudRate', label: 'Baud Rate (bps)', type: 'numeric', render: 'slider', min: 10, max: 300, step: 10, default: 100 },
    { key: 'markFreq', label: 'Mark Frequency (1)', type: 'numeric', render: 'slider', min: 1000, max: 5000, default: 2200 },
    { key: 'spaceFreq', label: 'Space Frequency (0)', type: 'numeric', render: 'slider', min: 1000, max: 5000, default: 1200 },
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

  feedbackMetadata: [
    { key: 'syncStatus', label: 'Carrier Lock', render: 'badge' }, 
    { key: 'signalQuality', label: 'Signal Quality', render: 'progress', min: 0, max: 100 },
    { key: 'freqDetected', label: 'Tracked Frequency', render: 'text', suffix: ' Hz' },
    { key: 'bitsDecoded', label: 'Total Bits Rx', render: 'text' }
  ],

  /**
   * STANDARD BURST TRANSMISSION WITH PREAMBLE SYNC
   */
  async transmit(text, ctx, runtimeSettings, localBypassNode = null) {
    if (!text) return;
    const { baudRate, markFreq, spaceFreq, operatingMode } = runtimeSettings;
    
    // 🌟 FIX: Populated the alternating preamble synchronization bits (0xAA)
    const preambleBits = [1, 0, 1, 0, 1, 0, 1, 0];
    const dataBits = stringToBits(text);
    const bits = [...preambleBits, ...dataBits];
    
    const now = ctx.currentTime;
    const bitDuration = 1 / baudRate;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (operatingMode === 'loopback' && localBypassNode) {
      gainNode.connect(localBypassNode);
    }

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.5, now + 0.02);

    let bitTime = now + 0.02;
    bits.forEach((bit) => {
      osc.frequency.setValueAtTime(bit === 1 ? markFreq : spaceFreq, bitTime);
      bitTime += bitDuration;
    });

    gainNode.gain.setValueAtTime(0.5, bitTime);
    gainNode.gain.linearRampToValueAtTime(0, bitTime + 0.02);
    osc.start(now);
    osc.stop(bitTime + 0.03);

    return new Promise(resolve => setTimeout(resolve, (bitTime - now + 0.05) * 1000));
  },

  /**
   * SEAMLESS AUDIO STREAM GENERATOR WITH CONTINUOUS PREAMBLE INJECTIONS
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

    const startWindow = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, startWindow);
    gainNode.gain.linearRampToValueAtTime(0.5, startWindow + 0.05);

    // 🌟 FIX: Populated the alternating loop preamble bits
    const preambleBits = [1, 0, 1, 0, 1, 0, 1, 0];
    const dataBits = stringToBits(text);
    const bits = [...preambleBits, ...dataBits];
    
    let currentBitIndex = 0;
    let nextBitScheduleTime = ctx.currentTime + 0.05; 
    const lookAheadWindow = 0.1;
    const scheduleIntervalTime = 30;

    const streamingInterval = setInterval(() => {
      const bitDuration = 1 / (settingsRef.baudRate || 100);
      while (nextBitScheduleTime < ctx.currentTime + lookAheadWindow) {
        const bit = bits[currentBitIndex];
        osc.frequency.setValueAtTime(bit === 1 ? (settingsRef.markFreq || 2200) : (settingsRef.spaceFreq || 1200), nextBitScheduleTime);
        nextBitScheduleTime += bitDuration;
        currentBitIndex = (currentBitIndex + 1) % bits.length;
      }
    }, scheduleIntervalTime);

    osc.start(startWindow);

    return {
      stop() {
        clearInterval(streamingInterval);
        try {
          const stopTime = ctx.currentTime;
          gainNode.gain.setValueAtTime(gainNode.gain.value, stopTime);
          gainNode.gain.linearRampToValueAtTime(0, stopTime + 0.05);
          osc.stop(stopTime + 0.06);
        } catch (e) { osc.disconnect(); }
      }
    };
  },

  /**
   * RECEIVER MODULE: Detects preamble sync boundaries and emits live metrics
   */
  initReceiver(ctx, analyserNode, runtimeSettings, onDataDecoded, onFeedbackUpdated) {
    const { baudRate, markFreq, spaceFreq } = runtimeSettings;
    const bufferLength = analyserNode.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    
    let bitBuffer = [];
    let isSynchronized = false;
    let syncShiftRegister = 0; 
    let bitCount = 0;
    
    const samplesPerBit = Math.round((ctx.sampleRate / baudRate) / (bufferLength / 4));

    const liveMetrics = {
      syncStatus: 'SEARCHING',
      signalQuality: 0,
      freqDetected: 0,
      bitsDecoded: 0
    };

    const samplingInterval = setInterval(() => {
      analyserNode.getByteTimeDomainData(dataArray);
      
      let crossings = 0;
      let peakAmp = 0;
      for (let i = 1; i < dataArray.length; i++) {
        const amp = Math.abs(dataArray[i] - 128);
        if (amp > peakAmp) peakAmp = amp;
        
        if ((dataArray[i - 1] < 128 && dataArray[i] >= 128) || (dataArray[i - 1] > 128 && dataArray[i] <= 128)) {
          crossings++;
        }
      }
      
      const estimatedFreq = (crossings * ctx.sampleRate) / (2 * dataArray.length);
      liveMetrics.freqDetected = Math.round(estimatedFreq);
      liveMetrics.signalQuality = Math.min(100, Math.round((peakAmp / 128) * 100));

      let currentBit = null;
      if (Math.abs(estimatedFreq - markFreq) < 350) currentBit = 1;
      else if (Math.abs(estimatedFreq - spaceFreq) < 350) currentBit = 0;
      
      if (currentBit !== null) {
        syncShiftRegister = ((syncShiftRegister << 1) | currentBit) & 0xFF;
        
        if (!isSynchronized && syncShiftRegister === 0xAA) {
          isSynchronized = true;
          liveMetrics.syncStatus = 'LOCKED';
          bitBuffer = []; 
        }

        if (isSynchronized) {
          bitBuffer.push(currentBit);
          bitCount++;
          liveMetrics.bitsDecoded = bitCount;

          if (bitBuffer.length === 8) {
            onDataDecoded(bitsToString(bitBuffer));
            bitBuffer = []; 
            
            isSynchronized = false;
            liveMetrics.syncStatus = 'SEARCHING';
          }
        }
      }

      onFeedbackUpdated({ ...liveMetrics });
    }, (1000 / baudRate) / 2);

    return {
      kill() {
        clearInterval(samplingInterval);
      }
    };
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

registerModem('fsk_standard', FSK_MODEM_CONFIG);


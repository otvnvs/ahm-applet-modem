// ./lib/modem/fsk/index.js
import { registerModem } from '../registry.js';

const FSK_MODEM_CONFIG = {
  name: 'Frequency Shift Keying (FSK)',
//  controls: [
//    { key: 'baudRate', label: 'Baud Rate (bps)', type: 'numeric', render: 'slider', min: 10, max: 300, step: 10, default: 100 },
//    { key: 'markFreq', label: 'Mark Frequency (1)', type: 'numeric', render: 'input', min: 1000, max: 5000, default: 2200 },
//    { key: 'spaceFreq', label: 'Space Frequency (0)', type: 'numeric', render: 'input', min: 1000, max: 5000, default: 1200 },
//    {
//      key: 'operatingMode',
//      label: 'Operating Loopback Mode',
//      type: 'select',
//      render: 'dropdown',
//      options: [
//        { label: 'Local Loopback (Single Device Test)', value: 'loopback' },
//        { label: 'Acoustic Network (Two Phones Peer-to-Peer)', value: 'p2p' }
//      ],
//      default: 'loopback'
//    }
//  ],
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

  /**
   * STANDARD BURST TRANSMISSION (Kept for standalone individual emits)
   */
  async transmit(text, ctx, runtimeSettings, localBypassNode = null) {
    if (!text) return;
    const { baudRate, markFreq, spaceFreq, operatingMode } = runtimeSettings;
    const bits = stringToBits(text);
    const now = ctx.currentTime;
    const bitDuration = 1 / baudRate; // Duration of 1 bit in seconds

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (operatingMode === 'loopback' && localBypassNode) {
      gainNode.connect(localBypassNode);
    }

    // Gentle burst fade-in/out ramps
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.5, now + 0.02);

    let bitTime = now + 0.02;
    bits.forEach((bit) => {
      const frequency = bit === 1 ? markFreq : spaceFreq;
      osc.frequency.setValueAtTime(frequency, bitTime);
      bitTime += bitDuration;
    });

    gainNode.gain.setValueAtTime(0.5, bitTime);
    gainNode.gain.linearRampToValueAtTime(0, bitTime + 0.02);

    osc.start(now);
    osc.stop(bitTime + 0.03);

    return new Promise(resolve => setTimeout(resolve, (bitTime - now + 0.05) * 1000));
  },

  /**
   * 🌟 NEW: SEAMLESS AUDIO STREAM GENERATOR (For gapless loops)
   * This maintains a persistent oscillator and schedules bit shifts continuously.
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

    // Smooth entry ramp up once at the very start of the stream session
    const startWindow = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, startWindow);
    gainNode.gain.linearRampToValueAtTime(0.5, startWindow + 0.05);

    let bits = stringToBits(text);
    let currentBitIndex = 0;
    
    // Look-ahead scheduler parameters (standard Web Audio API streaming design pattern)
    // Schedules tones slightly ahead of time to keep audio synthesis gapless
    let nextBitScheduleTime = ctx.currentTime + 0.05; 
    const lookAheadWindow = 0.1; // How far ahead to schedule audio (seconds)
    const scheduleIntervalTime = 30; // Check context timeline every 30ms

    const streamingInterval = setInterval(() => {
      // Pull configurations from settingsRef dynamically to capture real-time slider updates
      const currentBaud = settingsRef.baudRate || 100;
      const currentMark = settingsRef.markFreq || 2200;
      const currentSpace = settingsRef.spaceFreq || 1200;
      const bitDuration = 1 / currentBaud;

      // Keep scheduling bits as long as they fall within the look-ahead window
      while (nextBitScheduleTime < ctx.currentTime + lookAheadWindow) {
        const bit = bits[currentBitIndex];
        const targetFrequency = bit === 1 ? currentMark : currentSpace;

        // Queue the frequency change at the precise scheduled milestone time
        osc.frequency.setValueAtTime(targetFrequency, nextBitScheduleTime);

        // Advance timelines and wrap bit queues continuously
        nextBitScheduleTime += bitDuration;
        currentBitIndex = (currentBitIndex + 1) % bits.length;
      }
    }, scheduleIntervalTime);

    osc.start(startWindow);

    // Return control pointers to safely stop the persistent nodes later
    return {
      stop() {
        clearInterval(streamingInterval);
        try {
          const stopTime = ctx.currentTime;
          gainNode.gain.setValueAtTime(gainNode.gain.value, stopTime);
          gainNode.gain.linearRampToValueAtTime(0, stopTime + 0.05);
          osc.stop(stopTime + 0.06);
        } catch (e) {
          osc.disconnect();
        }
      }
    };
  },

  initReceiver(ctx, analyserNode, runtimeSettings, onDataDecoded) {
    const { baudRate, markFreq, spaceFreq } = runtimeSettings;
    const bufferLength = analyserNode.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    const bitBuffer = [];
    let lastBit = null;
    let bitSamplesCount = 0;
    const samplesPerBit = Math.round((ctx.sampleRate / baudRate) / (bufferLength / 4));

    const samplingInterval = setInterval(() => {
      analyserNode.getByteTimeDomainData(dataArray);
      let crossings = 0;
      for (let i = 1; i < dataArray.length; i++) {
        if ((dataArray[i - 1] < 128 && dataArray[i] >= 128) || (dataArray[i - 1] > 128 && dataArray[i] <= 128)) {
          crossings++;
        }
      }
      const estimatedFreq = (crossings * ctx.sampleRate) / (2 * dataArray.length);
      let currentBit = null;
      if (Math.abs(estimatedFreq - markFreq) < 400) currentBit = 1;
      else if (Math.abs(estimatedFreq - spaceFreq) < 400) currentBit = 0;
      
      if (currentBit !== null) {
        if (currentBit === lastBit) {
          bitSamplesCount++;
        } else {
          if (bitSamplesCount >= Math.max(1, samplesPerBit * 0.7)) {
            bitBuffer.push(lastBit);
            if (bitBuffer.length % 8 === 0) {
              onDataDecoded(bitsToString(bitBuffer.slice(-8)));
            }
          }
          lastBit = currentBit;
          bitSamplesCount = 1;
        }
      }
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
  let str = "";
  for (let i = 0; i < bits.length; i += 8) {
    let charCode = 0;
    for (let bit = 0; bit < 8; bit++) charCode = (charCode << 1) | bits[i + bit];
    if (charCode > 0) str += String.fromCharCode(charCode);
  }
  return str;
}

registerModem('fsk_standard', FSK_MODEM_CONFIG);


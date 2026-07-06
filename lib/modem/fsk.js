// ./lib/modem/fsk.js

// Configuration Constants
const MARK_FREQ = 2200; // Frequency for Binary 1 (Hz)
const SPACE_FREQ = 1200; // Frequency for Binary 0 (Hz)
const BAUD_RATE = 100;   // Bits per second
const BIT_DURATION = 1000 / BAUD_RATE; // MS per bit

/**
 * Converts a string into an array of raw bits (8 bits per character).
 */
export function stringToBits(str) {
  const bits = [];
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    for (let bit = 7; bit >= 0; bit--) {
      bits.push((charCode >> bit) & 1);
    }
  }
  return bits;
}

/**
 * Converts an array of raw bits back into a string.
 */
export function bitsToString(bits) {
  let str = "";
  for (let i = 0; i < bits.length; i += 8) {
    if (i + 8 > bits.length) break;
    let charCode = 0;
    for (let bit = 0; bit < 8; bit++) {
      charCode = (charCode << 1) | bits[i + bit];
    }
    if (charCode > 0) str += String.fromCharCode(charCode);
  }
  return str;
}

/**
 * Transmits string data using Web Audio API FSK modulation
 */
//export async function transmitFSK(text, audioContext) {
//  if (!text) return;
//  
//  const bits = stringToBits(text);
//  const now = audioContext.currentTime;
//  
//  // Create Oscillator and Gain configuration graph
//  const osc = audioContext.createOscillator();
//  const gainNode = audioContext.createGain();
//  
//  osc.type = "sine";
//  osc.connect(gainNode);
//  gainNode.connect(audioContext.destination);
//  
//  // Set initial silence frame ramp
//  gainNode.gain.setValueAtTime(0, now);
//  gainNode.gain.linearRampToValueAtTime(0.5, now + 0.05);
//  
//  // Schedule frequency shifts based on bit sequences
//  let bitTime = now + 0.05;
//  bits.forEach((bit) => {
//    const frequency = bit === 1 ? MARK_FREQ : SPACE_FREQ;
//    osc.frequency.setValueAtTime(frequency, bitTime);
//    bitTime += BIT_DURATION / 1000;
//  });
//  
//  // Post-transmission tail ramp and shut off
//  gainNode.gain.setValueAtTime(0.5, bitTime);
//  gainNode.gain.linearRampToValueAtTime(0, bitTime + 0.05);
//  
//  osc.start(now);
//  osc.stop(bitTime + 0.06);
//  
//  return new Promise((resolve) => {
//    setTimeout(resolve, (bitTime - now + 0.1) * 1000);
//  });
//}

/**
 * Transmits string data using Web Audio API FSK modulation
 * ADDED PARAMETER: receiverAnalyser
 */
export async function transmitFSK(text, audioContext, receiverAnalyser = null) {
  if (!text) return;
  
  const bits = stringToBits(text);
  const now = audioContext.currentTime;
  
  // Create Oscillator and Gain configuration graph
  const osc = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  osc.type = "sine";
  osc.connect(gainNode);
  
  // 1. STANDARD OUT: Send audio to the device physical speakers
  gainNode.connect(audioContext.destination);
  
  // 2. INTERNAL SOFTWARE LOOPBACK: Inject the signal directly into the visualizer/demodulator
  if (receiverAnalyser) {
    gainNode.connect(receiverAnalyser);
  }
  
  // Set initial silence frame ramp
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.5, now + 0.05);
  
  // Schedule frequency shifts based on bit sequences
  let bitTime = now + 0.05;
  bits.forEach((bit) => {
    const frequency = bit === 1 ? MARK_FREQ : SPACE_FREQ;
    osc.frequency.setValueAtTime(frequency, bitTime);
    bitTime += BIT_DURATION / 1000;
  });
  
  // Post-transmission tail ramp and shut off
  gainNode.gain.setValueAtTime(0.5, bitTime);
  gainNode.gain.linearRampToValueAtTime(0, bitTime + 0.05);
  
  osc.start(now);
  osc.stop(bitTime + 0.06);
  
  return new Promise((resolve) => {
    setTimeout(resolve, (bitTime - now + 0.1) * 1000);
  });
}


/**
 * Simple Demodulator instance using Zero-Crossing rate analysis 
 */
export class FSKReceiver {
  constructor(audioContext, onDataCallback) {
    this.ctx = audioContext;
    this.onData = onDataCallback;
    this.stream = null;
    this.analyser = null;
    this.isListening = false;
    this.bitBuffer = [];
    this.rawSampleInterval = null;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const source = this.ctx.createMediaStreamSource(this.stream);
    
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    source.connect(this.analyser);
    
    this.isListening = true;
    this.bitBuffer = [];
    
    const bufferLength = this.analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    
    let lastBit = null;
    let bitSamplesCount = 0;
    const samplesPerBit = Math.round((this.ctx.sampleRate / BAUD_RATE) / (bufferLength / 4));

    this.rawSampleInterval = setInterval(() => {
      if (!this.isListening) return;
      
      this.analyser.getByteTimeDomainData(dataArray);
      
      // Calculate zero crossings to determine fundamental wave frequency
      let crossings = 0;
      for (let i = 1; i < dataArray.length; i++) {
        if ((dataArray[i - 1] < 128 && dataArray[i] >= 128) || 
            (dataArray[i - 1] > 128 && dataArray[i] <= 128)) {
          crossings++;
        }
      }
      
      const estimatedFreq = (crossings * this.ctx.sampleRate) / (2 * dataArray.length);
      
      // Classify the tone frequency zone
      let currentBit = null;
      if (Math.abs(estimatedFreq - MARK_FREQ) < 400) currentBit = 1;
      else if (Math.abs(estimatedFreq - SPACE_FREQ) < 400) currentBit = 0;
      
      if (currentBit !== null) {
        if (currentBit === lastBit) {
          bitSamplesCount++;
        } else {
          if (bitSamplesCount >= Math.max(1, samplesPerBit * 0.7)) {
            this.bitBuffer.push(lastBit);
            if (this.bitBuffer.length % 8 === 0) {
              this.onData(bitsToString(this.bitBuffer.slice(-8)));
            }
          }
          lastBit = currentBit;
          bitSamplesCount = 1;
        }
      }
    }, BIT_DURATION / 2);
  }

  stop() {
    this.isListening = false;
    if (this.rawSampleInterval) clearInterval(this.rawSampleInterval);
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
  }
}


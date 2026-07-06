<!-- index.vue -->
<template>
  <div class="app-container">


    <!-- Refactored Modular Panes -->
    <TransmitterPane 
      :is-transmitting="isTransmitting" 
      @transmit-payload="handleTransmit" 
    />

<ReceiverPane 
  :receiver-active="receiverActive" 
  :received-data-log="receivedDataLog"
  :analyser-node="activeAnalyserNode"
  @toggle-receiver="initAudioAndToggleReceiver"
  @clear-log="clearLog"
/>


  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue';
import TransmitterPane from './components/TransmitterPane.vue';
import ReceiverPane from './components/ReceiverPane.vue';
import { transmitFSK, FSKReceiver } from './lib/modem/fsk.js';

const audioCtx = ref(null);
const receivedDataLog = ref('');
const isTransmitting = ref(false);
const receiverActive = ref(false);
const activeAnalyserNode = ref(null); // ADD THIS LINEs
let receiverInstance = null;

const ensureAudioEngine = () => {
  if (!audioCtx.value) {
    audioCtx.value = new (window.AudioContext || window.webkitAudioContext)();
  }
};

const initAudioAndToggleReceiver = async () => {
  ensureAudioEngine();
  if (receiverActive.value) {
    stopReceiverEngine();
  } else {
    await startReceiverEngine();
  }
};

//const handleTransmit = async (payload) => {
//  ensureAudioEngine();
//  try {
//    isTransmitting.value = true;
//    await transmitFSK(payload, audioCtx.value);
//  } catch (err) {
//    console.error("Transmitter failure:", err);
//  } finally {
//    isTransmitting.value = false;
//  }
//};
const handleTransmit = async (payload) => {
  ensureAudioEngine();
  try {
    isTransmitting.value = true;
    
    // Pass activeAnalyserNode.value as the third parameter to bypass hardware echo suppression
    await transmitFSK(payload, audioCtx.value, activeAnalyserNode.value);
    
  } catch (err) {
    console.error("Transmitter failure:", err);
  } finally {
    isTransmitting.value = false;
  }
};

//const startReceiverEngine = async () => {
//  if (!audioCtx.value) return;
//  try {
//    receiverInstance = new FSKReceiver(audioCtx.value, (char) => {
//      receivedDataLog.value += char;
//    });
//    await receiverInstance.start();
//    receiverActive.value = true;
//  } catch (err) {
//    console.error(err);
//  }
//};
const startReceiverEngine = async () => {
  if (!audioCtx.value) return;
  try {
    receiverInstance = new FSKReceiver(audioCtx.value, (char) => {
      receivedDataLog.value += char;
    });
    await receiverInstance.start();
    
    // Extract internal Web Audio API reference node pointer
    activeAnalyserNode.value = receiverInstance.analyser; // ADD THIS LINE
    receiverActive.value = true;
  } catch (err) {
    console.error(err);
  }
};

//const stopReceiverEngine = () => {
//  if (receiverInstance) {
//    receiverInstance.stop();
//    receiverInstance = null;
//  }
//  receiverActive.value = false;
//};
const stopReceiverEngine = () => {
  if (receiverInstance) {
    receiverInstance.stop();
    receiverInstance = null;
  }
  activeAnalyserNode.value = null; // ADD THIS LINE
  receiverActive.value = false;
};

const clearLog = () => { receivedDataLog.value = ''; };

onBeforeUnmount(() => {
  stopReceiverEngine();
  if (audioCtx.value) audioCtx.value.close();
});
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  background-color: #1a191d;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  padding: 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.app-header {
  text-align: center;
  margin-bottom: -4px;
}
.header-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.modem-icon {
  width: 24px;
  height: 24px;
  color: #79529c;
}
.app-header h1 {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.3px;
}
.status-subtitle {
  font-size: 13px;
  color: #6f6e74;
  margin: 4px 0 0 0;
}
</style>


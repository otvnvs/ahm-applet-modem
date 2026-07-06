<!-- ./src/apps/Modem/index.vue template segment updates -->
<template>
  <div class="app-container">
    <header class="app-header-node">
      <div class="selector-container-wrapper">
        <label for="modem-select">ACTIVE HARDWARE CONTROLLER</label>
        <select id="modem-select" v-model="selectedModemId" @change="handleModemHotSwap" class="global-modem-selector">
          <option v-for="modem in availableModems" :key="modem.id" :value="modem.id">{{ modem.name }}</option>
        </select>
      </div>
    </header>

    <ModemControlPanel 
      v-if="activeSchema.length && Object.keys(runtimeSettings).length"
      :schema="activeSchema"
      v-model="runtimeSettings"
    />

    <!-- TRANSMIT STAGE CARD -->
    <TransmitterPane 
      :is-transmitting="isTransmitting" 
      @transmit-payload="handleTransmit" 
      @toggle-tx-loop="handleTxLoopToggle"
    />

    <!-- RECEIVER STAGE CARD WITH CONSOLIDATED PROP PIPES -->
    <ReceiverPane 
      :receiver-active="receiverActive" 
      :received-data-log="receivedDataLog"
      :analyser-node="activeAnalyserNode"
      :feedback-schema="activeFeedbackSchema"
      :feedback-data="decoderFeedbackData"
      @toggle-receiver="initAudioAndToggleReceiver"
      @clear-log="clearLog"
    />
  </div>
</template>

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
  gap: 20px;
}
.selector-container-wrapper {
  background-color: #212025;
  border: 1px solid #2d2c33;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.selector-container-wrapper label {
  font-size: 10px;
  font-weight: 800;
  color: #5d5c62;
  letter-spacing: 0.8px;
}
.global-modem-selector {
  width: 100%;
  background-color: #1a191d;
  border: 1px solid #2d2c33;
  border-radius: 6px;
  padding: 12px;
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
}
.verification-card {
  background-color: #1e1b18;
  border: 1px solid #3a2d20;
  border-radius: 8px;
  padding: 12px;
}
.verification-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: bold;
  color: #d97706;
  margin-bottom: 8px;
}
.pulse-dot-amber {
  width: 6px;
  height: 6px;
  background-color: #d97706;
  border-radius: 50%;
}
.telemetry-output {
  margin: 0;
  font-family: monospace;
  font-size: 12px;
  color: #fcd34d;
  background-color: #151210;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
}
</style>
<!-- ./src/apps/Modem/index.vue (Part 2/2) -->
<script setup>
import { ref, onMounted, computed, onBeforeUnmount, watch } from 'vue';
import ModemControlPanel from './components/ModemControlPanel.vue';
import ModemFeedbackPanel from './components/ModemFeedbackPanel.vue';
import TransmitterPane from './components/TransmitterPane.vue';
import ReceiverPane from './components/ReceiverPane.vue';

// Dynamic Import Architecture Engine Links
import { getRegisteredModems, getModemDriver } from './lib/modem/index.js';

const availableModems = ref([]);
const selectedModemId = ref('');
const runtimeSettings = ref({});
const decoderFeedbackData = ref({});

const isTransmitting = ref(false);
const receiverActive = ref(false);
const activeAnalyserNode = ref(null);
const receivedDataLog = ref('');

let audioCtx = ref(null);
let activeReceiverSession = null;
let liveStreamPointer = null; 
let loopActiveText = '';

const activeSchema = computed(() => {
  const selected = availableModems.value.find(m => m.id === selectedModemId.value);
  return selected ? selected.controls : [];
});

const activeFeedbackSchema = computed(() => {
  const selected = availableModems.value.find(m => m.id === selectedModemId.value);
  return selected ? selected.feedbackMetadata : [];
});

//onMounted(() => {
//  availableModems.value = getRegisteredModems();
//  if (availableModems.value.length > 0) {
//    selectedModemId.value = availableModems.value[0].id;
//    handleModemHotSwap();
//  }
//});
onMounted(() => {
  // 1. Gather all auto-registered modem options
  availableModems.value = getRegisteredModems();
  
  if (availableModems.value.length > 0) {
    // 🌟 THE FIX: Safely grab the .id property from the first item inside the array slot
    selectedModemId.value = availableModems.value[0].id;
    // Trigger parameter initialization 
    handleModemHotSwap();
  }
});

const handleModemHotSwap = () => {
  if (receiverActive.value) stopReceiverEngine();
  if (liveStreamPointer) {
    liveStreamPointer.stop();
    liveStreamPointer = null;
  }
  decoderFeedbackData.value = {};

  const driver = getModemDriver(selectedModemId.value);
  if (!driver || !driver.controls) {
    runtimeSettings.value = {};
    return;
  }

  const defaults = {};
  driver.controls.forEach(ctrl => {
    defaults[ctrl.key] = ctrl.default;
  });
  runtimeSettings.value = defaults;
};

const ensureAudioEngine = () => {
  if (!audioCtx.value) {
    audioCtx.value = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.value.state === 'suspended') {
    audioCtx.value.resume();
  }
};

watch(runtimeSettings, () => {
  const driver = getModemDriver(selectedModemId.value);
  if (!driver) return;

  if (liveStreamPointer && isTransmitting.value) {
    liveStreamPointer.stop();
    liveStreamPointer = driver.startStream(
      loopActiveText,
      audioCtx.value,
      runtimeSettings.value,
      activeAnalyserNode.value
    );
  }

  if (receiverActive.value && !liveStreamPointer) {
    if (activeReceiverSession && typeof activeReceiverSession.kill === 'function') {
      activeReceiverSession.kill();
    }
    activeReceiverSession = driver.initReceiver(
      audioCtx.value,
      activeAnalyserNode.value,
      runtimeSettings.value,
      (decodedChar) => {
        receivedDataLog.value += decodedChar;
      },
      (metricsSnapshotObject) => {
        decoderFeedbackData.value = metricsSnapshotObject;
      }
    );
  }
}, { deep: true });

const handleTransmit = async (payloadData) => {
  ensureAudioEngine();
  const driver = getModemDriver(selectedModemId.value);
  if (!driver) return;

  const wasListening = receiverActive.value;
  if (wasListening && runtimeSettings.value.operatingMode === 'p2p') {
    stopReceiverEngine();
  }
  
  try {
    isTransmitting.value = true;
    await driver.transmit(payloadData.text, audioCtx.value, runtimeSettings.value, activeAnalyserNode.value);
  } catch (err) {
    console.error(err);
  } finally {
    isTransmitting.value = false;
    if (wasListening && runtimeSettings.value.operatingMode === 'p2p') {
      await startReceiverEngine();
    }
  }
};

const handleTxLoopToggle = async (event) => {
  ensureAudioEngine();
  
  if (!event.active) {
    if (liveStreamPointer) {
      liveStreamPointer.stop();
      liveStreamPointer = null;
    }
    isTransmitting.value = false;
    if (receiverActive.value && runtimeSettings.value.operatingMode === 'p2p') {
      await startReceiverEngine();
    }
    return;
  }

  if (liveStreamPointer) {
    liveStreamPointer.stop();
    liveStreamPointer = null;
  }

  const driver = getModemDriver(selectedModemId.value);
  if (!driver || !driver.startStream) return;

  const wasListening = receiverActive.value;
  if (wasListening && runtimeSettings.value.operatingMode === 'p2p') {
    stopReceiverEngine();
  }

  isTransmitting.value = true;
  loopActiveText = event.text;

  liveStreamPointer = driver.startStream(
    loopActiveText,
    audioCtx.value,
    runtimeSettings.value,
    activeAnalyserNode.value
  );
};

const initAudioAndToggleReceiver = async () => {
  ensureAudioEngine();
  if (receiverActive.value) {
    stopReceiverEngine();
  } else {
    await startReceiverEngine();
  }
};

const startReceiverEngine = async () => {
  if (!audioCtx.value) return;
  const driver = getModemDriver(selectedModemId.value);
  if (!driver) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const sourceNode = audioCtx.value.createMediaStreamSource(stream);
    
    const analyser = audioCtx.value.createAnalyser();
    analyser.fftSize = 1024;
    sourceNode.connect(analyser);
    
    activeAnalyserNode.value = analyser;

    activeReceiverSession = driver.initReceiver(
      audioCtx.value, 
      analyser, 
      runtimeSettings.value, 
      (decodedChar) => {
        receivedDataLog.value += decodedChar;
      },
      (metricsSnapshotObject) => {
        decoderFeedbackData.value = metricsSnapshotObject;
      }
    );

    activeReceiverSession.rawStream = stream;
    receiverActive.value = true;
  } catch (err) {
    console.error(err);
    stopReceiverEngine();
  }
};

const stopReceiverEngine = () => {
  if (activeReceiverSession) {
    if (typeof activeReceiverSession.kill === 'function') activeReceiverSession.kill();
    if (activeReceiverSession.rawStream) {
      activeReceiverSession.rawStream.getTracks().forEach(track => track.stop());
    }
    activeReceiverSession = null;
  }
  activeAnalyserNode.value = null;
  receiverActive.value = false;
};

const clearLog = () => { receivedDataLog.value = ''; };

onBeforeUnmount(() => {
  if (liveStreamPointer) liveStreamPointer.stop();
  stopReceiverEngine();
  if (audioCtx.value) audioCtx.value.close();
});
</script>


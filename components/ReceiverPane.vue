<!-- components/ReceiverPane.vue -->
<template>
  <section class="testing-pane receiver-pane">
    <!-- Header Block & Engine Micro-Switch Toggle -->
    <div class="pane-header justify-split">
      <div class="flex-align">
        <span :class="['pane-indicator rx-indicator', { 'rx-active': receiverActive }]"></span>
        <h2>2. RECEIVER STAGE</h2>
      </div>
      
      <button 
        @click="$emit('toggle-receiver')" 
        :class="['engine-toggle-btn', { 'engine-on': receiverActive }]"
      >
        {{ receiverActive ? 'Mute Mic' : 'Engage Mic' }}
      </button>
    </div>

    <!-- Diagnostic Instruments Stack (Only loads while hardware mic engine loop is processing) -->
    <div class="visualizer-grid" v-if="receiverActive && analyserNode">
      <WaveformVisualizer :analyser="analyserNode" :active="receiverActive" />
      <WaterfallVisualizer :analyser="analyserNode" :active="receiverActive" />
    </div>

    <!-- Data Stream Workspace Management Headers -->
    <div class="stream-title-bar">
      <span>DECODED AIR STREAM WAVE LOG</span>
      <button v-if="receivedDataLog" @click="$emit('clear-log')", class="clear-text-btn">Reset</button>
    </div>

    <!-- Output Box Area -->
    <div class="task-style-card">
      <textarea 
        id="rx-stream"
        :value="receivedDataLog" 
        readonly
        placeholder="Awaiting microphone feedback. Engage mic and press Emit above to verify loopback..."
      ></textarea>
    </div>
  </section>
</template>

<script setup>
import WaveformVisualizer from './WaveformVisualizer.vue';
import WaterfallVisualizer from './WaterfallVisualizer.vue';

defineProps({
  receiverActive: { type: Boolean, default: false },
  receivedDataLog: { type: String, default: '' },
  analyserNode: { type: Object, default: null }
});

defineEmits(['toggle-receiver', 'clear-log']);
</script>

<style scoped>
/* Core Section Framework */
.testing-pane {
  background-color: #212025;
  border: 1px solid #2d2c33;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
}

.pane-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pane-header.justify-split { 
  justify-content: space-between; 
}
.flex-align { 
  display: flex; 
  align-items: center; 
  gap: 8px; 
}

.pane-header h2 {
  font-size: 12px;
  font-weight: 800;
  color: #a3a2a8;
  margin: 0;
  letter-spacing: 0.8px;
}

/* Operational Status Dot Indicators */
.pane-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #38373e;
}
.rx-indicator.rx-active { 
  background-color: #10ac84; 
  animation: blink 1s infinite; 
}

/* Micro Toggle Control Link */
.engine-toggle-btn {
  background-color: #2d2c33;
  color: #a3a2a8;
  border: 1px solid #38373e;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}
.engine-toggle-btn.engine-on {
  background-color: #1b3a24;
  border-color: #10ac84;
  color: #10ac84;
}

/* Visualizer Grid Separation */
.visualizer-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

/* Terminal Console Log Meta Row */
.stream-title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  color: #5d5c62;
  padding: 4px 2px 0 2px;
}
.clear-text-btn {
  background: none;
  border: none;
  color: #79529c;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

/* Terminal Area Style Configuration Block */
.task-style-card {
  background-color: #1a191d;
  border: 1px solid #2d2c33;
  border-radius: 8px;
  padding: 12px;
  flex: 1;
  min-height: 160px;
  display: flex;
}
textarea {
  width: 100%;
  height: 100%;
  background: transparent;
  border: none;
  color: #10ac84; /* Terminal green font color */
  font-family: monospace;
  font-size: 13px;
  line-height: 1.4;
  resize: none;
  box-sizing: border-box;
}
textarea:focus { 
  outline: none; 
}

@keyframes blink {
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
}
</style>


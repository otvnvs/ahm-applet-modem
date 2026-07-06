<!-- components/ReceiverPane.vue -->
<template>
  <section class="testing-pane receiver-pane" :class="{ 'pane-collapsed': !isOpen }">
    <!-- Clickable Header Area Frame -->
    <div class="pane-header justify-split cursor-pointer" @click="isOpen = !isOpen">
      <div class="flex-align">
        <span :class="['pane-indicator rx-indicator', { 'rx-active': receiverActive }]"></span>
        <h2>2. RECEIVER STAGE</h2>
        <span class="collapse-chevron">{{ isOpen ? '▲' : '▼' }}</span>
      </div>
      
      <button 
        @click.stop="$emit('toggle-receiver')" 
        :class="['engine-toggle-btn', { 'engine-on': receiverActive }]"
      >
        {{ receiverActive ? 'Mute Mic' : 'Engage Mic' }}
      </button>
    </div>

    <!-- Consolidated Unified Child Content Area Box -->
    <div v-show="isOpen" class="pane-drawer-content">
      
      <!-- NESTED COMPONENT A: DYNAMIC FEEDBACK INSTRUMENT DIAGNOSTICS PANELS -->
      <ModemFeedbackPanel 
        :schema="feedbackSchema"
        :data="feedbackData"
      />

      <!-- NESTED COMPONENT B: HIGH PERFORMANCE RESOURCED OSCILLOSCOPE / SPECTROGRAM GRAPHS -->
      <div class="visualizer-grid" v-if="receiverActive && analyserNode">
        <WaveformVisualizer :analyser="analyserNode" :active="receiverActive" />
        <WaterfallVisualizer :analyser="analyserNode" :active="receiverActive" />
      </div>

      <!-- TERMINAL WORKSPACE STREAM LOGS WINDOW -->
      <div class="stream-title-bar">
        <span>DECODED AIR STREAM WAVE LOG</span>
        <button v-if="receivedDataLog" @click.stop="$emit('clear-log')" class="clear-text-btn">Reset</button>
      </div>

      <div class="task-style-card">
        <textarea 
          id="rx-stream"
          :value="receivedDataLog" 
          readonly
          placeholder="Awaiting microphone feedback. Engage mic and verify loopback loops..."
        ></textarea>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import ModemFeedbackPanel from './ModemFeedbackPanel.vue';
import WaveformVisualizer from './WaveformVisualizer.vue';
import WaterfallVisualizer from './WaterfallVisualizer.vue';

defineProps({
  receiverActive: { type: Boolean, default: false },
  receivedDataLog: { type: String, default: '' },
  analyserNode: { type: Object, default: null },
  feedbackSchema: { type: Array, default: () => [] },
  feedbackData: { type: Object, default: () => ({}) }
});

defineEmits(['toggle-receiver', 'clear-log']);
const isOpen = ref(true); // Default folder view expanded status configurations
</script>

<style scoped>
.testing-pane {
  background-color: #212025;
  border: 1px solid #2d2c33;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  transition: all 0.2s ease;
}
.pane-collapsed { gap: 0; padding-bottom: 12px; padding-top: 12px; flex: initial; }
.pane-header { display: flex; align-items: center; gap: 8px; width: 100%; user-select: none; }
.pane-header.justify-split { justify-content: space-between; }
.cursor-pointer { cursor: pointer; }
.flex-align { display: flex; align-items: center; gap: 8px; }
.pane-header h2 { font-size: 12px; font-weight: 800; color: #a3a2a8; margin: 0; letter-spacing: 0.8px; }
.collapse-chevron { font-size: 9px; color: #6f6e74; margin-left: 2px; }
.pane-indicator { width: 8px; height: 8px; border-radius: 50%; background-color: #38373e; }
.rx-indicator.rx-active { background-color: #10ac84; animation: blink 1s infinite; }

.engine-toggle-btn {
  background-color: #2d2c33;
  color: #a3a2a8;
  border: 1px solid #38373e;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
}
.engine-toggle-btn.engine-on { background-color: #1b3a24; border-color: #10ac84; color: #10ac84; }
.pane-drawer-content { display: flex; flex-direction: column; gap: 14px; margin-top: 4px; }
.visualizer-grid { display: flex; flex-direction: column; gap: 10px; }

.stream-title-bar { display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 700; color: #5d5c62; padding: 4px 2px 0 2px; }
.clear-text-btn { background: none; border: none; color: #79529c; font-weight: 600; cursor: pointer; font-family: inherit; }

.task-style-card { background-color: #1a191d; border: 1px solid #2d2c33; border-radius: 8px; padding: 12px; min-height: 120px; display: flex; }
textarea { width: 100%; height: 100%; background: transparent; border: none; color: #10ac84; font-family: monospace; font-size: 13px; line-height: 1.4; resize: none; box-sizing: border-box; }
textarea:focus { outline: none; }

@keyframes blink { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
</style>


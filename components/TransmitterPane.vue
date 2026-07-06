<!-- components/TransmitterPane.vue -->
<template>
  <section class="testing-pane transmission-pane" :class="{ 'pane-collapsed': !isOpen }">
    <!-- Clickable Header Area -->
    <div class="pane-header justify-split cursor-pointer" @click="isOpen = !isOpen">
      <div class="flex-align">
        <span class="pane-indicator tx-indicator" :class="{ 'tx-active': isTransmitting || isLoopActive }"></span>
        <h2>1. TRANSMITTER STAGE</h2>
        <span class="collapse-chevron">{{ isOpen ? '▲' : '▼' }}</span>
      </div>

      <!-- Stop event click propagation so hitting buttons doesn't trigger collapse toggles -->
      <button 
        @click.stop="toggleLoop" 
        :class="['loop-toggle-btn', { 'loop-on': isLoopActive }]"
      >
        {{ isLoopActive ? 'Halt Loop' : 'Loop Mode' }}
      </button>
    </div>

    <!-- Collapsable Dynamic Block Content Drawer -->
    <div v-show="isOpen" class="pane-drawer-content">
      <div class="input-card-row">
        <div class="input-field-wrapper">
          <input 
            id="tx-payload"
            v-model="localText" 
            type="text" 
            placeholder="Type testing string payload..." 
            autocomplete="off"
            @keyup.enter="triggerEmit"
          />
        </div>
        <button 
          @click.stop="triggerEmit" 
          :disabled="isTransmitting && !isLoopActive"
          class="accent-action-btn"
        >
          {{ isTransmitting ? 'Playing...' : 'Emit' }}
        </button>
      </div>
      <small class="pane-help-text">
        {{ isLoopActive ? 'Broadcasting string payload continuously...' : 'Outputs FSK binary audio data via your device speaker node.' }}
      </small>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue';

defineProps({
  isTransmitting: { type: Boolean, default: false }
});

const emit = defineEmits(['transmit-payload', 'toggle-tx-loop']);
const localText = ref('');
const isLoopActive = ref(false);
const isOpen = ref(true); // Default open parameter configuration drawer profile layout state

const triggerEmit = () => {
  if (!localText.value) return;
  emit('transmit-payload', { text: localText.value, isLoop: false });
};

const toggleLoop = () => {
  if (!localText.value) {
    alert("Please type a payload string first before starting the broadcast loop.");
    return;
  }
  isLoopActive.value = !isLoopActive.value;
  emit('toggle-tx-loop', { text: localText.value, active: isLoopActive.value });
};
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
  transition: all 0.2s ease;
}
.pane-collapsed { gap: 0; padding-bottom: 12px; padding-top: 12px; }
.pane-header { display: flex; align-items: center; gap: 8px; width: 100%; user-select: none; }
.pane-header.justify-split { justify-content: space-between; }
.cursor-pointer { cursor: pointer; }
.flex-align { display: flex; align-items: center; gap: 8px; }
.pane-header h2 { font-size: 12px; font-weight: 800; color: #a3a2a8; margin: 0; letter-spacing: 0.8px; }
.collapse-chevron { font-size: 9px; color: #6f6e74; margin-left: 2px; }
.pane-indicator { width: 8px; height: 8px; border-radius: 50%; background-color: #38373e; }
.tx-indicator.tx-active { background-color: #ff9f43; animation: pulse 1s infinite; }

.loop-toggle-btn {
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
.loop-toggle-btn.loop-on { background-color: #3a2a1b; border-color: #ff9f43; color: #ff9f43; }
.pane-drawer-content { display: flex; flex-direction: column; gap: 14px; margin-top: 4px; }
.input-card-row { display: flex; gap: 8px; }
.input-field-wrapper { flex: 1; background-color: #1a191d; border: 1px solid #2d2c33; border-radius: 8px; }
input[type="text"] { width: 100%; background: transparent; border: none; padding: 12px 14px; color: #ffffff; font-size: 14px; box-sizing: border-box; }
input[type="text"]:focus { outline: none; }
.accent-action-btn { background-color: #79529c; color: #ffffff; border: none; padding: 12px 18px; font-size: 14px; font-weight: 700; border-radius: 8px; cursor: pointer; }
.accent-action-btn:disabled { opacity: 0.4; }
.pane-help-text { font-size: 11px; color: #5d5c62; margin: -4px 0 0 2px; }

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.6; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.6; }
}
</style>


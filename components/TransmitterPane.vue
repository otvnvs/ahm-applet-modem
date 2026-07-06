<!-- components/TransmitterPane.vue -->
<template>
  <section class="testing-pane transmission-pane">
    <div class="pane-header">
      <span class="pane-indicator tx-indicator"></span>
      <h2>1. TRANSMITTER STAGE</h2>
    </div>

    <div class="input-card-row">
      <div class="input-field-wrapper">
        <input 
          id="tx-payload"
          v-model="localText" 
          type="text" 
          placeholder="Type testing string payload..." 
          :disabled="isTransmitting"
          autocomplete="off"
          @keyup.enter="triggerEmit"
        />
      </div>
      <button 
        @click="triggerEmit" 
        :disabled="isTransmitting || !localText"
        class="accent-action-btn"
      >
        {{ isTransmitting ? 'Playing...' : 'Emit' }}
      </button>
    </div>
    <small class="pane-help-text">Outputs FSK binary audio data via your device speaker node.</small>
  </section>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  isTransmitting: { type: Boolean, default: false }
});

const emit = defineEmits(['transmit-payload']);
const localText = ref('');

const triggerEmit = () => {
  if (!localText.value || props.isTransmitting) return;
  emit('transmit-payload', localText.value);
  //localText.value = ''; // Clean local input box post emit dispatch
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
}
.pane-header {
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
.pane-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.tx-indicator { background-color: #ff9f43; }
.input-card-row {
  display: flex;
  gap: 8px;
}
.input-field-wrapper {
  flex: 1;
  background-color: #1a191d;
  border: 1px solid #2d2c33;
  border-radius: 8px;
}
input[type="text"] {
  width: 100%;
  background: transparent;
  border: none;
  padding: 12px 14px;
  color: #ffffff;
  font-size: 14px;
  box-sizing: border-box;
}
input[type="text"]:focus { outline: none; }
input[type="text"]::placeholder { color: #5d5c62; }
.accent-action-btn {
  background-color: #79529c;
  color: #ffffff;
  border: none;
  padding: 12px 18px;
  font-size: 14px;
  font-weight: 700;
  border-radius: 8px;
  cursor: pointer;
}
.accent-action-btn:disabled { opacity: 0.4; }
.pane-help-text {
  font-size: 11px;
  color: #5d5c62;
  margin: -4px 0 0 2px;
}
</style>


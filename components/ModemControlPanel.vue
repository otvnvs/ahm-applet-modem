<!-- components/ModemControlPanel.vue -->
<template>
  <div class="control-panel-box">
    <div class="panel-header">
      <span class="square-marker purple"></span>
      <label>MODEM PARAMETERS CONFIGURATION</label>
    </div>

    <div class="controls-grid">
      <div v-for="ctrl in schema" :key="ctrl.key" class="control-row-item">
        <div class="control-meta-label">
          <span class="field-name">{{ ctrl.label }}</span>
          <span class="field-current-value">{{ modelValue[ctrl.key] }}</span>
        </div>

        <!-- CONFIGURATION 1: SLIDER LAYER -->
        <div v-if="ctrl.render === 'slider'" class="slider-wrapper">
          <input 
            type="range" 
            :min="ctrl.min" 
            :max="ctrl.max" 
            :step="ctrl.step || 1"
            :value="modelValue[ctrl.key]"
            @input="updateField(ctrl.key, Number($event.target.value))"
            class="custom-slider"
          />
          <div class="slider-bounds">
            <span>{{ ctrl.min }}</span>
            <span>{{ ctrl.max }}</span>
          </div>
        </div>

        <!-- CONFIGURATION 2: TYPED NUMERIC INPUT FIELD -->
        <div v-else-if="ctrl.render === 'input' && ctrl.type === 'numeric'">
          <input 
            type="number" 
            :min="ctrl.min" 
            :max="ctrl.max"
            :value="modelValue[ctrl.key]"
            @input="updateField(ctrl.key, Number($event.target.value))"
            class="panel-text-field"
          />
        </div>

        <!-- CONFIGURATION 3: SELECT LIST / DROP-DOWN MENU -->
        <div v-else-if="ctrl.render === 'dropdown'">
          <select 
            :value="modelValue[ctrl.key]"
            @change="updateField(ctrl.key, $event.target.value)"
            class="panel-select-menu"
          >
            <option v-for="opt in ctrl.options" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- CONFIGURATION 4: RAW STRING FIELD -->
        <div v-else>
          <input 
            type="text" 
            :value="modelValue[ctrl.key]"
            @input="updateField(ctrl.key, $event.target.value)"
            class="panel-text-field"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// 🌟 FIX: Declare explicit runtime props signature properties
const props = defineProps({
  schema: { type: Array, required: true },
  modelValue: { type: Object, required: true }
});

const emit = defineEmits(['update:modelValue']);

// 🌟 FIX: Force explicit dictionary clones upstream to break variable caching locks
const updateField = (key, value) => {
  const updatedCopy = { ...props.modelValue };
  updatedCopy[key] = value;
  emit('update:modelValue', updatedCopy);
};
</script>

<style scoped>
.control-panel-box {
  background-color: #212025;
  border: 1px solid #2d2c33;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.square-marker {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background-color: #79529c;
}
label {
  font-size: 11px;
  font-weight: bold;
  color: #6f6e74;
  letter-spacing: 0.8px;
}
.controls-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.control-row-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.control-meta-label {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}
.field-name { color: #a3a2a8; }
.field-current-value { color: #79529c; font-weight: bold; font-family: monospace; }
.panel-text-field, .panel-select-menu {
  width: 100%;
  background-color: #1a191d;
  border: 1px solid #2d2c33;
  border-radius: 6px;
  padding: 10px 12px;
  color: #ffffff;
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
}
.panel-text-field:focus, .panel-select-menu:focus { outline: none; border-color: #444349; }
.custom-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #1a191d;
  outline: none;
  margin: 8px 0;
}
.custom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #79529c;
  cursor: pointer;
}
.slider-bounds {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #5d5c62;
}
</style>


<!-- components/ModemFeedbackPanel.vue -->
<template>
  <div class="feedback-panel-box" v-if="schema && schema.length">
    <div class="panel-header">
      <span class="square-marker green"></span>
      <label>LIVE DECODER DIAGNOSTICS FEEDBACK</label>
    </div>

    <div class="metrics-grid">
      <div v-for="item in schema" :key="item.key" class="metric-row">
        <span class="metric-label">{{ item.label }}:</span>
        
        <!-- ELEMENT VIEW 1: BADGE RENDER (LOCK MODES) -->
        <div v-if="item.render === 'badge'">
          <span :class="['status-badge', data[item.key] === 'LOCKED' ? 'lock-on' : 'lock-search']">
            {{ data[item.key] || 'OFFLINE' }}
          </span>
        </div>

        <!-- ELEMENT VIEW 2: PROGRESS METER RENDER (VOLUME / QUALITY) -->
        <div v-else-if="item.render === 'progress'" class="progress-bar-container">
          <div class="progress-fill" :style="{ width: (data[item.key] || 0) + '%' }"></div>
          <span class="progress-percentage-label">{{ data[item.key] || 0 }}%</span>
        </div>

        <!-- ELEMENT VIEW 3: STANDARD STRINGS TEXT RENDER -->
        <span v-else class="metric-value-text">
          {{ data[item.key] !== undefined ? data[item.key] : '--' }}{{ item.suffix || '' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  schema: { type: Array, default: () => [] },
  data: { type: Object, default: () => ({}) }
});
</script>

<style scoped>
.feedback-panel-box {
  background-color: #212025;
  border: 1px solid #2d2c33;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.panel-header { display: flex; align-items: center; gap: 10px; }
.square-marker.green { width: 10px; height: 10px; border-radius: 2px; background-color: #10ac84; }
label { font-size: 11px; font-weight: bold; color: #6f6e74; letter-spacing: 0.8px; }

.metrics-grid { display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 4px; }
.metric-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
.metric-label { color: #a3a2a8; }
.metric-value-text { font-family: monospace; font-weight: bold; color: #ffffff; }

/* Status Badges Theme rules */
.status-badge { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 900; font-family: monospace; }
.status-badge.lock-on { background-color: #1b3a24; color: #10ac84; border: 1px solid #10ac84; }
.status-badge.lock-search { background-color: #2a2517; color: #ff9f43; border: 1px solid #ff9f43; }

/* Progress meters */
.progress-bar-container { position: relative; flex: 0.6; height: 14px; background-color: #1a191d; border-radius: 4px; border: 1px solid #2d2c33; overflow: hidden; }
.progress-fill { height: 100%; background-color: #79529c; transition: width 0.1s ease; }
.progress-percentage-label { position: absolute; width: 100%; text-align: center; top: 0; font-size: 9px; font-weight: bold; color: #ffffff; line-height: 14px; }
</style>


<!-- components/WaveformVisualizer.vue -->
<template>
  <div class="visualizer-container" :class="{ 'is-disabled': !renderEnabled }">
    <div class="visualizer-meta">
      <span>OSCILLOSCOPE WAVEFORM</span>
      <div class="meta-controls">
        <span v-if="renderEnabled" class="db-indicator" :class="{ clipping: isClipping }">
          {{ isClipping ? 'CLIPPING' : 'LEVEL OK' }}
        </span>
        <button @click="toggleRender" class="pause-btn">
          {{ renderEnabled ? 'Disable' : 'Enable' }}
        </button>
      </div>
    </div>
    <canvas ref="canvasRef" class="visualizer-canvas"></canvas>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';

const props = defineProps({
  analyser: { type: Object, default: null },
  active: { type: Boolean, default: false }
});

const canvasRef = ref(null);
const isClipping = ref(false);
const renderEnabled = ref(true);
let animationFrameId = null;

const toggleRender = () => {
  renderEnabled.value = !renderEnabled.value;
  if (!renderEnabled.value) {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    clearCanvas();
  } else {
    drawWaveform();
  }
};

const clearCanvas = () => {
  if (!canvasRef.value) return;
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a191d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  isClipping.value = false;
};

const drawWaveform = () => {
  if (!props.analyser || !canvasRef.value || !renderEnabled.value) return;

  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const bufferLength = props.analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);

  const renderLoop = () => {
    if (!props.active || !renderEnabled.value) return;
    animationFrameId = requestAnimationFrame(renderLoop);

    props.analyser.getByteTimeDomainData(dataArray);

    ctx.fillStyle = '#1a191d';
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = '#2d2c33';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rect.height / 2);
    ctx.lineTo(rect.width, rect.height / 2);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#10ac84'; 
    ctx.beginPath();

    const sliceWidth = rect.width / bufferLength;
    let x = 0;
    let clipDetected = false;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * rect.height) / 2;

      if (dataArray[i] >= 254 || dataArray[i] <= 1) {
        clipDetected = true;
      }

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    isClipping.value = clipDetected;
    ctx.lineTo(rect.width, rect.height / 2);
    ctx.stroke();
  };

  renderLoop();
};

watch(() => [props.analyser, props.active], ([newAnalyser, isActive]) => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (newAnalyser && isActive && renderEnabled.value) {
    setTimeout(drawWaveform, 50);
  } else {
    clearCanvas();
  }
}, { immediate: true });

onBeforeUnmount(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
});
</script>

<style scoped>
.visualizer-container {
  background-color: #1a191d;
  border: 1px solid #2d2c33;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: opacity 0.2s ease;
}
.visualizer-container.is-disabled {
  opacity: 0.5;
}
.visualizer-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  font-weight: 700;
  color: #5d5c62;
  letter-spacing: 0.5px;
}
.meta-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pause-btn {
  background-color: #2d2c33;
  color: #a3a2a8;
  border: 1px solid #38373e;
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 600;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
}
.pause-btn:active {
  background-color: #38373e;
}
.db-indicator {
  color: #10ac84;
}
.db-indicator.clipping {
  color: #ff5252;
  animation: flash 0.5s infinite alternate;
}
.visualizer-canvas {
  width: 100%;
  height: 80px;
  background-color: #1a191d;
  border-radius: 4px;
}
@keyframes flash {
  0% { opacity: 0.5; }
  100% { opacity: 1; }
}
</style>


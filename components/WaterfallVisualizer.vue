<!-- components/WaterfallVisualizer.vue -->
<template>
  <div class="visualizer-container" :class="{ 'is-disabled': !renderEnabled }">
    <div class="visualizer-meta">
      <span>SPECTROGRAM WATERFALL</span>
      <div class="meta-controls">
        <span v-if="renderEnabled" class="freq-markers">1.2kHz [S] ··· 2.2kHz [M]</span>
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
const renderEnabled = ref(true);
let animationFrameId = null;
let tempCanvas = null;

const toggleRender = () => {
  renderEnabled.value = !renderEnabled.value;
  if (!renderEnabled.value) {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    clearCanvas();
  } else {
    drawWaterfall();
  }
};

const clearCanvas = () => {
  if (!canvasRef.value) return;
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a191d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
};

const drawWaterfall = () => {
  if (!props.analyser || !canvasRef.value || !renderEnabled.value) return;

  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');

  const bufferLength = props.analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const renderLoop = () => {
    if (!props.active || !renderEnabled.value) return;
    animationFrameId = requestAnimationFrame(renderLoop);

    props.analyser.getByteFrequencyData(dataArray);

    tempCtx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 2);

    const imgData = ctx.createImageData(canvas.width, 2);
    
    const sampleRate = props.analyser.context.sampleRate;
    const maxBinToDraw = Math.round((4000 / (sampleRate / 2)) * bufferLength);
    
    for (let x = 0; x < canvas.width; x++) {
      const binIndex = Math.round((x / canvas.width) * maxBinToDraw);
      const intensity = dataArray[binIndex] || 0;

      const pixelIndex = x * 4;
      
      if (intensity > 50) {
        imgData.data[pixelIndex + 0] = Math.round((intensity / 255) * 121); 
        imgData.data[pixelIndex + 1] = Math.round((intensity / 255) * 82);  
        imgData.data[pixelIndex + 2] = intensity;                           
      } else if (intensity > 20) {
        imgData.data[pixelIndex + 0] = 16;
        imgData.data[pixelIndex + 1] = intensity * 3;                       
        imgData.data[pixelIndex + 2] = 132;
      } else {
        imgData.data[pixelIndex + 0] = 26;
        imgData.data[pixelIndex + 1] = 25;
        imgData.data[pixelIndex + 2] = 29;
      }
      imgData.data[pixelIndex + 3] = 255; 
    }

    ctx.putImageData(imgData, 0, 0);
  };

  renderLoop();
};

watch(() => [props.analyser, props.active], ([newAnalyser, isActive]) => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (newAnalyser && isActive && renderEnabled.value) {
    setTimeout(drawWaterfall, 50);
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
.freq-markers {
  color: #79529c;
}
.visualizer-canvas {
  width: 100%;
  height: 110px;
  background-color: #1a191d;
  border-radius: 4px;
}
</style>


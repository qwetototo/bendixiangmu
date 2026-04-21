<template>
  <main class="twin-screen">
    <section class="scene-panel">
      <aside class="pick-panel">
        <!-- <div class="pick-panel__header">
          <div class="pick-panel__title">点击取点</div>
          <div class="pick-panel__actions">
            <button type="button" class="pick-panel__toggle" @click="toggleWallTags">
              {{ wallTagsVisible ? '隐藏墙体标签' : '显示墙体标签' }}
            </button>
            <button type="button" class="pick-panel__toggle ghost" @click="toggleGround">
              {{ groundVisible ? '隐藏地面' : '显示地面' }}
            </button>
          </div>
        </div> -->

        <template v-if="pickedPoint">
          <!-- <div class="pick-panel__row">
            <span>配置 X</span>
            <strong>{{ pickedPoint.floor.x }}</strong>
          </div>
          <div class="pick-panel__row">
            <span>配置 Y</span>
            <strong>{{ pickedPoint.floor.y }}</strong>
          </div> -->
          <div class="pick-panel__row pick-panel__row--muted">
            <span>场景 X</span>
            <strong>{{ pickedPoint.scene.x }}</strong>
          </div>
          <div class="pick-panel__row pick-panel__row--muted">
            <span>场景 Z</span>
            <strong>{{ pickedPoint.scene.z }}</strong>
          </div>
        </template>
        <p v-else class="pick-panel__empty">在场景中点击一次，读取当前位置坐标。</p>

        <div class="pick-panel__divider" />

        <div class="pick-panel__row">
          <span>MQTT 状态</span>
          <strong :class="['pick-panel__status', `pick-panel__status--${mqttStatus}`]">{{ mqttStatusText }}</strong>
        </div>
        <div v-if="mqttError" class="pick-panel__row pick-panel__row--muted">
          <span>错误信息</span>
          <strong>{{ mqttError.closeCode ? `${mqttError.closeCode}` : mqttError.message }}</strong>
        </div>

        <template v-if="livePose">
          <div class="pick-panel__row">
            <span>设备 ID</span>
            <strong>{{ livePose.deviceId || '-' }}</strong>
          </div>
          <div class="pick-panel__row">
            <span>实时 X</span>
            <strong>{{ livePose.x.toFixed(2) }}</strong>
          </div>
          <div class="pick-panel__row">
            <span>实时 Y</span>
            <strong>{{ livePose.y.toFixed(2) }}</strong>
          </div>
          <div class="pick-panel__row">
            <span>Theta</span>
            <strong>{{ livePose.theta.toFixed(3) }}</strong>
          </div>
          <div class="pick-panel__row pick-panel__row--muted">
            <span>接收时间</span>
            <strong>{{ formattedReceivedAt }}</strong>
          </div>
        </template>
        <p v-else class="pick-panel__empty">等待 MQTT 实时轨迹点...</p>
      </aside>

      <div ref="sceneContainer" class="scene-panel__canvas" />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useSceneStore } from '@/stores/scene';
import { MqttPoseClient, type MqttConnectionError, type MqttConnectionStatus } from '@/services/mqttPose';
import { TwinScene, type LivePose, type PickPointResult } from '@/three/TwinScene';

const sceneStore = useSceneStore();
const sceneContainer = ref<HTMLDivElement | null>(null);
const pickedPoint = ref<PickPointResult | null>(null);
const wallTagsVisible = ref(false);
const groundVisible = ref(true);
const livePose = ref<LivePose | null>(null);
const mqttStatus = ref<MqttConnectionStatus>('connecting');
const mqttError = ref<MqttConnectionError | null>(null);

let twinScene: TwinScene | null = null;
let mqttClient: MqttPoseClient | null = null;

function resolveMqttWebSocketUrl(): string {
  const configuredUrl = import.meta.env.VITE_MQTT_WS_URL?.trim();
  if (configuredUrl) {
    return configuredUrl;
  }

  if (import.meta.env.DEV) {
    return 'ws://111.229.115.131:8080';
  }

  return 'ws://111.229.115.131:8080';
}

const mqttStatusText = computed(() => {
  if (mqttStatus.value === 'connected') {
    return '已连接';
  }

  if (mqttStatus.value === 'error') {
    return '重连中';
  }

  if (mqttStatus.value === 'disconnected') {
    return '已断开';
  }

  return '连接中';
});

const formattedReceivedAt = computed(() => {
  const value = livePose.value?.receivedAt;
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
});

function toggleWallTags() {
  wallTagsVisible.value = !wallTagsVisible.value;
  twinScene?.toggleWallTags(wallTagsVisible.value);
}

function toggleGround() {
  groundVisible.value = !groundVisible.value;
  twinScene?.toggleGround(groundVisible.value);
}

onMounted(() => {
  if (!sceneContainer.value) {
    return;
  }

  twinScene = new TwinScene(sceneContainer.value, sceneStore.config, (point) => {
    pickedPoint.value = point;
  });
  twinScene.init();
  twinScene.toggleWallTags(wallTagsVisible.value);
  twinScene.toggleGround(groundVisible.value);

  mqttClient = new MqttPoseClient({
    url: resolveMqttWebSocketUrl(),
    onPose: (pose) => {
      livePose.value = pose;
      twinScene?.updateLivePose(pose);
    },
    onPath: (deviceId, points) => {
      twinScene?.setDevicePath(deviceId, points);
    },
    onDeviceDisconnect: (deviceId) => {
      twinScene?.clearDeviceLivePose(deviceId);
      if (livePose.value?.deviceId === deviceId) {
        livePose.value = null;
      }
    },
    onStatusChange: (status) => {
      mqttStatus.value = status;
    },
    onError: (error) => {
      mqttError.value = error;
    },
  });
  mqttClient.connect();
});

onBeforeUnmount(() => {
  mqttClient?.disconnect();
  mqttClient = null;
  twinScene?.destroy();
  twinScene = null;
});
</script>

<style scoped>
.twin-screen {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.scene-panel {
  position: relative;
  width: 100%;
  height: 100%;
}

.scene-panel__canvas {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.pick-panel {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: 2;
  width: 260px;
  max-height: calc(100% - 48px);
  overflow: auto;
  padding: 14px;
  border: 1px solid rgba(91, 172, 255, 0.16);
  border-radius: 18px;
  background: rgba(7, 21, 36, 0.92);
  backdrop-filter: blur(12px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.24);
}

.pick-panel__header {
  display: grid;
  gap: 10px;
  margin-bottom: 10px;
}

.pick-panel__title {
  color: #f4fbff;
  font-size: 14px;
  font-weight: 600;
}

.pick-panel__actions {
  display: grid;
  gap: 8px;
}

.pick-panel__toggle {
  padding: 9px 12px;
  border: 1px solid rgba(86, 157, 255, 0.25);
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(17, 126, 255, 0.95), rgba(15, 209, 199, 0.88));
  color: #fff;
  cursor: pointer;
}

.pick-panel__toggle.ghost {
  background: rgba(9, 29, 46, 0.82);
}

.pick-panel__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  color: rgba(225, 240, 250, 0.86);
  font-size: 13px;
}

.pick-panel__row strong {
  color: #8ee7ff;
  font-size: 14px;
  text-align: right;
  word-break: break-all;
}

.pick-panel__row--muted {
  color: rgba(225, 240, 250, 0.58);
}

.pick-panel__divider {
  height: 1px;
  margin: 10px 0;
  background: linear-gradient(90deg, rgba(90, 167, 255, 0), rgba(90, 167, 255, 0.3), rgba(90, 167, 255, 0));
}

.pick-panel__status {
  font-size: 12px;
}

.pick-panel__status--connected {
  color: #5ff1b5;
}

.pick-panel__status--connecting,
.pick-panel__status--disconnected {
  color: #8ee7ff;
}

.pick-panel__status--error {
  color: #ffcc66;
}

.pick-panel__empty {
  margin: 0;
  color: rgba(225, 240, 250, 0.6);
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 1080px) {
  .pick-panel {
    top: 14px;
    right: 14px;
    width: 220px;
    max-height: calc(100% - 28px);
  }
}
</style>

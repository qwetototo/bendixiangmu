<template>
  <main class="twin-screen">
    <header class="topbar">
      <div class="topbar__brand">室内定位监控平台</div>
      <div class="topbar__status">
        <span>实时更新：</span>
        <strong>{{ currentTime }}</strong>
        <span :class="['status-dot', `status-dot--${mqttStatus}`]" />
        <span class="topbar__mqtt">{{ mqttStatusText }}</span>
      </div>
      <div class="topbar__spacer" />
      <label class="select-field">
        <span>3D视角</span>
        <select v-model="cameraMode" @change="applyCameraMode">
          <option value="overview">总览</option>
          <option value="top">俯视</option>
          <option value="side">侧视</option>
        </select>
      </label>
      <label class="select-field">
        <span>视图模式</span>
        <select v-model="viewMode">
          <option value="monitor">监控</option>
          <option value="replay">回放</option>
          <option value="thermal">热力</option>
        </select>
      </label>
      <button type="button" class="icon-button" title="设置">
        <SettingOutlined />
      </button>
    </header>

    <section class="workspace">
      <aside class="left-rail">
        <section class="glass-panel online-card">
          <h2>在线统计</h2>
          <div class="metric-grid">
            <div>
              <strong>{{ onlineDevices }}</strong>
              <span>在线设备</span>
            </div>
            <div>
              <strong class="metric-grid__blue">{{ totalDevices }}</strong>
              <span>设备总数</span>
            </div>
          </div>
        </section>

        <section class="glass-panel area-card">
          <h2>区域统计</h2>
          <div class="donut-wrap">
            <div ref="areaChartContainer" class="area-chart" />
          </div>
          <div class="area-list">
            <div v-for="item in areaStats" :key="item.name" class="area-row">
              <i :style="{ backgroundColor: item.color }" />
              <span>{{ item.name }}</span>
              <strong>{{ item.count }} ({{ item.percent }}%)</strong>
            </div>
          </div>
        </section>

        <section class="glass-panel event-card">
          <div class="panel-title-row">
            <h2>事件中心</h2>
            <button type="button">全部事件</button>
          </div>
          <div class="event-list">
            <article v-for="event in events" :key="event.title" class="event-item">
              <span :class="['event-item__icon', `event-item__icon--${event.level}`]">{{ event.icon }}</span>
              <div>
                <strong>{{ event.title }}</strong>
                <small>设备：{{ event.device }}</small>
              </div>
              <time>{{ event.time }}</time>
            </article>
          </div>
        </section>
      </aside>

      <section class="scene-shell">
        <div ref="sceneContainer" class="scene-canvas" />

        <div v-if="pickedPoint" class="pick-chip">
          <span>场景坐标</span>
          <strong>X {{ pickedPoint.scene.x }} / Z {{ pickedPoint.scene.z }}</strong>
        </div>

        <div class="map-controls">
          <button type="button" title="指南针" @click="twinScene?.setCameraView('overview')">
            <CompassOutlined />
          </button>
          <button type="button" title="2D俯视" @click="setCameraMode('top')">2D</button>
          <button type="button" title="楼层图层">
            <BlockOutlined />
          </button>
          <div class="zoom-box">
            <button type="button" title="放大" @click="twinScene?.zoom(1)">
              <PlusOutlined />
            </button>
            <button type="button" title="缩小" @click="twinScene?.zoom(-1)">
              <MinusOutlined />
            </button>
          </div>
        </div>

        <nav class="tool-dock">
          <button type="button" :class="{ active: filterOpen }" @click="filterOpen = !filterOpen">
            <FilterOutlined />
            <span>设备筛选</span>
          </button>
          <button type="button" :class="{ active: replayPanelOpen }" @click="replayPanelOpen = !replayPanelOpen">
            <AimOutlined />
            <span>轨迹回放</span>
          </button>
          <button type="button" @click="viewMode = 'thermal'">
            <HeatMapOutlined />
            <span>热力图</span>
          </button>
          <button type="button" @click="wallTagsVisible = !wallTagsVisible; twinScene?.toggleWallTags(wallTagsVisible)">
            <BorderOuterOutlined />
            <span>电子围栏</span>
          </button>
          <button type="button" @click="measureEnabled = !measureEnabled">
            <ColumnWidthOutlined />
            <span>测距工具</span>
          </button>
          <button type="button" @click="clearTrails">
            <ClearOutlined />
            <span>清除轨迹</span>
          </button>
        </nav>

        <div v-if="filterOpen" class="floating-popover filter-popover">
          <label v-for="device in deviceOptions" :key="device">
            <input v-model="selectedDevices" type="checkbox" :value="device" />
            <span>{{ device }}</span>
          </label>
        </div>
      </section>

      <aside v-if="replayPanelOpen" class="right-rail">
        <section class="glass-panel replay-form">
          <h2>轨迹回放</h2>
          <label>
            <span>人员/设备</span>
            <select v-model="selectedReplayDevice">
              <option v-for="device in deviceOptions" :key="device" :value="device">{{ device }}</option>
            </select>
          </label>
          <label>
            <span>开始时间</span>
            <input v-model="replayStart" type="datetime-local" />
          </label>
          <label>
            <span>结束时间</span>
            <input v-model="replayEnd" type="datetime-local" />
          </label>
          <div class="replay-actions">
            <button type="button" class="primary-button" @click="startReplay">开始回放</button>
            <button type="button" class="ghost-button" @click="clearReplay">清除回放</button>
          </div>
        </section>

        <section class="glass-panel player-card">
          <p>轨迹时长：{{ replayDuration }}</p>
          <div class="player-controls">
            <button type="button" title="上一段">
              <StepBackwardOutlined />
            </button>
            <button type="button" class="play-button" title="播放/暂停" @click="replayPlaying = !replayPlaying">
              <PauseCircleOutlined v-if="replayPlaying" />
              <PlayCircleOutlined v-else />
            </button>
            <button type="button" title="下一段">
              <StepForwardOutlined />
            </button>
          </div>
          <div class="progress-row">
            <input v-model.number="replayProgress" type="range" min="0" max="100" />
            <span>{{ replaySpeed }}x</span>
          </div>
          <div class="timeline">
            <article v-for="item in timeline" :key="item.time" class="timeline-item">
              <i :class="{ green: item.type === 'start' || item.type === 'current' }" />
              <time>{{ item.time }}</time>
              <div>
                <strong>{{ item.title }}</strong>
                <span>{{ item.place }}</span>
              </div>
            </article>
          </div>
        </section>
      </aside>
    </section>

    <footer class="beian-footer">
      <img :src="footerGaIcon" alt="" class="beian-footer__icon" />
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
        苏ICP备2026022812号
      </a>
    </footer>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  AimOutlined,
  BlockOutlined,
  BorderOuterOutlined,
  ClearOutlined,
  ColumnWidthOutlined,
  CompassOutlined,
  FilterOutlined,
  HeatMapOutlined,
  MinusOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SettingOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
} from '@ant-design/icons-vue';
import * as echarts from 'echarts';
import type { ECharts, EChartsOption } from 'echarts';
import footerGaIcon from '@/assets/image/footer_ga-1.png';
import { useSceneStore } from '@/stores/scene';
import { MqttPoseClient, type MqttConnectionError, type MqttConnectionStatus } from '@/services/mqttPose';
import { TwinScene, type LivePose, type PickPointResult } from '@/three/TwinScene';

const sceneStore = useSceneStore();
const sceneContainer = ref<HTMLDivElement | null>(null);
const areaChartContainer = ref<HTMLDivElement | null>(null);
const pickedPoint = ref<PickPointResult | null>(null);
const wallTagsVisible = ref(false);
const livePose = ref<LivePose | null>(null);
const mqttStatus = ref<MqttConnectionStatus>('connecting');
const mqttError = ref<MqttConnectionError | null>(null);
const currentTime = ref(formatClock(new Date()));
const cameraMode = ref<'overview' | 'top' | 'side'>('overview');
const viewMode = ref('monitor');
const filterOpen = ref(false);
const replayPanelOpen = ref(true);
const replayPlaying = ref(true);
const replayProgress = ref(42);
const replaySpeed = ref(1.0);
const selectedReplayDevice = ref('TAG-10086');
const selectedDevices = ref(['TAG-10086', 'TAG-10001', 'TAG-10004']);
const replayStart = ref('2024-05-20T00:00');
const replayEnd = ref('2024-05-20T23:59');
const measureEnabled = ref(false);

let twinScene: TwinScene | null = null;
let mqttClient: MqttPoseClient | null = null;
let areaChart: ECharts | null = null;
let clockTimer = 0;

const deviceOptions = ['TAG-10086', 'TAG-10001', 'TAG-10002', 'TAG-10003', 'TAG-10004', 'TAG-10021'];
const totalDevices = 156;
const areaStats = [
  { name: '办公区', count: 8, percent: 66.7, color: '#247cff' },
  { name: '会议室', count: 2, percent: 16.7, color: '#2ed878' },
  { name: '休息区', count: 1, percent: 8.3, color: '#ffc233' },
  { name: '走廊', count: 1, percent: 8.3, color: '#8a62ff' },
  { name: '其他区域', count: 0, percent: 0, color: '#d455ff' },
];
const events = [
  { title: '重点区域入侵', device: 'TAG-10086', time: '10:29:45', level: 'danger', icon: '!' },
  { title: '人员 SOS 求救', device: 'TAG-10021', time: '10:28:12', level: 'info', icon: 'SOS' },
  { title: '人员跌倒', device: 'TAG-10015', time: '10:25:18', level: 'purple', icon: '人' },
  { title: '设备低电量', device: 'TAG-10032', time: '10:20:33', level: 'warn', icon: '电' },
  { title: '越界告警', device: 'TAG-10042', time: '10:15:27', level: 'alarm', icon: '!' },
];
const timeline = [
  { time: '10:30:45', title: '当前位置', place: '办公区-工位区A', type: 'current' },
  { time: '10:28:12', title: '经过', place: '会议室2门口', type: 'point' },
  { time: '10:25:18', title: '经过', place: '走廊转角', type: 'point' },
  { time: '10:20:33', title: '经过', place: '办公区-工位区B', type: 'point' },
  { time: '10:15:27', title: '起点', place: '办公区-工位区C', type: 'start' },
];

const onlineDevices = computed(() => (livePose.value ? 12 : 11));
const replayDuration = computed(() => (replayPlaying.value ? '2小时35分钟' : '已暂停'));

const mqttStatusText = computed(() => {
  if (mqttStatus.value === 'connected') {
    return '已连接';
  }

  if (mqttStatus.value === 'error') {
    return mqttError.value?.closeCode ? `重连中 ${mqttError.value.closeCode}` : '重连中';
  }

  if (mqttStatus.value === 'disconnected') {
    return '已断开';
  }

  return '连接中';
});

function formatClock(date: Date): string {
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function resolveMqttWebSocketUrl(): string {
  const configuredUrl = import.meta.env.VITE_MQTT_WS_URL?.trim();
  return configuredUrl || 'ws://111.229.115.131:8080';
}

function createAreaChartOption(): EChartsOption {
  return {
    color: areaStats.map((item) => item.color),
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: 'rgba(5, 18, 33, 0.94)',
      borderColor: 'rgba(105, 167, 232, 0.36)',
      textStyle: {
        color: '#e9f4ff',
        fontSize: 12,
      },
      formatter: (params) => {
        const item = (Array.isArray(params) ? params[0] : params) as {
          name?: string;
          value?: number | string;
          percent?: number;
        };
        return `${item.name ?? ''}<br/>在线设备：${item.value ?? 0}<br/>占比：${item.percent ?? 0}%`;
      },
    },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '38%',
        silent: true,
        style: {
          text: '区域分布',
          fill: 'rgba(226, 239, 249, 0.74)',
          fontSize: 12,
          align: 'center',
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '49%',
        silent: true,
        style: {
          text: `${onlineDevices.value}`,
          fill: '#2e87ff',
          fontSize: 25,
          fontWeight: 800,
          align: 'center',
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '64%',
        silent: true,
        style: {
          text: '在线设备',
          fill: 'rgba(226, 239, 249, 0.74)',
          fontSize: 12,
          align: 'center',
        },
      },
    ],
    series: [
      {
        name: '区域统计',
        type: 'pie',
        radius: ['64%', '86%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        minAngle: 4,
        padAngle: 2,
        animationType: 'scale',
        animationEasing: 'elasticOut',
        animationDelay: (index: number) => index * 90,
        label: {
          show: false,
        },
        labelLine: {
          show: false,
        },
        itemStyle: {
          borderColor: '#071527',
          borderWidth: 3,
        },
        emphasis: {
          scale: true,
          scaleSize: 8,
          itemStyle: {
            shadowBlur: 18,
            shadowColor: 'rgba(47, 134, 255, 0.42)',
          },
        },
        data: areaStats.map((item) => ({
          name: item.name,
          value: item.count,
        })),
      },
    ],
  };
}

function renderAreaChart() {
  if (!areaChartContainer.value) {
    return;
  }

  areaChart ??= echarts.init(areaChartContainer.value, undefined, { renderer: 'canvas' });
  areaChart.setOption(createAreaChartOption());
}

function resizeAreaChart() {
  areaChart?.resize();
}

function applyCameraMode() {
  twinScene?.setCameraView(cameraMode.value);
}

function setCameraMode(mode: 'overview' | 'top' | 'side') {
  cameraMode.value = mode;
  applyCameraMode();
}

function clearTrails() {
  twinScene?.clearAllTrails();
  replayProgress.value = 0;
}

function startReplay() {
  replayPanelOpen.value = true;
  replayPlaying.value = true;
  replayProgress.value = 42;
}

function clearReplay() {
  replayPlaying.value = false;
  clearTrails();
}

onMounted(() => {
  clockTimer = window.setInterval(() => {
    currentTime.value = formatClock(new Date());
  }, 1000);
  renderAreaChart();
  window.addEventListener('resize', resizeAreaChart);

  if (!sceneContainer.value) {
    return;
  }

  twinScene = new TwinScene(sceneContainer.value, sceneStore.config, (point) => {
    pickedPoint.value = point;
  });
  twinScene.init();
  twinScene.toggleWallTags(wallTagsVisible.value);

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
  window.clearInterval(clockTimer);
  window.removeEventListener('resize', resizeAreaChart);
  areaChart?.dispose();
  areaChart = null;
  mqttClient?.disconnect();
  mqttClient = null;
  twinScene?.destroy();
  twinScene = null;
});

watch(onlineDevices, () => {
  renderAreaChart();
});
</script>

<style scoped>
.twin-screen {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(4, 18, 32, 0.72), rgba(4, 11, 20, 0.94)),
    radial-gradient(circle at 50% 38%, rgba(45, 120, 190, 0.24), transparent 34%),
    #06111e;
  color: #e9f4ff;
}

.topbar {
  position: relative;
  z-index: 5;
  flex: 0 0 64px;
  display: flex;
  align-items: center;
  gap: 22px;
  height: 64px;
  padding: 0 26px;
  border-bottom: 1px solid rgba(92, 151, 213, 0.2);
  background: rgba(5, 18, 31, 0.86);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.24);
}

.topbar__brand {
  color: #fff;
  font-size: 21px;
  font-weight: 800;
}

.topbar__status {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(226, 239, 252, 0.82);
  font-size: 14px;
}

.topbar__status strong {
  color: #fff;
  font-weight: 600;
}

.topbar__mqtt {
  color: rgba(212, 230, 246, 0.72);
  font-size: 12px;
}

.topbar__spacer {
  flex: 1;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f8c84c;
  box-shadow: 0 0 12px currentColor;
}

.status-dot--connected {
  color: #27e29a;
  background: #27e29a;
}

.status-dot--error {
  color: #ffbf4d;
  background: #ffbf4d;
}

.status-dot--disconnected {
  color: #8998aa;
  background: #8998aa;
}

.select-field {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(224, 238, 250, 0.86);
  font-size: 13px;
}

.select-field select,
.replay-form select,
.replay-form input {
  height: 36px;
  min-width: 128px;
  border: 1px solid rgba(83, 153, 224, 0.26);
  border-radius: 6px;
  background: rgba(3, 18, 32, 0.9);
  color: #dfefff;
  outline: none;
}

.icon-button,
.map-controls button,
.tool-dock button,
.player-controls button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(105, 167, 232, 0.26);
  background: rgba(8, 26, 45, 0.78);
  color: #eef8ff;
  cursor: pointer;
}

.icon-button {
  width: 36px;
  height: 36px;
  border-radius: 6px;
}

.workspace {
  position: relative;
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 292px;
  gap: 18px;
  min-height: 0;
  overflow: hidden;
  padding: 14px 20px;
}

.beian-footer {
  position: relative;
  z-index: 20;
  flex: 0 0 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-top: 1px solid rgba(92, 151, 213, 0.16);
  background: rgba(5, 18, 31, 0.78);
  font-size: 12px;
  line-height: 1.4;
}

.beian-footer__icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.beian-footer a {
  color: rgba(226, 239, 252, 0.88);
  text-decoration: none;
}

.beian-footer a:hover {
  color: #fff;
}

.left-rail,
.right-rail {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  min-height: 0;
}

.glass-panel {
  overflow: hidden;
  border: 1px solid rgba(80, 145, 205, 0.28);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(8, 28, 49, 0.92), rgba(5, 18, 33, 0.86));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 18px 42px rgba(0, 0, 0, 0.22);
}

.glass-panel h2 {
  margin: 0;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(85, 145, 206, 0.18);
  color: #fff;
  font-size: 15px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 12px 14px 18px;
}

.metric-grid div {
  min-height: 78px;
  padding: 12px 14px;
  border: 1px solid rgba(82, 149, 218, 0.24);
  border-radius: 6px;
  background: rgba(4, 17, 33, 0.72);
}

.metric-grid strong {
  display: block;
  color: #22d886;
  font-size: 32px;
  line-height: 1;
}

.metric-grid__blue {
  color: #2f86ff !important;
}

.metric-grid span {
  display: block;
  margin-top: 8px;
  color: rgba(218, 232, 244, 0.74);
  font-size: 13px;
}

.area-card {
  flex: 1;
  min-height: 0;
}

.donut-wrap {
  display: flex;
  justify-content: center;
  padding: 24px 0 12px;
}

.area-chart {
  width: 156px;
  height: 156px;
}

.area-list {
  display: grid;
  gap: 9px;
  padding: 0 18px 18px;
}

.area-row {
  display: grid;
  grid-template-columns: 10px 1fr auto;
  align-items: center;
  gap: 9px;
  color: rgba(223, 236, 248, 0.78);
  font-size: 13px;
}

.area-row i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.area-row strong {
  color: rgba(235, 245, 255, 0.86);
  font-weight: 500;
}

.panel-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(85, 145, 206, 0.18);
}

.panel-title-row h2 {
  border: 0;
}

.panel-title-row button {
  margin-right: 14px;
  border: 0;
  background: transparent;
  color: #2f86ff;
  cursor: pointer;
}

.event-list {
  display: grid;
  gap: 12px;
  overflow: auto;
  padding: 12px 16px 16px;
}

.event-item {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.event-item__icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #2e86ff;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
}

.event-item__icon--danger {
  background: #ff5353;
}

.event-item__icon--purple {
  background: #8a62ff;
}

.event-item__icon--warn {
  background: #ff7548;
}

.event-item__icon--alarm {
  background: #ffc23d;
}

.event-item strong,
.timeline-item strong {
  display: block;
  color: #f3f9ff;
  font-size: 13px;
}

.event-item small,
.event-item time,
.timeline-item span {
  color: rgba(220, 234, 247, 0.66);
  font-size: 12px;
}

.scene-shell {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.scene-canvas {
  width: 100%;
  height: 100%;
}

.pick-chip {
  position: absolute;
  top: 16px;
  left: 50%;
  display: flex;
  gap: 10px;
  transform: translateX(-50%);
  padding: 8px 12px;
  border: 1px solid rgba(104, 169, 232, 0.3);
  border-radius: 6px;
  background: rgba(5, 19, 34, 0.82);
  color: rgba(220, 234, 246, 0.76);
  font-size: 12px;
}

.pick-chip strong {
  color: #8bdcff;
}

.map-controls {
  position: absolute;
  right: 16px;
  bottom: 100px;
  display: grid;
  gap: 8px;
}

.map-controls button {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  font-weight: 800;
}

.zoom-box {
  display: grid;
  overflow: hidden;
  border: 1px solid rgba(105, 167, 232, 0.26);
  border-radius: 6px;
}

.zoom-box button {
  border: 0;
  border-radius: 0;
}

.tool-dock {
  position: absolute;
  left: 50%;
  bottom: 8px;
  display: grid;
  grid-template-columns: repeat(6, 92px);
  transform: translateX(-50%);
  border: 1px solid rgba(80, 145, 205, 0.34);
  border-radius: 6px;
  background: rgba(5, 18, 33, 0.8);
}

.tool-dock button {
  flex-direction: column;
  gap: 7px;
  height: 76px;
  border: 0;
  border-right: 1px solid rgba(80, 145, 205, 0.16);
  background: transparent;
  color: rgba(225, 238, 250, 0.82);
  font-size: 12px;
}

.tool-dock button:last-child {
  border-right: 0;
}

.tool-dock button.active,
.tool-dock button:hover {
  color: #4ea3ff;
  background: rgba(47, 134, 255, 0.1);
}

.floating-popover {
  position: absolute;
  left: 50%;
  bottom: 92px;
  display: grid;
  gap: 8px;
  width: 180px;
  padding: 12px;
  transform: translateX(-300px);
  border: 1px solid rgba(80, 145, 205, 0.34);
  border-radius: 6px;
  background: rgba(5, 18, 33, 0.94);
}

.floating-popover label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(226, 239, 250, 0.8);
  font-size: 13px;
}

.replay-form {
  padding-bottom: 14px;
}

.replay-form label {
  display: grid;
  gap: 8px;
  padding: 10px 14px 0;
  color: rgba(226, 239, 250, 0.82);
  font-size: 13px;
}

.replay-form select,
.replay-form input {
  width: 100%;
}

.replay-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 18px 14px 0;
}

.primary-button,
.ghost-button {
  height: 36px;
  border: 0;
  border-radius: 6px;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.primary-button {
  background: #247cff;
}

.ghost-button {
  background: rgba(124, 139, 156, 0.45);
}

.player-card {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px;
}

.player-card p {
  margin: 0 0 16px;
  color: rgba(229, 241, 252, 0.86);
  font-size: 13px;
}

.player-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
}

.player-controls button {
  width: 34px;
  height: 34px;
  border: 0;
  background: transparent;
  font-size: 18px;
}

.player-controls .play-button {
  width: 46px;
  height: 46px;
  border: 1px solid rgba(171, 210, 248, 0.5);
  border-radius: 50%;
  font-size: 28px;
}

.progress-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px;
  align-items: center;
  gap: 8px;
  margin: 12px 0 24px;
  color: #fff;
  font-size: 12px;
}

.progress-row input {
  accent-color: #247cff;
}

.timeline {
  display: grid;
  gap: 18px;
}

.timeline-item {
  position: relative;
  display: grid;
  grid-template-columns: 12px 62px 1fr;
  gap: 10px;
}

.timeline-item::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 14px;
  bottom: -22px;
  width: 1px;
  background: rgba(70, 132, 201, 0.5);
}

.timeline-item:last-child::before {
  display: none;
}

.timeline-item i {
  position: relative;
  z-index: 1;
  width: 9px;
  height: 9px;
  margin-top: 4px;
  border-radius: 50%;
  background: #2d7cff;
}

.timeline-item i.green {
  background: #27d57d;
}

.timeline-item time {
  color: rgba(235, 245, 255, 0.84);
  font-size: 12px;
}

@media (max-width: 1280px) {
  .workspace {
    grid-template-columns: 280px minmax(0, 1fr);
  }

  .right-rail {
    position: absolute;
    top: 14px;
    right: 20px;
    bottom: 28px;
    width: 292px;
  }
}

@media (max-width: 980px) {
  .workspace {
    grid-template-columns: 1fr;
    padding: 10px;
  }

  .left-rail,
  .right-rail {
    display: none;
  }

  .topbar {
    gap: 12px;
    padding: 0 12px;
  }

  .select-field {
    display: none;
  }

  .tool-dock {
    grid-template-columns: repeat(3, 86px);
  }
}
</style>

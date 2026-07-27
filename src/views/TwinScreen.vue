<template>
  <main :class="['twin-screen', `twin-screen--${themeMode ?? 'dark'}`, { 'twin-screen--embedded': embedded }]">
    <header class="topbar">
      <div class="topbar__status">
        <span>{{ t('dashboard.realtimeUpdate') }}</span>
        <strong>{{ currentTime }}</strong>
        <span :class="['status-dot', `status-dot--${mqttStatus}`]" />
        <span class="topbar__mqtt">{{ mqttStatusText }}</span>
      </div>
      <div class="topbar__spacer" />
      <label class="select-field">
        <span>{{ t('dashboard.view3D') }}</span>
        <select v-model="cameraMode" @change="applyCameraMode">
          <option value="overview">{{ t('dashboard.overview') }}</option>
          <option value="top">{{ t('dashboard.top') }}</option>
          <option value="side">{{ t('dashboard.side') }}</option>
        </select>
      </label>
      <label class="select-field">
        <span>{{ t('dashboard.viewMode') }}</span>
        <select v-model="viewMode" @change="applyViewMode">
          <option value="monitor">{{ t('dashboard.monitor') }}</option>
          <option value="replay">{{ t('dashboard.replay') }}</option>
          <option value="thermal">{{ t('dashboard.thermal') }}</option>
        </select>
      </label>
      <label class="select-field">
        <span>{{ t('dashboard.floorSwitch') }}</span>
        <select v-model="selectedFloorId" :disabled="floorOptions.length <= 1" @change="applyFloorSwitch">
          <option v-for="floor in floorOptions" :key="floor.id" :value="floor.id">{{ floor.name }}</option>
        </select>
      </label>
      <button type="button" class="icon-button" :title="t('common.settings')">
        <SettingOutlined />
      </button>
    </header>

    <section :class="['workspace', workspaceClass]">
      <aside class="left-rail">
        <section class="glass-panel dashboard-card">
          <h2>{{ t('dashboard.realtimeOverview') }}</h2>
          <div class="dashboard-stats-row">
            <div class="stat-pill">
              <strong>{{ onlineDevices }}</strong>
              <span>{{ t('dashboard.onlineDevices') }}</span>
            </div>
            <div class="stat-pill stat-pill--blue">
              <strong>{{ totalDevices }}</strong>
              <span>{{ t('dashboard.totalDevices') }}</span>
            </div>
          </div>
          <div class="donut-wrap">
            <div ref="areaChartContainer" class="area-chart" />
          </div>
          <div class="area-list">
            <div v-for="item in sortedAreaStats" :key="item.name" class="area-row">
              <i :style="{ backgroundColor: item.color }" />
              <span>{{ item.name }}</span>
              <strong>{{ item.count }} ({{ item.percent }}%)</strong>
            </div>
          </div>
        </section>

        <section class="glass-panel event-card">
          <div class="panel-title-row">
            <h2>{{ t('dashboard.eventCenterTitle') }}</h2>
            <button type="button" @click="$emit('show-events')">{{ t('dashboard.allEvents') }}</button>
          </div>
          <div class="event-list">
            <article v-for="event in events" :key="event.title" class="event-item">
              <span :class="['event-item__icon', `event-item__icon--${event.level}`]">{{ event.icon }}</span>
              <div>
                <strong>{{ event.title }}</strong>
                <small>{{ t('dashboard.deviceLabel', { device: event.device }) }}</small>
              </div>
              <time>{{ event.time }}</time>
            </article>
          </div>
        </section>
      </aside>

      <section class="scene-shell">
        <div ref="sceneContainer" class="scene-canvas" />
      </section>

      <div v-if="pickedPoint" class="pick-chip">
        <span>{{ t('dashboard.sceneCoord') }}</span>
        <strong>X {{ pickedPoint.scene.x }} / Z {{ pickedPoint.scene.z }}</strong>
      </div>

      <div class="map-controls">
        <button type="button" :title="t('dashboard.compass')" @click="twinScene?.setCameraView('overview')">
          <CompassOutlined />
        </button>
        <button type="button" :title="t('dashboard.top2D')" @click="setCameraMode('top')">2D</button>
        <div class="zoom-box">
          <button type="button" :title="t('dashboard.zoomIn')" @click="twinScene?.zoom(1)">
            <PlusOutlined />
          </button>
          <button type="button" :title="t('dashboard.zoomOut')" @click="twinScene?.zoom(-1)">
            <MinusOutlined />
          </button>
        </div>
      </div>

      <nav class="tool-dock">
        <button type="button" :class="{ active: filterOpen }" @click="filterOpen = !filterOpen">
          <FilterOutlined />
          <span>{{ t('dashboard.deviceFilter') }}</span>
        </button>
        <button type="button" :class="{ active: replayPanelOpen }" @click="toggleReplayMode">
          <AimOutlined />
          <span>{{ t('dashboard.trackReplay') }}</span>
        </button>
        <button type="button" @click="viewMode = 'thermal'">
          <HeatMapOutlined />
          <span>{{ t('dashboard.heatmap') }}</span>
        </button>
        <button type="button" :class="{ active: fencesVisible }" @click="fencesVisible = !fencesVisible; twinScene?.toggleFences(fencesVisible)">
          <BorderOuterOutlined />
          <span>{{ t('dashboard.fence') }}</span>
        </button>
        <button
          type="button"
          :class="{ active: livePoseLabelsVisible }"
          @click="livePoseLabelsVisible = !livePoseLabelsVisible; twinScene?.toggleLivePoseLabels(livePoseLabelsVisible)"
        >
          <TagsOutlined />
          <span>{{ t('dashboard.poseLabels') }}</span>
        </button>
        <button
          type="button"
          :class="{ active: trailsVisible }"
          @click="trailsVisible = !trailsVisible; twinScene?.setTrailsVisible(trailsVisible)"
        >
          <DeploymentUnitOutlined />
          <span>{{ t('dashboard.trailDisplay') }}</span>
        </button>
        <button type="button" @click="clearTrails">
          <ClearOutlined />
          <span>{{ t('dashboard.clearTrail') }}</span>
        </button>
      </nav>

      <div v-if="replayFrameTimes.length > 1" class="replay-progress-dock">
        <div v-if="replayLoadStatus" class="replay-load-status" :class="{ buffering: replayBuffering }">
          {{ replayLoadStatus }}
        </div>
        <div class="progress-row">
          <input
            v-model.number="replayProgress"
            type="range"
            min="0"
            max="100"
            step="0.1"
            :disabled="replayProgressDisabled"
            @input="seekReplay"
          />
          <span>{{ replaySpeed }}x</span>
        </div>
        <div class="progress-time">{{ replayTimeText }}</div>
        <div class="player-controls">
          <button
            type="button"
            title="长按后退1秒"
            @pointerdown.prevent="startReplayNudge(-1)"
            @pointerup="stopReplayNudge"
            @pointerleave="stopReplayNudge"
            @pointercancel="stopReplayNudge"
            @contextmenu.prevent
          >
            <StepBackwardOutlined />
          </button>
          <button type="button" class="play-button" title="播放/暂停" @click="toggleReplayPlaying">
            <PauseCircleOutlined v-if="replayPlaying" />
            <PlayCircleOutlined v-else />
          </button>
          <button
            type="button"
            title="长按前进1秒"
            @pointerdown.prevent="startReplayNudge(1)"
            @pointerup="stopReplayNudge"
            @pointerleave="stopReplayNudge"
            @pointercancel="stopReplayNudge"
            @contextmenu.prevent
          >
            <StepForwardOutlined />
          </button>
        </div>
      </div>

      <div v-if="filterOpen" class="floating-popover filter-popover">
        <div class="filter-popover__header">
          <strong>{{ t('dashboard.deviceFilter') }}</strong>
          <span>{{ t('dashboard.deviceFilterCount', { selected: selectedDevices.length, total: deviceOptions.length }) }}</span>
        </div>
        <input
          v-model.trim="deviceFilterKeyword"
          class="filter-search"
          type="search"
          :placeholder="t('dashboard.deviceFilterSearch')"
        />
        <div class="filter-list">
          <label v-for="device in filteredDeviceOptions" :key="device">
            <input v-model="selectedDevices" type="checkbox" :value="device" />
            <span>{{ device }}</span>
          </label>
          <p v-if="filteredDeviceOptions.length === 0" class="filter-empty">{{ t('dashboard.noDeviceMatch') }}</p>
        </div>
        <div class="filter-actions">
          <button type="button" @click="cancelDeviceFilter">{{ t('dashboard.cancelDeviceFilter') }}</button>
          <button type="button" @click="clearDeviceFilter">{{ t('dashboard.clearDeviceSelection') }}</button>
        </div>
      </div>

      <aside v-if="replayPanelOpen" class="right-rail">
        <section class="glass-panel replay-form">
          <h2>{{ t('dashboard.replayTitle') }}</h2>
          <label>
            <span>{{ t('dashboard.personDevice') }}</span>
            <select v-model="selectedReplayDevice" @change="applyReplayDeviceSelection">
              <option v-for="device in replayDeviceOptions" :key="device.value" :value="device.value">{{ device.label }}</option>
            </select>
          </label>
          <label>
            <span>{{ t('dashboard.replayDate') }}</span>
            <input v-model="replayDate" type="date" @change="searchReplayForSelectedTime" />
          </label>
          <label>
            <span>{{ t('dashboard.timeRange') }}</span>
            <button type="button" class="time-range-button" @click="openReplayRangePicker">
              {{ replayRangeText }}
            </button>
          </label>
          <div class="replay-actions">
            <button type="button" class="primary-button" :disabled="replayLoading" @click="startReplay()">
              {{ replayLoading ? t('dashboard.loading') : t('dashboard.startReplay') }}
            </button>
            <button type="button" class="ghost-button" @click="exitReplayMode">{{ t('dashboard.backToLive') }}</button>
          </div>
          <p v-if="replayError" class="replay-error">{{ replayError }}</p>
        </section>

        <section class="glass-panel player-card">
          <p>{{ t('dashboard.replayDuration') }}{{ replayDuration }}</p>
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

      <div v-if="replayRangePickerOpen" class="range-modal-backdrop" @click.self="cancelReplayRangePicker">
        <section class="range-modal" role="dialog" aria-modal="true" aria-labelledby="replay-range-title">
          <header>
            <h2 id="replay-range-title">{{ t('dashboard.selectReplayRange') }}</h2>
            <button type="button" class="range-modal__close" :title="t('common.close')" @click="cancelReplayRangePicker">×</button>
          </header>
          <div class="day-clock" :style="clockRangeStyle">
            <span>00:00</span>
            <strong>{{ draftReplayRangeText }}</strong>
            <span>24:00</span>
          </div>
          <div class="range-slider" :style="rangeSliderStyle">
            <input
              v-model.number="draftReplayTimeRange[0]"
              type="range"
              min="0"
              :max="DAY_SECONDS"
              :step="TIME_RANGE_STEP_SECONDS"
              aria-label="开始时间"
              @input="normalizeDraftReplayRange('start')"
            />
            <input
              v-model.number="draftReplayTimeRange[1]"
              type="range"
              min="0"
              :max="DAY_SECONDS"
              :step="TIME_RANGE_STEP_SECONDS"
              aria-label="结束时间"
              @input="normalizeDraftReplayRange('end')"
            />
          </div>
          <div class="range-quick-actions">
            <button type="button" @click="setDraftReplayRange(0, DAY_SECONDS)">{{ t('common.allDay') }}</button>
            <button type="button" @click="setDraftReplayRange(8 * 3600, 12 * 3600)">{{ t('common.morning') }}</button>
            <button type="button" @click="setDraftReplayRange(12 * 3600, 18 * 3600)">{{ t('common.afternoon') }}</button>
            <button type="button" @click="setDraftReplayRange(18 * 3600, DAY_SECONDS)">{{ t('common.night') }}</button>
          </div>
          <footer>
            <button type="button" class="ghost-button" @click="cancelReplayRangePicker">{{ t('common.cancel') }}</button>
            <button type="button" class="primary-button" @click="confirmReplayRangePicker">{{ t('common.confirm') }}</button>
          </footer>
        </section>
      </div>
    </section>

    
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AimOutlined,
  BorderOuterOutlined,
  ClearOutlined,
  CompassOutlined,
  DeploymentUnitOutlined,
  FilterOutlined,
  HeatMapOutlined,
  MinusOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SettingOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  TagsOutlined,
} from '@ant-design/icons-vue';
import * as echarts from 'echarts';
import type { ECharts, EChartsOption } from 'echarts';

import { useSceneStore } from '@/stores/scene';
import { MqttPoseClient, type MqttConnectionError, type MqttConnectionStatus } from '@/services/mqttPose';
import { fetchTrajectoryPoints } from '@/services/trajectoryService';
import { getAllAlertMessage, type AlertEvent } from '@/services/alert';
import { cloneSceneConfig, getMapLibrary, saveMapLibrary, type SavedMap } from '@/services/mapLibrary';
import { TwinScene, clearModelTemplateCache, type LivePose, type PathPoint, type PickPointResult } from '@/three/TwinScene';

const props = defineProps<{
  embedded?: boolean;
  themeMode?: 'dark' | 'light';
}>();

defineEmits<{
  'show-events': [];
}>();

interface ReplayPoint extends PathPoint {
  deviceId: string;
  time: number;
  theta?: number;
}

const ALL_REPLAY_DEVICES = '__all__';
const REPLAY_MAX_FRAMES = 600;
const REPLAY_PAGE_LIMIT = 10000;
const REPLAY_BUFFER_AHEAD_MS = 30 * 1000;
const REPLAY_DATA_GAP_MS = 30 * 1000;
const REPLAY_SCAN_INITIAL_MS = 10 * 60 * 1000;
const REPLAY_SCAN_MAX_MS = 2 * 60 * 60 * 1000;
const AREA_CLUSTER_THRESHOLD = 3;
const REPLAY_NUDGE_STEP_MS = 1000;
const REPLAY_NUDGE_INTERVAL_MS = 160;
const DAY_SECONDS = 24 * 60 * 60;
const TIME_RANGE_STEP_SECONDS = 60;

const { t } = useI18n();
const sceneStore = useSceneStore();
const sceneContainer = ref<HTMLDivElement | null>(null);
const areaChartContainer = ref<HTMLDivElement | null>(null);
const pickedPoint = ref<PickPointResult | null>(null);
const fencesVisible = ref(false);
const livePoseLabelsVisible = ref(true);
const trailsVisible = ref(true);
const livePose = ref<LivePose | null>(null);
const mqttStatus = ref<MqttConnectionStatus>('connecting');
const mqttError = ref<MqttConnectionError | null>(null);
const currentTime = ref(formatClock(new Date()));
const cameraMode = ref<'overview' | 'top' | 'side'>('overview');
const viewMode = ref('monitor');
const selectedFloorId = ref(sceneStore.config.floor.id);
const filterOpen = ref(false);
const deviceFilterKeyword = ref('');
const replayPanelOpen = ref(false);
const replayPlaying = ref(false);
const replayProgress = ref(0);
const replayFrameIndex = ref(0);
const replayCurrentTime = ref(0);
const replayDirection = ref<1 | -1>(1);
const replaySpeed = ref(1.0);
const replayLoading = ref(false);
const replayBackgroundLoading = ref(false);
const replayBuffering = ref(false);
const replayError = ref('');
const replaySearchAttempted = ref(false);
const selectedReplayDevice = ref(ALL_REPLAY_DEVICES);
// 筛选设备列表（可选 自主添加选项）
const baseDeviceOptions: string[] = [];
const selectedDevices = ref([...baseDeviceOptions]);
const replayDate = ref(formatDateOnly(new Date()));
const FIVE_HOURS_SECONDS = 5 * 3600;
function getLastHoursRange(): [number, number] {
  const now = new Date();
  const end = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return [Math.max(0, end - FIVE_HOURS_SECONDS), end];
}
const replayTimeRange = ref<[number, number]>(getLastHoursRange());
const draftReplayTimeRange = ref<[number, number]>(getLastHoursRange());
const replayRangePickerOpen = ref(false);
const replayPoints = ref<ReplayPoint[]>([]);
const replayFrameTimes = ref<number[]>([]);
const replayRangeStart = ref(0);
const replayRangeEnd = ref(0);
const replayLoadedUntil = ref(0);
const replayLoadComplete = ref(false);

let twinScene: TwinScene | null = null;
let mqttClient: MqttPoseClient | null = null;
let areaChart: ECharts | null = null;
let clockTimer = 0;
let replayTimer = 0;
let replayNudgeTimer = 0;
let replayLoadToken = 0;
let replayLoadCursor = 0;
let replayScanWindowMs = REPLAY_SCAN_INITIAL_MS;
let replayResumeAfterBuffer = false;
const replayTracks = new Map<string, ReplayPoint[]>();
const latestLivePoses = new Map<string, LivePose>();
const livePoseVersion = ref(0);
const onlineDeviceCount = ref(0);
const replayOnlineCount = ref(0);

const deviceOptions = computed(() => {
  livePoseVersion.value;
  return [...new Set([...baseDeviceOptions, ...latestLivePoses.keys()])];
});
const filteredDeviceOptions = computed(() => {
  const keyword = deviceFilterKeyword.value.trim().toLowerCase();
  if (!keyword) return deviceOptions.value;
  return deviceOptions.value.filter((device) => device.toLowerCase().includes(keyword));
});
const replayDeviceOptions = computed(() => [
  { label: t('dashboard.allDevices'), value: ALL_REPLAY_DEVICES },
  ...deviceOptions.value.map((device) => ({ label: device, value: device })),
]);
const activeSavedMap = computed<SavedMap | null>(() => {
  sceneStore.activeMapId;
  return getMapLibrary().find((map) => map.id === sceneStore.activeMapId) ?? null;
});
const floorOptions = computed(() => {
  const floors = activeSavedMap.value?.metadata.floors ?? [];
  if (floors.length === 0) {
    return [{ id: sceneStore.config.floor.id, name: sceneStore.config.floor.name || t('dashboard.currentFloor') }];
  }

  return floors.map((floor) => ({
    id: floor.id,
    name: floor.name || floor.config.floor.name || floor.id,
  }));
});
const totalDevices = 30; // 设备总数，可从数据库动态更新

// 动态计算的区域统计
const areaStats = ref<Array<{ name: string; count: number; percent: number; color: string }>>([]);

const events = ref<AlertEvent[]>([]);
const displayOnlineCount = computed(() =>
  replayPanelOpen.value
    ? replayOnlineCount.value
    : onlineDeviceCount.value,
);
const onlineDevices = computed(() => displayOnlineCount.value);
const isLightTheme = computed(() => props.themeMode === 'light');
const chartTextColor = computed(() => (isLightTheme.value ? 'rgba(52, 65, 89, 0.72)' : 'rgba(226, 239, 249, 0.74)'));
const workspaceClass = computed(() => ({
  'workspace--replay-open': replayPanelOpen.value,
}));
const sortedAreaStats = computed(() =>
  [...areaStats.value].sort((a, b) => b.count - a.count),
);
const replayDuration = computed(() => {
  if (replayFrameTimes.value.length < 2) {
    return t('dashboard.noTrajectory');
  }

  const start = replayFrameTimes.value[0];
  const end = replayFrameTimes.value[replayFrameTimes.value.length - 1];
  return formatDuration(Math.max(0, end - start));
});

const currentReplayIndex = computed(() => {
  if (replayFrameTimes.value.length <= 1) {
    return 0;
  }

  return findReplayFrameIndexAtTime(replayCurrentTime.value || replayFrameTimes.value[0]);
});

const replayTimeText = computed(() => {
  if (replayFrameTimes.value.length === 0) {
    return '--:--:-- / --:--:--';
  }

  const current = replayCurrentTime.value || replayFrameTimes.value[0];
  const end = replayRangeEnd.value || replayFrameTimes.value[replayFrameTimes.value.length - 1];
  return `${formatClock(new Date(current))} / ${formatClock(new Date(end))}`;
});

const replayRangeText = computed(() => formatTimeRange(replayTimeRange.value));
const draftReplayRangeText = computed(() => formatTimeRange(draftReplayTimeRange.value));
const replayQueryText = computed(() => `${replayDate.value} ${replayRangeText.value}`);
const replayLoadStatus = computed(() => {
  if (replayBuffering.value) {
    return t('dashboard.loadingMore');
  }

  // 展示加载进度（仅后台或初始加载时）
  if (replayLoading.value || replayBackgroundLoading.value) {
    const totalRange = replayRangeEnd.value - replayRangeStart.value;
    const loadedRange = Math.min(replayLoadedUntil.value, replayRangeEnd.value) - replayRangeStart.value;
    if (totalRange > 0 && loadedRange > 0) {
      const pct = Math.min(100, Math.round((loadedRange / totalRange) * 100));
      return `${t('dashboard.loading')} ${pct}%`;
    }
    return t('dashboard.loading');
  }

  return '';
});
const replayProgressDisabled = computed(() => replayBuffering.value || replayFrameTimes.value.length < 2);
const rangeSliderStyle = computed(() => {
  const [start, end] = draftReplayTimeRange.value;
  return {
    '--range-start': `${(start / DAY_SECONDS) * 100}%`,
    '--range-end': `${(end / DAY_SECONDS) * 100}%`,
  };
});
const clockRangeStyle = computed(() => {
  const [start, end] = draftReplayTimeRange.value;
  const startDeg = (start / DAY_SECONDS) * 360;
  const endDeg = (end / DAY_SECONDS) * 360;
  return {
    '--clock-start': `${startDeg}deg`,
    '--clock-end': `${endDeg}deg`,
  };
});

const timeline = computed(() => {
  if (replayLoading.value) {
    return [{ id: 'searching', time: '--:--:--', title: t('dashboard.searching'), place: `${getReplayDeviceName()} · ${replayQueryText.value}`, type: 'current' }];
  }

  if (replayError.value) {
    return [{ id: 'error', time: '--:--:--', title: replayError.value, place: `${getReplayDeviceName()} · ${replayQueryText.value}`, type: 'point' }];
  }

  if (replayPoints.value.length === 0) {
    if (replaySearchAttempted.value) {
      return [{ id: 'empty-search', time: '--:--:--', title: t('dashboard.noResult'), place: `${getReplayDeviceName()} · ${replayQueryText.value}`, type: 'point' }];
    }

    return [{ id: '0', time: '--:--:--', title: t('dashboard.noTrajectory'), place: getReplayDeviceName(), type: 'point' }];
  }

  if (selectedReplayDevice.value === ALL_REPLAY_DEVICES) {
    const currentTime = replayFrameTimes.value[currentReplayIndex.value] ?? replayPoints.value[0].time;
    const clusters = getReplayClustersAtTime(currentTime);
    if (clusters.length > 0) {
      return clusters.map((cluster, index) => ({
        id: `${currentTime}-${index}`,
        time: formatClock(new Date(currentTime)),
        title: t('dashboard.cluster', { area: cluster.area }),
        place: t('dashboard.clusterDetail', { count: cluster.count }),
        type: 'current',
      }));
    }

    return [{ id: `${currentTime}-single`, time: formatClock(new Date(currentTime)), title: t('dashboard.normalDist'), place: t('dashboard.noCluster'), type: 'point' }];
  }

  const indexes = Array.from(new Set([0, currentReplayIndex.value, replayFrameTimes.value.length - 1])).sort((a, b) => b - a);
  return indexes.map((index) => {
    const time = replayFrameTimes.value[index] ?? replayPoints.value[0].time;
    const point = findReplayPointAtTime(replayPoints.value, time);
    const type = index === 0 ? 'start' : index === currentReplayIndex.value ? 'current' : 'point';
    return {
      id: `${time}-${index}`,
      time: formatClock(new Date(time)),
      title: type === 'start' ? t('dashboard.startPoint') : type === 'current' ? t('dashboard.currentPosition') : t('dashboard.passing'),
      place: `${point.deviceId} X ${point.x.toFixed(1)} / Z ${point.y.toFixed(1)}`,
      type,
    };
  });
});

const mqttStatusText = computed(() => {
  if (mqttStatus.value === 'connected') {
    return t('dashboard.connected');
  }

  if (mqttStatus.value === 'error') {
    return mqttError.value?.closeCode
      ? t('dashboard.reconnectingWithCode', { code: mqttError.value.closeCode })
      : t('dashboard.reconnecting');
  }

  if (mqttStatus.value === 'disconnected') {
    return t('dashboard.disconnected');
  }

  return t('dashboard.connecting');
});

function formatClock(date: Date): string {
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatSecondsOfDay(seconds: number): string {
  const safeSeconds = Math.max(0, Math.min(DAY_SECONDS, Math.round(seconds)));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours}`.padStart(2, '0') + ':' + `${minutes}`.padStart(2, '0');
}

function formatTimeRange(range: [number, number]): string {
  return `${formatSecondsOfDay(range[0])} - ${formatSecondsOfDay(range[1])}`;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}${t('dashboard.hours')}${minutes}${t('dashboard.minutes')}`;
  }

  if (minutes > 0) {
    return `${minutes}${t('dashboard.minutes')}${seconds}${t('dashboard.seconds')}`;
  }

  return `${seconds}${t('dashboard.seconds')}`;
}

function getReplayDeviceName(): string {
  return selectedReplayDevice.value === ALL_REPLAY_DEVICES ? t('dashboard.allDevices') : selectedReplayDevice.value;
}



function resolveMqttWebSocketUrl(): string {
  return import.meta.env.VITE_MQTT_WS_URL?.trim() || 'ws://user.deepfusionrobotics.cn:8080';
}

function createAreaChartOption(): EChartsOption {
  const hasData = areaStats.value.some((item) => item.count > 0);

  return {
    color: areaStats.value.map((item) => item.color),
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: isLightTheme.value ? 'rgba(255, 255, 255, 0.96)' : 'rgba(5, 18, 33, 0.94)',
      borderColor: isLightTheme.value ? 'rgba(78, 101, 140, 0.18)' : 'rgba(105, 167, 232, 0.36)',
      textStyle: { color: chartTextColor.value, fontSize: 12 },
      formatter: (params: unknown) => {
        const p = (Array.isArray(params) ? params[0] : params) as {
          name?: string;
          value?: number;
          percent?: number;
        };
        return `${p.name ?? ''}<br/>${t('dashboard.deviceCount')}：${p.value ?? 0}<br/>${t('dashboard.percent')}：${p.percent ?? 0}%`;
      },
    },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '34%',
        silent: true,
        style: {
          text: hasData ? t('dashboard.areaDist') : t('dashboard.noData'),
          fill: chartTextColor.value,
          fontSize: 14,
          fontWeight: 500,
          align: 'center',
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '46%',
        silent: true,
        style: {
          text: `${onlineDevices.value}`,
          fill: hasData ? '#2e87ff' : '#888888',
          fontSize: 44,
          fontWeight: 900,
          align: 'center',
          textShadowColor: hasData ? 'rgba(46, 135, 255, 0.4)' : 'transparent',
          textShadowBlur: 16,
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '62%',
        silent: true,
        style: {
          text: t('dashboard.online'),
          fill: chartTextColor.value,
          fontSize: 13,
          align: 'center',
        },
      },
    ],
    series: [
      {
        name: t('dashboard.areaStats'),
        type: 'pie',
        radius: ['55%', '80%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        minAngle: 0,
        padAngle: 0,
        itemStyle: {
          borderColor: isLightTheme.value ? '#f4f7fb' : '#071527',
          borderWidth: 1,
        },
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          disabled: true,
        },
        animationDuration: 600,
        animationDurationUpdate: 150,
        animationEasingUpdate: 'linear',
        data: hasData
          ? areaStats.value.map((item) => ({
              name: item.name,
              value: item.count,
            }))
          : [{ name: '', value: 1, itemStyle: { color: 'rgba(255,255,255,0.06)' } }],
      },
    ],
  };
}

function renderAreaChart() {
  if (!areaChartContainer.value) {
    return;
  }

  areaChart ??= echarts.init(areaChartContainer.value, undefined, { renderer: 'canvas' });
  areaChart.setOption(createAreaChartOption(), { notMerge: false });
}

function resizeAreaChart() {
  areaChart?.resize();
}

function applyCameraMode() {
  twinScene?.setCameraView(cameraMode.value);
}

function applyViewMode() {
  if (viewMode.value === 'replay') {
    if (!replayPanelOpen.value) {
      replayPanelOpen.value = true;
      replaySearchAttempted.value = false;
      replayError.value = '';
    }
    return;
  }

  if (viewMode.value === 'monitor') {
    if (replayPanelOpen.value || isReplayLoaded()) {
      exitReplayMode();
    }
    return;
  }
}

function applyFloorSwitch() {
  const targetFloorId = selectedFloorId.value;
  const activeMap = activeSavedMap.value;
  const targetFloor = activeMap?.metadata.floors.find((floor) => floor.id === targetFloorId);
  if (!activeMap || !targetFloor) {
    selectedFloorId.value = sceneStore.config.floor.id;
    return;
  }

  if (replayPanelOpen.value || isReplayLoaded()) {
    exitReplayMode();
  } else {
    resetReplayState();
  }
  replayPanelOpen.value = false;
  viewMode.value = 'monitor';

  sceneStore.setConfig(cloneSceneConfig(targetFloor.config));
  const nextMaps = getMapLibrary().map((map) =>
    map.id === activeMap.id
      ? {
          ...map,
          config: cloneSceneConfig(targetFloor.config),
          metadata: {
            ...map.metadata,
            activeFloorId: targetFloor.id,
            floor: targetFloor.name,
          },
        }
      : map,
  );
  saveMapLibrary(nextMaps);
}

function applyReplayDeviceSelection() {
  // 切换设备时先清除旧回放在场景中的残留标记和轨迹，避免新旧数据叠加
  const oldDeviceIds = getReplayDeviceIds();
  if (oldDeviceIds.length > 0 || replayPoints.value.length > 0) {
    clearReplayScene(oldDeviceIds);
  }

  resetReplayState()
  if (selectedReplayDevice.value === ALL_REPLAY_DEVICES) {
    twinScene?.setVisibleLivePoses(null);
    return;
  }

  twinScene?.focusLivePose(selectedReplayDevice.value);
  twinScene?.setVisibleLivePoses([selectedReplayDevice.value]);
}

function openReplayRangePicker() {
  draftReplayTimeRange.value = [...replayTimeRange.value];
  replayRangePickerOpen.value = true;
}

function cancelReplayRangePicker() {
  replayRangePickerOpen.value = false;
}

function confirmReplayRangePicker() {
  replayTimeRange.value = [...draftReplayTimeRange.value];
  replayRangePickerOpen.value = false;
  searchReplayForSelectedTime();
}

function searchReplayForSelectedTime() {
  // 选择时间范围后不自动加载，等待用户点击"开始回放"
  replaySearchAttempted.value = false;
  replayError.value = '';
}

function setDraftReplayRange(start: number, end: number) {
  draftReplayTimeRange.value = [start, end];
}

function normalizeDraftReplayRange(changed: 'start' | 'end') {
  const [start, end] = draftReplayTimeRange.value;
  if (changed === 'start' && start >= end) {
    draftReplayTimeRange.value = [Math.max(0, end - TIME_RANGE_STEP_SECONDS), end];
    return;
  }

  if (changed === 'end' && end <= start) {
    draftReplayTimeRange.value = [start, Math.min(DAY_SECONDS, start + TIME_RANGE_STEP_SECONDS)];
  }
}

function setCameraMode(mode: 'overview' | 'top' | 'side') {
  cameraMode.value = mode;
  applyCameraMode();
}

function resetReplayState() {
  replayLoadToken += 1;
  replayPlaying.value = false;
  replayLoading.value = false;
  replayBackgroundLoading.value = false;
  replayBuffering.value = false;
  replayPoints.value = [];
  replayFrameTimes.value = [];
  replayRangeStart.value = 0;
  replayRangeEnd.value = 0;
  replayLoadedUntil.value = 0;
  replayLoadComplete.value = false;
  replayLoadCursor = 0;
  replayScanWindowMs = REPLAY_SCAN_INITIAL_MS;
  replayResumeAfterBuffer = false;
  replayTracks.clear();
  stopReplayTimer();
  replayProgress.value = 0;
  replayFrameIndex.value = 0;
  replayCurrentTime.value = 0;
  replayOnlineCount.value = 0;
  twinScene?.setVisibleLivePoses(null);
}

function clearReplayScene(deviceIds = getReplayDeviceIds()) {
  twinScene?.clearAllTrails();
  deviceIds.forEach((deviceId) => {
    twinScene?.hideReplayPose(deviceId);
  });
}

function restoreLivePoseView() {
  latestLivePoses.forEach((pose) => {
    twinScene?.updateLivePose(pose);
  });
  applyLiveDeviceFilter();
  // 恢复实时数据的区域统计
  updateAreaStats();
}

function applyLiveDeviceFilter() {
  if (replayPanelOpen.value) {
    return;
  }

  twinScene?.setVisibleLivePoses([...selectedDevices.value]);
}

function cancelDeviceFilter() {
  selectedDevices.value = [...deviceOptions.value];
  deviceFilterKeyword.value = '';
  filterOpen.value = false;
}

function clearDeviceFilter() {
  selectedDevices.value = [];
}

function createTwinScene() {
  if (!sceneContainer.value) {
    console.warn('[TwinScreen MQTT] scene not created because scene container is missing');
    return;
  }

  // Clear model cache so switching maps picks up fresh geometry
  clearModelTemplateCache();

  twinScene?.destroy();
  twinScene = new TwinScene(
    sceneContainer.value,
    sceneStore.config,
    (point) => {
      pickedPoint.value = point;
    },
    () => {
      // Map selection is handled inside TwinScene; the replay device filter only changes from the select control.
    },
  );
  twinScene.init();
  twinScene.toggleFences(fencesVisible.value);
  twinScene.toggleLivePoseLabels(livePoseLabelsVisible.value);

  if (!replayPanelOpen.value) {
    restoreLivePoseView();
    applyLiveDeviceFilter();
  }
}

function clearTrails() {
  const previousReplayDeviceIds = getReplayDeviceIds();
  resetReplayState();
  clearReplayScene(previousReplayDeviceIds);
  if (!replayPanelOpen.value) {
    restoreLivePoseView();
  }
}

function getReplayRange(): { start: number; end: number } {
  const dayStart = Date.parse(`${replayDate.value}T00:00:00`);
  const [rangeStart, rangeEnd] = replayTimeRange.value;
  return {
    start: Number.isFinite(dayStart) ? dayStart + rangeStart * 1000 : 0,
    end: Number.isFinite(dayStart) ? dayStart + rangeEnd * 1000 : Date.now(),
  };
}

async function getReplayChunk(start: number, end: number): Promise<ReplayPoint[]> {
  return fetchTrajectoryPoints({
    deviceId: selectedReplayDevice.value === ALL_REPLAY_DEVICES ? undefined : selectedReplayDevice.value,
    startTime: start,
    endTime: end,
    limit: REPLAY_PAGE_LIMIT,
  });
}

function mergeReplayPoints(existingPoints: ReplayPoint[], incomingPoints: ReplayPoint[]): ReplayPoint[] {
  const pointMap = new Map<string, ReplayPoint>();

  [...existingPoints, ...incomingPoints].forEach((point) => {
    pointMap.set(`${point.deviceId}:${point.time}:${point.x}:${point.y}:${point.z}`, point);
  });

  return [...pointMap.values()].sort((left, right) => left.time - right.time);
}

function refreshReplayDataAfterLoad() {
  prepareReplayTracks();
  prepareReplayFrameTimes();
  getReplayDeviceIds().forEach((deviceId) => {
    twinScene?.setDevicePath(deviceId, replayTracks.get(deviceId) ?? []);
  });
}

async function loadNextReplayChunk(token: number): Promise<ReplayPoint[]> {
  if (replayLoadComplete.value || replayLoadCursor >= replayRangeEnd.value) {
    return [];
  }

  const chunkStart = replayLoadCursor;
  const chunkEnd = Math.min(chunkStart + replayScanWindowMs, replayRangeEnd.value);
  const points = await getReplayChunk(chunkStart, chunkEnd);

  if (token !== replayLoadToken) {
    return [];
  }

  if (points.length === 0) {
    replayLoadedUntil.value = chunkEnd;
    replayLoadCursor = chunkEnd;
    replayLoadComplete.value = chunkEnd >= replayRangeEnd.value;
    replayScanWindowMs = Math.min(replayScanWindowMs * 2, REPLAY_SCAN_MAX_MS);
    if (replayPoints.value.length > 0) {
      refreshReplayDataAfterLoad();
    }
    return [];
  }

  const lastPointTime = points[points.length - 1].time;
  if (points.length > 0) {
    replayPoints.value = mergeReplayPoints(replayPoints.value, points);
  }

  const pageFilled = points.length >= REPLAY_PAGE_LIMIT && lastPointTime < chunkEnd;
  replayLoadComplete.value = !pageFilled && chunkEnd >= replayRangeEnd.value;
  replayLoadCursor = pageFilled ? Math.min(lastPointTime + 1, replayRangeEnd.value) : chunkEnd;
  replayLoadedUntil.value = pageFilled ? lastPointTime : chunkEnd;
  replayScanWindowMs = REPLAY_SCAN_INITIAL_MS;

  if (replayPoints.value.length > 0) {
    refreshReplayDataAfterLoad();
  }

  return points;
}

async function loadInitialReplayChunks(token: number): Promise<void> {
  while (token === replayLoadToken && !replayLoadComplete.value && replayPoints.value.length < 2) {
    await loadNextReplayChunk(token);
  }
}

function resumeReplayAfterBufferIfReady() {
  if (!replayBuffering.value || !replayResumeAfterBuffer) {
    return;
  }

  const currentTime = replayCurrentTime.value || replayFrameTimes.value[0] || replayRangeStart.value;
  if (currentTime + REPLAY_BUFFER_AHEAD_MS >= replayLoadedUntil.value && replayLoadedUntil.value < replayRangeEnd.value) {
    return;
  }

  replayBuffering.value = false;
  replayResumeAfterBuffer = false;
  replayPlaying.value = true;
  startReplayTimer();
}

async function loadRemainingReplayChunks(token: number): Promise<void> {
  replayBackgroundLoading.value = true;
  try {
    while (token === replayLoadToken && !replayLoadComplete.value) {
      await loadNextReplayChunk(token);
      resumeReplayAfterBufferIfReady();
    }
  } catch (error) {
    if (token === replayLoadToken) {
      replayError.value = error instanceof Error ? error.message : t('dashboard.loadFailed');
    }
  } finally {
    if (token === replayLoadToken) {
      replayBackgroundLoading.value = false;
      resumeReplayAfterBufferIfReady();
    }
  }
}

function getReplayDeviceIds(): string[] {
  if (selectedReplayDevice.value !== ALL_REPLAY_DEVICES) {
    return [selectedReplayDevice.value];
  }

  return [...new Set(replayPoints.value.map((point) => point.deviceId))];
}

function prepareReplayTracks() {
  replayTracks.clear();
  replayPoints.value.forEach((point) => {
    const track = replayTracks.get(point.deviceId) ?? [];
    track.push(point);
    replayTracks.set(point.deviceId, track);
  });
  replayTracks.forEach((track) => {
    track.sort((left, right) => left.time - right.time);
  });
}

function stopReplayTimer() {
  if (replayTimer) {
    window.clearInterval(replayTimer);
    replayTimer = 0;
  }
}

function stopReplayNudge() {
  if (replayNudgeTimer) {
    window.clearInterval(replayNudgeTimer);
    replayNudgeTimer = 0;
  }
}

function findReplayTrackIndexAtTime(points: ReplayPoint[], time: number): number {
  let left = 0;
  let right = points.length - 1;
  let result = 0;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (points[mid].time <= time) {
      result = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return result;
}

function findReplayPointAtTime(points: ReplayPoint[], time: number): ReplayPoint {
  return points[findReplayTrackIndexAtTime(points, time)] ?? points[0];
}

function interpolateReplayPoint(points: ReplayPoint[], time: number): ReplayPoint | null {
  if (points.length === 0) {
    return null;
  }

  const leftIndex = findReplayTrackIndexAtTime(points, time);
  const left = points[leftIndex] ?? points[0];
  const right = points[leftIndex + 1];
  if (!right || right.time <= left.time || time <= left.time) {
    // 当查询时间在数据起始之前，直接返回 null（无数据可显示）
    if (time < left.time) return null;
    return time - left.time > REPLAY_DATA_GAP_MS ? null : left;
  }

  if (right.time - left.time > REPLAY_DATA_GAP_MS && time - left.time > REPLAY_DATA_GAP_MS) {
    return null;
  }

  const ratio = Math.max(0, Math.min(1, (time - left.time) / (right.time - left.time)));
  return {
    deviceId: left.deviceId,
    x: left.x + (right.x - left.x) * ratio,
    y: left.y + (right.y - left.y) * ratio,
    z: left.z + (right.z - left.z) * ratio,
    theta: typeof left.theta === 'number' && typeof right.theta === 'number' ? left.theta + (right.theta - left.theta) * ratio : left.theta,
    time,
  };
}

function findReplayFrameIndexAtTime(time: number): number {
  return findReplayTrackIndexAtTime(
    replayFrameTimes.value.map((frameTime) => ({
      deviceId: '',
      x: 0,
      y: 0,
      z: 0,
      time: frameTime,
    })),
    time,
  );
}

function prepareReplayFrameTimes() {
  if (replayPoints.value.length === 0) {
    replayFrameTimes.value = [];
    return;
  }

  const loadedEnd = replayLoadComplete.value ? replayRangeEnd.value : replayLoadedUntil.value;
  if (selectedReplayDevice.value !== ALL_REPLAY_DEVICES) {
    replayFrameTimes.value = [...new Set([...replayPoints.value.map((point) => point.time), loadedEnd])]
      .filter((time) => Number.isFinite(time))
      .sort((left, right) => left - right);
    return;
  }

  const start = replayPoints.value[0].time;
  const end = Math.max(replayPoints.value[replayPoints.value.length - 1].time, loadedEnd);
  if (start === end) {
    replayFrameTimes.value = [start];
    return;
  }

  const durationMs = Math.abs(end - start);
  
  // 根据时间跨度智能计算帧数
  // 目标：每帧之间时间差不超过500ms（控制插值精度）
  const targetFrameIntervalMs = 500;
  let frameCount = Math.ceil(durationMs / targetFrameIntervalMs);
  frameCount = Math.min(REPLAY_MAX_FRAMES, Math.max(2, frameCount));
  
  const step = (end - start) / (frameCount - 1);
  replayFrameTimes.value = Array.from({ length: frameCount }, (_, index) => Math.round(start + step * index));
}

function getReplayPositionsAtTime(time: number): ReplayPoint[] {
  const positions: ReplayPoint[] = [];
  replayTracks.forEach((track) => {
    if (track.length > 0) {
      const point = interpolateReplayPoint(track, time);
      if (point) {
        positions.push(point);
      }
    }
  });
  return positions;
}

function getAreaName(point: ReplayPoint): string {
  const offsetX = sceneStore.config.floor.origin[0] + sceneStore.config.floor.width / 2;
  const offsetY = sceneStore.config.floor.origin[1] + sceneStore.config.floor.height / 2;
  const floorPoint: [number, number] = [point.x + offsetX, point.y + offsetY];
  const area = sceneStore.config.areas.find((item) => item.type === 'floor' && isPointInPolygon(floorPoint, item.points));
  return area?.name ?? t('dashboard.areaOther') + ' ' + t('dashboard.areaStats');
}

function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  let inside = false;
  const [x, y] = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * 检查点是否在矩形框内
 */
function isPointInRectangle(x: number, y: number, minX: number, maxX: number, minY: number, maxY: number): boolean {
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

/**
 * 获取点所在的围栏/区域
 */
function getFenceForPoint(point: { x: number; y: number }): { id: string; name: string; color: string } | null {
  // 将定位点坐标转换为地图配置坐标系
  const offsetX = sceneStore.config.floor.origin[0] + sceneStore.config.floor.width / 2;
  const offsetY = sceneStore.config.floor.origin[1] + sceneStore.config.floor.height / 2;
  const mapX = point.x + offsetX;
  const mapY = point.y + offsetY;
  
  for (const fence of sceneStore.config.fences) {
    if (isPointInRectangle(mapX, mapY, fence.minX, fence.maxX, fence.minY, fence.maxY)) {
      return {
        id: fence.id,
        name: fence.name,
        color: fence.color,
      };
    }
  }
  return null;
}

function updateAreaStats(time?: number): void {
  // 回放模式下不更新实时概览
  if (time === undefined && replayPanelOpen.value) return;

  const positions = time !== undefined
    ? getReplayPositionsAtTime(time)
    : [...latestLivePoses.values()];
  const total = time !== undefined ? Math.max(positions.length, 1) : (onlineDevices.value || 1);

  const fenceCounts = new Map<string, { name: string; count: number; color: string }>();
  sceneStore.config.fences.forEach((fence) => {
    fenceCounts.set(fence.id, { name: fence.name, color: fence.color, count: 0 });
  });

  let otherCount = 0;
  (positions as Array<{ x: number; y: number }>).forEach((point) => {
    const fence = getFenceForPoint(point);
    if (fence) {
      const stat = fenceCounts.get(fence.id);
      if (stat) stat.count += 1;
    } else {
      otherCount += 1;
    }
  });

  areaStats.value = [...fenceCounts.entries()]
    .map(([, stat]) => ({
      name: stat.name, count: stat.count,
      percent: Number(((stat.count / total) * 100).toFixed(1)),
      color: stat.color,
    }))
    .concat({
      name: t('dashboard.areaOther'), count: otherCount,
      percent: Number(((otherCount / total) * 100).toFixed(1)),
      color: '#a0a0a0',
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getReplayClustersAtTime(time: number): Array<{ area: string; count: number }> {
  const counts = new Map<string, number>();
  getReplayPositionsAtTime(time).forEach((point) => {
    const area = getAreaName(point);
    counts.set(area, (counts.get(area) ?? 0) + 1);
  });
  return [...counts.entries()]
    .filter(([, count]) => count >= AREA_CLUSTER_THRESHOLD)
    .sort((left, right) => right[1] - left[1])
    .map(([area, count]) => ({ area, count }));
}

function applyReplayFrame(index = currentReplayIndex.value) {
  const time = replayFrameTimes.value[index];
  if (!Number.isFinite(time)) {
    return;
  }

  applyReplayTime(time);
}

function applyReplayTime(time: number) {
  if (selectedReplayDevice.value === ALL_REPLAY_DEVICES) {
    let visibleCount = 0;
    replayTracks.forEach((devicePoints, deviceId) => {
      const framePoint = interpolateReplayPoint(devicePoints, time);
      if (framePoint) {
        twinScene?.updateReplayPose(deviceId, framePoint, framePoint.theta ?? 0);
        visibleCount += 1;
      } else {
        twinScene?.hideReplayPose(deviceId);
      }
    });
    replayOnlineCount.value = visibleCount;
    // 更新回放时的区域统计
    updateAreaStats(time);
    return;
  }

  const point = interpolateReplayPoint(replayPoints.value, time);
  if (point) {
    twinScene?.updateReplayPose(point.deviceId, point, point.theta ?? 0);
    replayOnlineCount.value = 1;
    updateAreaStats(time);
  } else if (selectedReplayDevice.value !== ALL_REPLAY_DEVICES) {
    twinScene?.hideReplayPose(selectedReplayDevice.value);
    replayOnlineCount.value = 0;
    updateAreaStats(time);
  }
}

function setReplayIndex(index: number) {
  if (replayFrameTimes.value.length <= 1) {
    replayProgress.value = 0;
    replayFrameIndex.value = 0;
    replayCurrentTime.value = replayFrameTimes.value[0] ?? 0;
    applyReplayFrame(0);
    return;
  }

  const safeIndex = Math.max(0, Math.min(index, replayFrameTimes.value.length - 1));
  replayFrameIndex.value = safeIndex;
  setReplayTime(replayFrameTimes.value[safeIndex]);
}

function getReplayProgressRange(): { start: number; end: number } {
  return { start: replayRangeStart.value, end: replayRangeEnd.value };
}

function setReplayTime(time: number) {
  if (replayFrameTimes.value.length <= 1) {
    return;
  }

  // 以用户设定的时间范围为边界，而非数据实际起止时间
  // 这样在无数据的空白时段也能拖动进度条查看，避免回弹
  const safeTime = Math.max(replayRangeStart.value, Math.min(time, replayRangeEnd.value));
  replayCurrentTime.value = safeTime;
  replayFrameIndex.value = findReplayFrameIndexAtTime(safeTime);
  const progressRange = getReplayProgressRange();
  replayProgress.value = progressRange.end > progressRange.start
    ? Number((((safeTime - progressRange.start) / (progressRange.end - progressRange.start)) * 100).toFixed(2))
    : 0;
  applyReplayTime(safeTime);
}

function startReplayTimer() {
  stopReplayTimer();
  if (!replayPlaying.value || replayFrameTimes.value.length < 2) {
    return;
  }

  const intervalMs = 50; // 减小定时器间隔提高精度
  let lastUpdateTime = Date.now();

  replayTimer = window.setInterval(() => {
    const now = Date.now();
    const actualElapsedMs = now - lastUpdateTime;
    lastUpdateTime = now;

    // 基于实际经过的时间计算下一帧时间（更精确）
    const currentReplayTime = replayCurrentTime.value || replayFrameTimes.value[0];
    const nextTime = currentReplayTime + actualElapsedMs * replaySpeed.value * replayDirection.value;

    const rangeStart = replayRangeStart.value;
    const rangeEnd = replayRangeEnd.value;
    if (nextTime >= replayLoadedUntil.value && replayLoadedUntil.value < rangeEnd) {
      replayPlaying.value = false;
      replayBuffering.value = true;
      replayResumeAfterBuffer = true;
      stopReplayTimer();
      setReplayTime(replayLoadedUntil.value);
      return;
    }

    // 以用户时间范围为边界，确保空白时段也可以连续播放
    if (nextTime >= rangeEnd || nextTime <= rangeStart) {
      replayPlaying.value = false;
      stopReplayTimer();
      setReplayTime(nextTime <= rangeStart ? rangeStart : rangeEnd);
      return;
    }

    setReplayTime(nextTime);
  }, intervalMs);
}

async function startReplay(options: { autoPlay?: boolean } = {}) {
  const autoPlay = options.autoPlay ?? true;
  const token = replayLoadToken + 1;
  replayLoadToken = token;
  viewMode.value = 'replay';
  replayPanelOpen.value = true;
  replayLoading.value = true;
  replayBackgroundLoading.value = false;
  replayBuffering.value = false;
  replayError.value = '';
  replaySearchAttempted.value = true;
  stopReplayTimer();
  replayPlaying.value = false;
  replayResumeAfterBuffer = false;
  twinScene?.clearAllDevicePoses();
  replayPoints.value = [];
  replayFrameTimes.value = [];
  const replayRange = getReplayRange();
  replayRangeStart.value = replayRange.start;
  replayRangeEnd.value = replayRange.end;
  replayLoadedUntil.value = replayRange.start;
  replayLoadComplete.value = false;
  replayLoadCursor = replayRange.start;
  replayScanWindowMs = REPLAY_SCAN_INITIAL_MS;
  replayTracks.clear();
  try {
    await loadInitialReplayChunks(token);
  } catch (error) {
    replayError.value = error instanceof Error ? error.message : t('dashboard.trajectoryLoadFailed');
    resetReplayState();
    return;
  } finally {
    if (token === replayLoadToken) {
      replayLoading.value = false;
    }
  }
  if (token !== replayLoadToken) {
    return;
  }
  const replayDeviceIds = getReplayDeviceIds();
  refreshReplayDataAfterLoad();
  replayDirection.value = 1;
  if (replayFrameTimes.value.length < 2) {
    replayError.value = t('dashboard.noReplayData');
    replayPoints.value = [];
    replayFrameTimes.value = [];
    replayTracks.clear();
    replayProgress.value = 0;
    replayFrameIndex.value = 0;
    replayCurrentTime.value = 0;
    updateAreaStats(0);
    return;
  }

  replayDeviceIds.forEach((deviceId) => {
    const devicePoints = replayTracks.get(deviceId) ?? [];
    twinScene?.setDevicePath(deviceId, devicePoints);
  });
  setReplayIndex(0);
  if (selectedReplayDevice.value !== ALL_REPLAY_DEVICES) {
    twinScene?.focusLivePose(selectedReplayDevice.value);
    twinScene?.setVisibleLivePoses([selectedReplayDevice.value]);
  }
  if (autoPlay) {
    replayPlaying.value = true;
    startReplayTimer();
  }
  void loadRemainingReplayChunks(token);
}

function clearReplay() {
  twinScene?.clearAllDevicePoses();
  resetReplayState();
  restoreLivePoseView();
}

function exitReplayMode() {
  clearReplay();
  replayPanelOpen.value = false;
  viewMode.value = 'monitor';
  applyLiveDeviceFilter();
}

function toggleReplayMode() {
  if (replayPanelOpen.value) {
    exitReplayMode();
    return;
  }

  replayPanelOpen.value = true;
  viewMode.value = 'replay';
  replaySearchAttempted.value = false;
  replayError.value = '';
}

function toggleReplayPlaying() {
  if (replayFrameTimes.value.length < 2) {
    startReplay();
    return;
  }

  replayPlaying.value = !replayPlaying.value;
  if (replayPlaying.value) {
    startReplayTimer();
  } else {
    stopReplayTimer();
  }
}

function nudgeReplay(direction: -1 | 1) {
  if (replayFrameTimes.value.length < 2) {
    startReplay();
    return;
  }

  const currentTime = replayCurrentTime.value || replayFrameTimes.value[currentReplayIndex.value] || replayFrameTimes.value[0];
  const targetTime = currentTime + direction * REPLAY_NUDGE_STEP_MS;
  if (!replayLoadComplete.value && targetTime > replayLoadedUntil.value) {
    replayBuffering.value = true;
    replayResumeAfterBuffer = replayPlaying.value;
    setReplayTime(replayLoadedUntil.value);
    return;
  }

  replayBuffering.value = false;
  replayResumeAfterBuffer = false;
  setReplayTime(targetTime);
}

function startReplayNudge(direction: -1 | 1) {
  if (replayProgressDisabled.value) {
    return;
  }

  stopReplayNudge();
  nudgeReplay(direction);
  replayNudgeTimer = window.setInterval(() => {
    nudgeReplay(direction);
  }, REPLAY_NUDGE_INTERVAL_MS);
}

function seekReplay() {
  replayPlaying.value = false;
  stopReplayTimer();
  if (replayFrameTimes.value.length > 1) {
    const { start, end } = getReplayProgressRange();
    const targetTime = start + (end - start) * (replayProgress.value / 100);
    if (!replayLoadComplete.value && targetTime > replayLoadedUntil.value) {
      replayBuffering.value = true;
      replayResumeAfterBuffer = true;
      setReplayTime(replayLoadedUntil.value);
      return;
    }

    replayBuffering.value = false;
    replayResumeAfterBuffer = false;
    setReplayTime(targetTime);
  }
}

function isReplayLoaded(): boolean {
  return replayPoints.value.length > 0;
}

async function loadAlertEvents() {
  try {
    events.value = await getAllAlertMessage();
  } catch (error) {
    console.warn('Failed to load alert events', error);
    events.value = [];
  }
}

onMounted(() => {
  void loadAlertEvents();

  updateAreaStats();

  clockTimer = window.setInterval(() => {
    currentTime.value = formatClock(new Date());
  }, 1000);
  renderAreaChart();
  window.addEventListener('resize', resizeAreaChart);

  if (!sceneContainer.value) {
    console.warn('[TwinScreen MQTT] mqtt client not created because scene container is missing');
    return;
  }

  createTwinScene();

  const mqttUrl = resolveMqttWebSocketUrl();
  mqttClient = new MqttPoseClient({
    url: mqttUrl,
    onPose: (pose) => {
      livePose.value = pose;
      latestLivePoses.set(pose.deviceId, pose);
      livePoseVersion.value += 1;
      onlineDeviceCount.value = latestLivePoses.size;
      if (!replayPanelOpen.value) {
        updateAreaStats();
        twinScene?.updateLivePose(pose);
      }
    },
    onPath: (deviceId, points) => {
      if (!replayPanelOpen.value) {
        twinScene?.setDevicePath(deviceId, points);
      }
    },
    onDeviceDisconnect: (deviceId) => {
      latestLivePoses.delete(deviceId);
      livePoseVersion.value += 1;
      onlineDeviceCount.value = latestLivePoses.size;
      if (!replayPanelOpen.value) {
        updateAreaStats();
        twinScene?.clearDeviceLivePose(deviceId);
      }
      if (livePose.value?.deviceId === deviceId) {
        livePose.value = null;
      }
    },
    onStatusChange: (status) => {
      mqttStatus.value = status;
    },
    onError: (error) => {
      console.error('[TwinScreen MQTT] error callback', error);
      mqttError.value = error;
    },
  });
  mqttClient.connect();
});

onBeforeUnmount(() => {
  window.clearInterval(clockTimer);
  stopReplayTimer();
  stopReplayNudge();
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

watch(areaStats, () => {
  renderAreaChart();
}, { deep: true });

watch(selectedDevices, () => {
  applyLiveDeviceFilter();
}, { deep: true });

watch(deviceOptions, (nextDevices, previousDevices) => {
  const selectedSet = new Set(selectedDevices.value);
  const wasShowingAll = previousDevices.length === 0 || previousDevices.every((device) => selectedSet.has(device));

  if (wasShowingAll) {
    selectedDevices.value = [...nextDevices];
  }
});

watch(
  () => props.themeMode,
  () => {
    renderAreaChart();
  },
);

watch(
  () => sceneStore.config,
  () => {
    selectedFloorId.value = sceneStore.config.floor.id;
    createTwinScene();
    updateAreaStats();
  },
  { deep: true },
);
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

.twin-screen--embedded {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.twin-screen--light {
  background:
    linear-gradient(180deg, rgba(246, 249, 253, 0.88), rgba(235, 240, 248, 0.98)),
    radial-gradient(circle at 50% 28%, rgba(77, 128, 255, 0.13), transparent 34%),
    #eef2f8;
  color: #172033;
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
}

.twin-screen--light .topbar {
  border-bottom-color: rgba(78, 101, 140, 0.16);
  background: rgba(255, 255, 255, 0.9);
}

.twin-screen--light .topbar__status strong {
  color: #172033;
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

.twin-screen--light .topbar__status,
.twin-screen--light .topbar__mqtt,
.twin-screen--light .select-field {
  color: rgba(52, 65, 89, 0.72);
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
.replay-form input,
.time-range-button {
  height: 36px;
  min-width: 128px;
  border: 1px solid rgba(83, 153, 224, 0.26);
  border-radius: 6px;
  background: rgba(3, 18, 32, 0.9);
  color: #dfefff;
  outline: none;
}

.twin-screen--light .select-field select,
.twin-screen--light .replay-form select,
.twin-screen--light .replay-form input,
.twin-screen--light .time-range-button {
  border-color: rgba(78, 101, 140, 0.18);
  background: rgba(255, 255, 255, 0.86);
  color: #172033;
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

.twin-screen--light .icon-button,
.twin-screen--light .map-controls button,
.twin-screen--light .tool-dock button,
.twin-screen--light .player-controls button {
  border-color: rgba(78, 101, 140, 0.16);
  background: rgba(255, 255, 255, 0.82);
  color: rgba(34, 45, 66, 0.78);
}

.workspace {
  position: relative;
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 18px;
  min-height: 0;
  overflow: hidden;
  padding: 14px 20px;
}

.workspace--replay-open {
  grid-template-columns: 320px minmax(0, 1fr) 292px;
}

.left-rail,
.right-rail {
  position: relative;
  z-index: 3;
  gap: 10px;
  min-width: 0;
  min-height: 0;
}

.left-rail {
  display: grid;
  grid-template-rows: auto 1fr;
}

.right-rail {
  display: flex;
  flex-direction: column;
}

.glass-panel {
  overflow: hidden;
  border: 1px solid rgba(80, 145, 205, 0.28);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(8, 28, 49, 0.92), rgba(5, 18, 33, 0.86));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 18px 42px rgba(0, 0, 0, 0.22);
}

.twin-screen--light .glass-panel {
  border-color: rgba(78, 101, 140, 0.16);
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 16px 36px rgba(38, 52, 82, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.glass-panel h2 {
  margin: 0;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(85, 145, 206, 0.18);
  color: #fff;
  font-size: 15px;
}

.twin-screen--light .glass-panel h2 {
  border-bottom-color: rgba(78, 101, 140, 0.12);
  color: #172033;
}

.dashboard-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.dashboard-stats-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 14px 16px;
}

.stat-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 72px;
  padding: 12px 10px;
  border: 1px solid rgba(82, 149, 218, 0.28);
  border-radius: 10px;
  background: rgba(4, 17, 33, 0.72);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.stat-pill:hover {
  border-color: rgba(82, 149, 218, 0.45);
  box-shadow: 0 4px 16px rgba(47, 134, 255, 0.12);
}

.twin-screen--light .stat-pill {
  border-color: rgba(78, 101, 140, 0.14);
  background: rgba(246, 249, 253, 0.78);
}

.twin-screen--light .stat-pill:hover {
  border-color: rgba(37, 99, 235, 0.28);
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.08);
}

.stat-pill strong {
  display: block;
  color: #22d886;
  font-size: 30px;
  font-weight: 800;
  line-height: 1;
}

.stat-pill--blue strong {
  color: #2f86ff !important;
}

.stat-pill span {
  display: block;
  color: rgba(218, 232, 244, 0.74);
  font-size: 12px;
}

.twin-screen--light .stat-pill span {
  color: rgba(52, 65, 89, 0.68);
}

.twin-screen--light .area-row,
.twin-screen--light .event-item small,
.twin-screen--light .event-item time,
.twin-screen--light .timeline-item span,
.twin-screen--light .player-card p,
.twin-screen--light .replay-form label,
.twin-screen--light .floating-popover label,
.twin-screen--light .progress-time {
  color: rgba(52, 65, 89, 0.68);
}

.donut-wrap {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  padding: 8px 0 14px;
}

.area-chart {
  width: 220px;
  height: 220px;
}

.area-list {
  display: grid;
  flex: 1 1 auto;
  gap: 4px;
  max-height: 180px;
  min-height: 0;
  overflow: auto;
  padding: 6px 16px 16px;
  align-content: start;
  border-top: 1px solid rgba(85, 145, 206, 0.12);
}

.twin-screen--light .area-list {
  border-top-color: rgba(78, 101, 140, 0.08);
}

.area-row {
  display: grid;
  grid-template-columns: 10px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-radius: 4px;
  color: rgba(223, 236, 248, 0.78);
  font-size: 12px;
  transition: background 0.15s, box-shadow 0.15s;
  cursor: default;
}

.area-row:hover {
  background: rgba(47, 134, 255, 0.08);
  box-shadow: inset 0 0 0 1px rgba(47, 134, 255, 0.12);
}

.twin-screen--light .area-row:hover {
  background: rgba(37, 99, 235, 0.06);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.08);
}

.area-row i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 5px currentColor;
}

.area-row strong {
  color: rgba(235, 245, 255, 0.9);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.twin-screen--light .area-row strong,
.twin-screen--light .event-item strong,
.twin-screen--light .timeline-item strong,
.twin-screen--light .timeline-item time,
.twin-screen--light .progress-row {
  color: #172033;
}

.panel-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(85, 145, 206, 0.18);
}

.twin-screen--light .panel-title-row {
  border-bottom-color: rgba(78, 101, 140, 0.12);
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
  align-content: start;
  gap: 12px;
  min-height: 0;
  overflow: auto;
  padding: 12px 16px 16px;
}

.event-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.area-list,
.event-list,
.player-card {
  scrollbar-width: thin;
  scrollbar-color: rgba(126, 164, 206, 0.22) transparent;
}

.area-list::-webkit-scrollbar,
.event-list::-webkit-scrollbar,
.player-card::-webkit-scrollbar {
  width: 6px;
}

.area-list::-webkit-scrollbar-track,
.event-list::-webkit-scrollbar-track,
.player-card::-webkit-scrollbar-track {
  background: transparent;
}

.area-list::-webkit-scrollbar-thumb,
.event-list::-webkit-scrollbar-thumb,
.player-card::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(126, 164, 206, 0.18);
}

.area-list:hover::-webkit-scrollbar-thumb,
.event-list:hover::-webkit-scrollbar-thumb,
.player-card:hover::-webkit-scrollbar-thumb {
  background: rgba(126, 164, 206, 0.32);
}

.twin-screen--light .area-list,
.twin-screen--light .event-list,
.twin-screen--light .player-card {
  scrollbar-color: rgba(78, 101, 140, 0.2) transparent;
}

.twin-screen--light .area-list::-webkit-scrollbar-thumb,
.twin-screen--light .event-list::-webkit-scrollbar-thumb,
.twin-screen--light .player-card::-webkit-scrollbar-thumb {
  background: rgba(78, 101, 140, 0.16);
}

.twin-screen--light .area-list:hover::-webkit-scrollbar-thumb,
.twin-screen--light .event-list:hover::-webkit-scrollbar-thumb,
.twin-screen--light .player-card:hover::-webkit-scrollbar-thumb {
  background: rgba(78, 101, 140, 0.28);
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
  position: fixed;
  top: 80px;
  left: calc(50% + 80px);
  display: flex;
  gap: 10px;
  transform: translateX(-50%);
  z-index: 10;
  padding: 8px 12px;
  border: 1px solid rgba(104, 169, 232, 0.3);
  border-radius: 6px;
  background: rgba(5, 19, 34, 0.82);
  color: rgba(220, 234, 246, 0.76);
  font-size: 12px;
}

.twin-screen--light .pick-chip,
.twin-screen--light .floating-popover {
  border-color: rgba(78, 101, 140, 0.16);
  background: rgba(255, 255, 255, 0.9);
  color: rgba(52, 65, 89, 0.72);
  box-shadow: 0 14px 32px rgba(38, 52, 82, 0.12);
}

.twin-screen--light .filter-popover__header {
  color: rgba(39, 52, 75, 0.9);
}

.twin-screen--light .filter-popover__header span,
.twin-screen--light .filter-empty {
  color: rgba(52, 65, 89, 0.58);
}

.twin-screen--light .filter-search {
  border-color: rgba(78, 101, 140, 0.18);
  background: rgba(246, 249, 253, 0.94);
  color: rgba(39, 52, 75, 0.9);
}

.twin-screen--light .filter-actions button {
  border-color: rgba(78, 101, 140, 0.18);
  background: rgba(240, 245, 251, 0.96);
  color: rgba(39, 52, 75, 0.78);
}

.twin-screen--light .filter-actions button:hover {
  border-color: rgba(47, 134, 255, 0.34);
  background: rgba(226, 238, 253, 0.96);
}

.pick-chip strong {
  color: #8bdcff;
}

.map-controls {
  position: fixed;
  right: 36px;
  bottom: 128px;
  display: grid;
  gap: 8px;
  z-index: 10;
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

.twin-screen--light .zoom-box {
  border-color: rgba(78, 101, 140, 0.16);
}

.zoom-box button {
  border: 0;
  border-radius: 0;
}

.tool-dock {
  position: fixed;
  left: calc(50% + 80px);
  bottom: 24px;
  display: grid;
  grid-template-columns: repeat(8, minmax(72px, 92px));
  max-width: calc(100% - 32px);
  overflow: hidden;
  transform: translateX(-50%);
  z-index: 10;
  border: 1px solid rgba(80, 145, 205, 0.34);
  border-radius: 6px;
  background: rgba(5, 18, 33, 0.8);
}

.twin-screen--light .tool-dock {
  border-color: rgba(78, 101, 140, 0.16);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 16px 36px rgba(38, 52, 82, 0.12);
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

.twin-screen--light .tool-dock button {
  border-right-color: rgba(78, 101, 140, 0.12);
  background: transparent;
  color: rgba(34, 45, 66, 0.72);
}

.tool-dock button:last-child {
  border-right: 0;
}

.tool-dock button.active,
.tool-dock button:hover {
  color: #4ea3ff;
  background: rgba(47, 134, 255, 0.1);
}

.twin-screen--light .tool-dock button.active,
.twin-screen--light .tool-dock button:hover {
  color: #2563eb;
  background: rgba(37, 99, 235, 0.08);
}

.replay-progress-dock {
  position: fixed;
  left: calc(50% + 80px);
  bottom: 94px;
  z-index: 10;
  width: clamp(460px, 52vw, 620px);
  max-width: calc(100% - 32px);
  transform: translateX(-50%);
  padding: 8px 12px 10px;
  border: 1px solid rgba(80, 145, 205, 0.22);
  border-radius: 6px;
  background: rgba(5, 18, 33, 0.56);
  backdrop-filter: blur(8px);
}

.twin-screen--light .replay-progress-dock {
  border-color: rgba(78, 101, 140, 0.12);
  background: rgba(255, 255, 255, 0.58);
  box-shadow: 0 10px 24px rgba(38, 52, 82, 0.08);
}

.floating-popover {
  position: fixed;
  left: calc(50% + 80px);
  bottom: 108px;
  display: grid;
  gap: 8px;
  width: 180px;
  padding: 12px;
  transform: translateX(-300px);
  z-index: 10;
  border: 1px solid rgba(80, 145, 205, 0.34);
  border-radius: 6px;
  background: rgba(5, 18, 33, 0.94);
}

.filter-popover {
  display: flex;
  flex-direction: column;
  width: 280px;
  max-height: min(430px, calc(100vh - 140px));
  gap: 10px;
}

.filter-popover__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: rgba(226, 239, 250, 0.92);
  font-size: 13px;
}

.filter-popover__header strong,
.filter-popover__header span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-popover__header span {
  flex: 0 0 auto;
  color: rgba(226, 239, 250, 0.58);
  font-size: 12px;
}

.filter-search {
  width: 100%;
  height: 34px;
  border: 1px solid rgba(104, 169, 232, 0.28);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(226, 239, 250, 0.9);
  padding: 0 10px;
  outline: none;
}

.filter-search:focus {
  border-color: rgba(84, 189, 255, 0.68);
  box-shadow: 0 0 0 2px rgba(84, 189, 255, 0.14);
}

.filter-list {
  display: grid;
  gap: 8px;
  min-height: 42px;
  max-height: 250px;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: thin;
}

.filter-list label {
  min-height: 28px;
}

.filter-list span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-empty {
  margin: 8px 0;
  color: rgba(226, 239, 250, 0.52);
  font-size: 12px;
  text-align: center;
}

.filter-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.filter-actions button {
  min-width: 0;
  height: 32px;
  border: 1px solid rgba(104, 169, 232, 0.28);
  border-radius: 6px;
  background: rgba(55, 142, 232, 0.16);
  color: rgba(226, 239, 250, 0.86);
  cursor: pointer;
}

.filter-actions button:hover {
  border-color: rgba(84, 189, 255, 0.58);
  background: rgba(55, 142, 232, 0.28);
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
.replay-form input,
.time-range-button {
  width: 100%;
}

.time-range-button {
  padding: 0 12px;
  text-align: left;
  cursor: pointer;
}

.replay-error {
  margin: 10px 14px 0;
  color: #ffb15d;
  font-size: 12px;
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

.primary-button:disabled {
  cursor: wait;
  opacity: 0.58;
}

.twin-screen--light .primary-button {
  background: #2563eb;
}

.twin-screen--light .ghost-button {
  background: rgba(78, 101, 140, 0.12);
  color: #172033;
}

.range-modal-backdrop {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(2, 8, 16, 0.42);
  backdrop-filter: blur(8px);
}

.range-modal {
  width: min(460px, 100%);
  border: 1px solid rgba(90, 158, 231, 0.34);
  border-radius: 8px;
  background: rgba(6, 21, 38, 0.96);
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.38);
}

.twin-screen--light .range-modal {
  border-color: rgba(78, 101, 140, 0.18);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 22px 60px rgba(38, 52, 82, 0.18);
}

.range-modal header,
.range-modal footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
}

.range-modal header {
  border-bottom: 1px solid rgba(85, 145, 206, 0.18);
}

.range-modal footer {
  justify-content: flex-end;
  border-top: 1px solid rgba(85, 145, 206, 0.14);
}

.range-modal h2 {
  margin: 0;
  color: #f3f9ff;
  font-size: 15px;
}

.twin-screen--light .range-modal h2 {
  color: #172033;
}

.range-modal__close {
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 50%;
  background: rgba(124, 139, 156, 0.18);
  color: #eef8ff;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
}

.twin-screen--light .range-modal__close {
  color: #172033;
}

.day-clock {
  position: relative;
  display: grid;
  place-items: center;
  width: 168px;
  height: 168px;
  margin: 18px auto 14px;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, rgba(6, 21, 38, 0.96) 0 58%, transparent 59%),
    conic-gradient(from -90deg, rgba(63, 145, 255, 0.18) 0deg var(--clock-start), #2ed878 var(--clock-start) var(--clock-end), rgba(63, 145, 255, 0.18) var(--clock-end) 360deg);
  box-shadow: inset 0 0 0 1px rgba(107, 174, 243, 0.24);
}

.twin-screen--light .day-clock {
  background:
    radial-gradient(circle at center, rgba(255, 255, 255, 0.98) 0 58%, transparent 59%),
    conic-gradient(from -90deg, rgba(37, 99, 235, 0.13) 0deg var(--clock-start), #22c55e var(--clock-start) var(--clock-end), rgba(37, 99, 235, 0.13) var(--clock-end) 360deg);
}

.day-clock strong {
  color: #f3f9ff;
  font-size: 16px;
}

.day-clock span {
  position: absolute;
  color: rgba(224, 238, 250, 0.66);
  font-size: 11px;
}

.day-clock span:first-child {
  top: 13px;
}

.day-clock span:last-child {
  bottom: 13px;
}

.twin-screen--light .day-clock strong {
  color: #172033;
}

.twin-screen--light .day-clock span {
  color: rgba(52, 65, 89, 0.62);
}

.range-slider {
  position: relative;
  height: 46px;
  margin: 0 22px 4px;
}

.range-slider::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 20px;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    rgba(76, 128, 190, 0.26) 0 var(--range-start),
    #2ed878 var(--range-start) var(--range-end),
    rgba(76, 128, 190, 0.26) var(--range-end) 100%
  );
}

.range-slider input {
  position: absolute;
  inset: 0;
  width: 100%;
  margin: 0;
  pointer-events: none;
  appearance: none;
  background: transparent;
}

.range-slider input::-webkit-slider-thumb {
  width: 18px;
  height: 18px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #247cff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
  pointer-events: auto;
  appearance: none;
}

.range-slider input::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #247cff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
  pointer-events: auto;
}

.range-quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 8px 16px 16px;
}

.range-quick-actions button {
  height: 32px;
  border: 1px solid rgba(105, 167, 232, 0.22);
  border-radius: 6px;
  background: rgba(31, 78, 122, 0.26);
  color: rgba(235, 245, 255, 0.88);
  cursor: pointer;
}

.twin-screen--light .range-quick-actions button {
  border-color: rgba(78, 101, 140, 0.14);
  background: rgba(37, 99, 235, 0.07);
  color: #172033;
}

.twin-screen--light .timeline-item::before {
  background: rgba(78, 101, 140, 0.24);
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
  gap: 12px;
  margin-top: 5px;
}

.player-controls button {
  width: 30px;
  height: 30px;
  border: 0;
  background: transparent;
  color: rgba(230, 243, 255, 0.88);
  font-size: 16px;
  touch-action: none;
  user-select: none;
}

.player-controls .play-button {
  width: 34px;
  height: 34px;
  border: 1px solid rgba(171, 210, 248, 0.42);
  border-radius: 50%;
  font-size: 22px;
}

.twin-screen--light .player-controls button {
  color: rgba(23, 32, 51, 0.78);
}

.progress-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px;
  align-items: center;
  gap: 10px;
  margin: 0 0 4px;
  color: #fff;
  font-size: 11px;
}

.progress-row input {
  height: 14px;
  accent-color: #247cff;
}

.progress-row input::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
}

.progress-row input::-webkit-slider-thumb {
  margin-top: -5px;
}

.progress-row input::-moz-range-track {
  height: 4px;
  border-radius: 999px;
}

.progress-row input:disabled {
  cursor: wait;
  opacity: 0.62;
}

.twin-screen--light .progress-row {
  color: #172033;
}

.progress-time {
  margin-bottom: 0;
  color: rgba(223, 236, 248, 0.74);
  font-size: 11px;
  text-align: center;
  white-space: nowrap;
}

.twin-screen--light .progress-time {
  color: rgba(52, 65, 89, 0.66);
}

.replay-load-status {
  margin: 0 0 6px;
  padding: 5px 8px;
  border: 1px solid rgba(90, 156, 232, 0.22);
  border-radius: 6px;
  background: rgba(36, 124, 255, 0.09);
  color: rgba(224, 240, 255, 0.78);
  font-size: 11px;
  line-height: 1.3;
  text-align: center;
}

.replay-load-status.buffering {
  border-color: rgba(255, 194, 51, 0.46);
  background: rgba(255, 194, 51, 0.14);
  color: rgba(255, 237, 181, 0.94);
}

.twin-screen--light .replay-load-status {
  border-color: rgba(37, 99, 235, 0.18);
  background: rgba(37, 99, 235, 0.08);
  color: rgba(23, 32, 51, 0.72);
}

.twin-screen--light .replay-load-status.buffering {
  border-color: rgba(180, 121, 16, 0.28);
  background: rgba(245, 158, 11, 0.1);
  color: #7c4a03;
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
  .workspace,
  .workspace--replay-open {
    grid-template-columns: 320px minmax(0, 1fr);
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
  .workspace,
  .workspace--replay-open {
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

  .pick-chip {
    left: 50%;
  }

  .tool-dock {
    left: 50%;
    grid-template-columns: repeat(4, minmax(70px, 1fr));
    width: calc(100% - 20px);
  }

  .replay-progress-dock {
    left: 50%;
    bottom: 84px;
    width: calc(100% - 24px);
  }
}
</style>

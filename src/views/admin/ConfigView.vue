<template>
  <section v-if="pageKey !== 'map-editor'" class="config-page">
    <section class="config-grid">
      <article
        v-for="item in configItems"
        :key="item.title"
        :class="['setting-panel', { active: selectedSetting === item.title }]"
        @click="selectedSetting = item.title"
      >
        <div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.text }}</p>
        </div>
        <label>
          <input v-model="item.enabled" type="checkbox" @change="recordSettingChange(item.title, item.enabled)" />
          <span>{{ t('common.enable') }}</span>
        </label>
      </article>
    </section>

    <section class="config-layout">
      <article class="rule-panel">
        <div class="panel-title">
          <h3>{{ t('config.alarmRules') }}</h3>
          <button type="button" @click="addRule">{{ t('config.addRule') }}</button>
        </div>
        <div class="rule-list">
          <div
            v-for="rule in rules"
            :key="rule.name"
            :class="{ active: selectedRuleName === rule.name }"
            @click="selectedRuleName = rule.name"
          >
            <strong>{{ rule.name }}</strong>
            <span>{{ rule.condition }}</span>
            <small :class="rule.level">{{ rule.levelText }}</small>
          </div>
        </div>
      </article>

      <article class="integration-panel">
        <h3>{{ t('config.dataChannels') }}</h3>
        <div class="channel-list">
          <div
            v-for="channel in channels"
            :key="channel.name"
            :class="{ active: selectedChannelName === channel.name }"
            @click="selectedChannelName = channel.name"
          >
            <span>{{ channel.name }}</span>
            <strong>{{ channel.value }}</strong>
            <small>{{ channel.status }}</small>
          </div>
        </div>
        <div class="selected-channel">
          <span>{{ t('config.currentChannel') }}</span>
          <strong>{{ selectedChannel.name }}</strong>
          <small>{{ selectedChannel.status }} / {{ selectedChannel.value }}</small>
        </div>
      </article>

      <article class="audit-panel">
        <h3>{{ t('config.recentChanges') }}</h3>
        <div class="audit-list">
          <div v-for="item in audits" :key="item.time">
            <time>{{ item.time }}</time>
            <span>{{ item.content }}</span>
          </div>
        </div>
      </article>
    </section>
  </section>

  <section v-else class="map-editor-page">
    <template v-if="viewMode === 'list'">
      <section class="map-toolbar">
        <div>
          <h2>{{ t('config.modelEditorTitle') }}</h2>
          <p>{{ t('config.modelEditorDescription') }}</p>
        </div>
        <div class="toolbar-actions">
          <input ref="mapFileInput" class="model-file-input" type="file" @change="importMapFile" />
          <button type="button" class="upload-button" :disabled="mapImporting" @click="openMapFilePicker">
            <UploadOutlined />
            <span>{{ mapImporting ? t('config.importing') : '导入模型' }}</span>
          </button>
          <button type="button" class="primary-button" @click="createBlankMap">
            <PlusOutlined />
            <span>新建模型</span>
          </button>
        </div>
      </section>

      <section class="map-list">
        <article
          v-for="map in maps"
          :key="map.id"
          :class="['map-row', { active: map.id === sceneStore.activeMapId }]"
        >
          <div class="map-row__preview">
            <img v-if="map.metadata.thumbnail" :src="map.metadata.thumbnail" :alt="map.name" />
            <svg v-else :viewBox="getPreviewBox(map.config)" role="img">
              <polygon
                v-for="area in previewAreas(map.config)"
                :key="area.id"
                :points="formatPoints(area.points)"
              />
              <line
                v-for="wall in map.config.walls"
                :key="wall.id"
                :x1="wall.start[0]"
                :y1="wall.start[1]"
                :x2="wall.end[0]"
                :y2="wall.end[1]"
              />
            </svg>
          </div>
          <div class="map-row__content">
            <div class="map-row__title">
              <h3>{{ map.name }}</h3>
              <span v-if="map.id === sceneStore.activeMapId">{{ t('config.currentMap') }}</span>
            </div>
            <p>{{ map.description || t('config.noMapDesc') }}</p>
            <div class="map-row__meta">
              <span>{{ map.config.floor.width }} x {{ map.config.floor.height }}</span>
              <span>{{ t('config.areasCount', { n: map.config.areas.length }) }}</span>
              <span>{{ t('config.wallsCount', { n: map.config.walls.length }) }}</span>
              <span>{{ t('config.modelsCount', { n: map.config.models.length }) }}</span>
              <span>{{ t('config.updatedAt', { date: formatDate(map.updatedAt) }) }}</span>
            </div>
          </div>
          <div class="map-row__actions">
            <button type="button" @click="applyMap(map)">
              <CheckCircleOutlined />
              <span>{{ t('config.apply') }}</span>
            </button>
            <button type="button" @click="openEditor(map)">
              <EditOutlined />
              <span>{{ t('common.edit') }}</span>
            </button>
            <button type="button" :disabled="map.id === DEFAULT_MAP_ID" @click="deleteMap(map)">
              <DeleteOutlined />
              <span>{{ t('common.delete') }}</span>
            </button>
          </div>
        </article>
      </section>
    </template>

    <template v-else-if="draftMap">
      <section class="editor-header">
        <button type="button" class="back-button" @click="closeEditor">
          <ArrowLeftOutlined />
          <span>{{ t('config.backToList') }}</span>
        </button>
        <div>
          <h2>{{ draftMap.name }}</h2>
          <p>{{ t('config.editModelDescription') }}</p>
        </div>
        <div class="toolbar-actions">
          <button type="button" class="ghost-button" @click="applyDraft">
            <CheckCircleOutlined />
            <span>{{ t('config.applyToTrack') }}</span>
          </button>
          <button type="button" class="primary-button" @click="saveDraft">
            <SaveOutlined />
            <span>{{ t('config.saveMap') }}</span>
          </button>
        </div>
      </section>

      <section class="editor-layout">

        <article class="preview-panel">
          <div class="panel-heading">
            <div>
              <h3>{{ t('config.modelPreview') }}</h3>
              <p>{{ pickMode ? t('config.pickModeActive', { target: pickModeLabel }) : t('config.pickModeIdle') }}</p>
            </div>
            <button v-if="pickMode" type="button" class="ghost-button" @click="cancelPick">
              <span>{{ t('common.cancel') }}</span>
            </button>
          </div>
          <div
            ref="preview3dRef"
            class="map-preview map-preview--3d"
            role="img"
            @click="handlePreviewClick"
            @contextmenu.prevent
            @mousedown="handlePreviewPointerDown"
            @wheel.prevent="handlePreviewWheel"
          >
            <div class="map-preview__hud">
              <span>{{ t('config.clickedCoordinate') }}</span>
              <strong>{{ previewCoordinateText }}</strong>
            </div>
            <button
              type="button"
              :class="['map-preview__base-toggle', { collapsed: !baseMapToolsOpen }]"
              :title="baseMapToolsOpen ? t('common.cancel') : t('config.baseMap')"
              @click.stop="baseMapToolsOpen = !baseMapToolsOpen"
              @mousedown.stop
            >
              <span>{{ baseMapToolsOpen ? '>' : '<' }}</span>
            </button>
            <div v-if="baseMapToolsOpen" class="map-preview__base-tools" @click.stop @mousedown.stop @wheel.stop>
              <div class="map-preview__base-title">
                <strong>{{ t('config.baseMap') }}</strong>
                <span>{{ baseMapModel ? baseMapModel.path : t('config.noBaseMap') }}</span>
              </div>
              <label>
                <span>{{ t('config.adjustModelScale') }}</span>
                <input :value="scaleRatioDisplay" type="number" min="0" step="1" @input="onScaleRatioInput" @blur="onScaleRatioBlur" />
              </label>
              <template v-if="baseMapModel">
                <label>
                  <span>{{ t('config.modelX') }}</span>
                  <input v-model.number="baseMapModel.center[0]" type="number" step="0.1" @change="commitBaseModelParameter(0)" />
                </label>
                <label>
                  <span>{{ t('config.modelY') }}</span>
                  <input v-model.number="baseMapModel.center[1]" type="number" step="0.1" @change="commitBaseModelParameter(1)" />
                </label>
                <label>
                  <span>{{ t('config.modelZ') }}</span>
                  <input v-model.number="baseMapModel.center[2]" type="number" step="0.1" @change="commitBaseModelParameter(2)" />
                </label>
                <label class="slider-field map-preview__rotation-field">
                  <span>{{ t('config.rotationY') }}</span>
                  <input v-model.number="baseMapModel.rotation[1]" type="range" min="-180" max="180" step="1" @change="commitBaseModelRotation" />
                  <input v-model.number="baseMapModel.rotation[1]" type="number" step="1" @change="commitBaseModelRotation" />
                </label>
              </template>
              <input ref="baseMapFileInput" class="model-file-input" type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" @change="importBaseMapFile" />
              <button type="button" class="upload-button" :disabled="baseMapImporting" @click.stop="openBaseMapFilePicker">
                <UploadOutlined />
                <span>{{ baseMapImporting ? t('config.uploading') : baseMapModel ? t('config.replaceBaseMap') : t('config.uploadBaseMap') }}</span>
              </button>
            </div>
            <span v-if="!baseMapModel" class="map-preview__empty">
              {{ t('config.noBaseMap') }}
            </span>
          </div>
          <div class="preview-stats">
            <span>{{ t('config.currentFloor', { name: draftMap.config.floor.name }) }}</span>
            <span>{{ t('config.scaleLabel', { scale: `1:${getSafeScaleRatio(draftMap)}` }) }}</span>
          </div>
          <div class="pick-actions origin-editor">
            <button type="button" :class="{ active: pickMode === 'positioning-origin' }" @click="startPick('positioning-origin')">
              <span>{{ t('config.selectPositioningOrigin') }}</span>
            </button>
            <label><span>X</span><input v-model.number="positioningOriginDisplay[0]" type="number" @change="commitPositioningOriginDisplay" /></label>
            <label><span>Y</span><input v-model.number="positioningOriginDisplay[1]" type="number" @change="commitPositioningOriginDisplay" /></label>
            <label><span>Z</span><input v-model.number="positioningOriginDisplay[2]" type="number" @change="commitPositioningOriginDisplay" /></label>
          </div>
        </article>

        <article class="form-panel">
          <h3>{{ t('config.basicInfo') }}</h3>
          <div class="form-grid">
            <label>
              <span>{{ t('config.buildingName') }}</span>
              <input v-model.trim="draftMap.name" type="text" />
            </label>
<label>
              <span>{{ t('config.region') }}</span>
              <input v-model.trim="draftMap.metadata.region" type="text" />
            </label>
            <label class="wide">
              <span>{{ t('config.address') }}</span>
              <input v-model.trim="draftMap.metadata.address" type="text" />
            </label>
            <label class="wide">
              <span>{{ t('config.description') }}</span>
              <textarea v-model.trim="draftMap.description" rows="3" />
            </label>
          </div>
          <div class="thumbnail-uploader">
            <div class="thumbnail-uploader__preview">
              <img v-if="draftMap.metadata.thumbnail" :src="draftMap.metadata.thumbnail" :alt="draftMap.name" />
              <span v-else>{{ t('config.noCover') }}</span>
            </div>
            <div class="thumbnail-uploader__actions">
              <span>封面</span>
              <input ref="thumbnailFileInput" class="model-file-input" type="file" accept=".png,.jpg,.jpeg,.webp" @change="importThumbnailFile" />
              <button type="button" class="upload-button" :disabled="thumbnailUploading" @click="openThumbnailFilePicker">
                <UploadOutlined />
                <span>{{ thumbnailUploading ? t('config.uploading') : t('config.uploadCover') }}</span>
              </button>
              <button v-if="draftMap.metadata.thumbnail" type="button" @click="clearThumbnail">
                <DeleteOutlined />
                <span>{{ t('config.clearCover') }}</span>
              </button>
              <small>{{ thumbnailUploadStatus || t('config.coverUploadHint') }}</small>
            </div>
          </div>
        </article>

        <article class="form-panel">
          <h3>{{ t('config.floorManagement') }}</h3>
          <div class="floor-management-actions">
            <select :value="draftMap.metadata.activeFloorId" @change="handleFloorSelect">
              <option v-for="floor in draftMap.metadata.floors" :key="floor.id" :value="floor.id">{{ floor.name }}</option>
            </select>
            <button type="button" @click="addFloor"><PlusOutlined />新增楼层</button>
            <button type="button" :disabled="draftMap.metadata.floors.length <= 1" @click="removeCurrentFloor"><DeleteOutlined />删除楼层</button>
          </div>
          <div class="form-grid">
            <label>
              <span>楼层名称</span>
              <input v-model.trim="draftMap.config.floor.name" type="text" @input="updateCurrentFloorName" />
            </label>
            <label class="wide">
              <span>{{ t('config.floorDescription') }}</span>
              <textarea v-model.trim="currentFloorDescription" rows="3" />
            </label>
          </div>
        </article>

      </section>
    </template>

    <p v-if="message" class="toast-message">{{ message }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue';
import {
  uploadModel as apiUploadModel,
  fetchModelList as apiFetchModelList,
  fetchModelDetail as apiFetchModelDetail,
  saveModelConfig as apiSaveModelConfig,
  deleteModel as apiDeleteModel,
  uploadThumbnail as apiUploadThumbnail,
  type MapModelDetail,
} from '@/services/mapApi';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useSceneStore } from '@/stores/scene';
import type { AreaConfig, ModelConfig, Point3D, SceneConfig } from '@/types/scene';
import {
  DEFAULT_MAP_ID,
  applySharedModelParameters,
  cloneModels,
  cloneSceneConfig,
  createBlankSceneConfig,
  createDefaultMetadata,
  createSavedMap,
  getMapLibrary,
  isSceneConfig,
  normalizeModelConfig,
  saveMapLibrary,
  type MapFloorItem,
  type SavedMap,
} from '@/services/mapLibrary';
import { invalidateModelAssetUrl, versionModelAssetUrl } from '@/services/modelAssetCache';

type RuleLevel = 'alarm' | 'warn' | 'normal';
type PickMode = 'positioning-origin';
type PreviewDragMode = 'pan' | 'rotate';

interface PreviewViewState {
  targetX: number;
  targetY: number;
  targetZ: number;
  distance: number;
  yaw: number;
  pitch: number;
}

interface PreviewDragState {
  mode: PreviewDragMode;
  lastX: number;
  lastY: number;
}

interface ConfigItem {
  title: string;
  text: string;
  enabled: boolean;
}

interface RuleItem {
  name: string;
  condition: string;
  level: RuleLevel;
  levelText: string;
}

interface ChannelItem {
  name: string;
  value: string;
  status: string;
}

const props = defineProps<{
  pageKey?: string;
  editMapId?: string;
}>();

const configItems = reactive<ConfigItem[]>([
  { title: t('config.trajectorySampling'), text: t('config.trajectorySamplingDesc'), enabled: true },
  { title: t('config.eFenceRules'), text: t('config.eFenceRulesDesc'), enabled: true },
  { title: t('config.externalDataAccess'), text: t('config.externalDataAccessDesc'), enabled: false },
  { title: t('config.auditSecurity'), text: t('config.auditSecurityDesc'), enabled: true },
]);

const rules = reactive<RuleItem[]>([
  { name: t('config.keyAreaCrossing'), condition: t('config.keyAreaCrossingCond'), level: 'alarm', levelText: t('config.high') },
  { name: t('config.personStillness'), condition: t('config.personStillnessCond'), level: 'warn', levelText: t('config.medium') },
  { name: t('config.deviceLowBattery'), condition: t('config.deviceLowBatteryCond'), level: 'warn', levelText: t('config.medium') },
  { name: t('config.deviceOffline'), condition: t('config.deviceOfflineCond'), level: 'normal', levelText: t('config.low') },
]);

const channels = reactive<ChannelItem[]>([
  { name: 'MQTT WebSocket', value: 'ws://localhost:8080', status: t('config.primaryChannel') },
  { name: t('archive.title'), value: '/api/track/archive', status: t('config.pendingAccess') },
  { name: '组织同步', value: '企业通讯录', status: t('config.dailySchedule', { time: '02:00' }) },
  { name: '告警推送', value: 'Webhook / 短信', status: t('config.enabledStatus') },
]);

const audits = reactive([
  { time: '10:22', content: '张工启用了电子围栏规则' },
  { time: '09:48', content: '系统自动同步 12 条设备信息' },
  { time: '09:12', content: '李工调整轨迹保留时长为 30 天' },
  { time: '08:55', content: '访客区域授权模板完成更新' },
]);

const selectedSetting = ref(configItems[0]?.title ?? '');
const selectedRuleName = ref(rules[0]?.name ?? '');
const selectedChannelName = ref(channels[0]?.name ?? '');
const sceneStore = useSceneStore();
const maps = ref<SavedMap[]>(getMapLibrary());
const viewMode = ref<'list' | 'edit'>('list');
const draftMap = ref<SavedMap | null>(null);
const message = ref('');
const mapFileInput = ref<HTMLInputElement | null>(null);
const preview3dRef = ref<HTMLDivElement | null>(null);
const mapImporting = ref(false);
const baseMapFileInput = ref<HTMLInputElement | null>(null);
const baseMapImporting = ref(false);
const thumbnailFileInput = ref<HTMLInputElement | null>(null);
const thumbnailUploading = ref(false);
const thumbnailUploadStatus = ref('');
const baseMapToolsOpen = ref(true);
const pickMode = ref<PickMode | null>(null);
const gltfLoader = new GLTFLoader();
const modelModules = import.meta.glob('/src/assets/model/**/*.{glb,gltf}', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;
const DEFAULT_MODEL_SCALE_RATIO = 1;
let previewRenderer: THREE.WebGLRenderer | null = null;
let previewScene: THREE.Scene | null = null;
let previewCamera: THREE.PerspectiveCamera | null = null;
let previewResizeObserver: ResizeObserver | null = null;
let previewFrameId = 0;
let previewBuildToken = 0;
let previewHasFramed = false;
let previewAssetSignature = '';
let previewLayoutSignature = '';
let previewScaleSignature = '';
let previewDragState: PreviewDragState | null = null;
let previewRestoreView: PreviewViewState | null = null;
let previewClickBlocked = false;
const previewModelObjects = new Map<string, THREE.Object3D>();
let previewAuxObjects: THREE.Object3D[] = [];
const previewView = reactive<PreviewViewState>({
  targetX: 0,
  targetY: 0,
  targetZ: 0,
  distance: 900,
  yaw: 0,
  pitch: 89.5,
});
const previewClickedPoint = ref<[number, number, number] | null>(null);

const selectedChannel = computed(() => {
  return channels.find((channel) => channel.name === selectedChannelName.value) ?? channels[0];
});

const previewAreas = computed(() => (config: SceneConfig) => config.areas.filter((area) => area.type === 'floor'));
const pickModeLabel = computed(() => t('config.positioningOrigin'));
const currentFloor = computed(() => {
  if (!draftMap.value) {
    return null;
  }

  return draftMap.value.metadata.floors.find((floor) => floor.id === draftMap.value?.metadata.activeFloorId) ?? draftMap.value.metadata.floors[0] ?? null;
});
const currentFloorDescription = computed({
  get: () => currentFloor.value?.description ?? '',
  set: (value: string) => {
    if (currentFloor.value) currentFloor.value.description = value;
  },
});
const baseMapModel = computed(() => draftMap.value?.config.models.find((model) => model.role === 'base-map') ?? null);
const transformRange = computed(() => {
  const floor = draftMap.value?.config.floor;
  return Math.max(floor?.width ?? 1000, floor?.height ?? 600, 100);
});
const previewCoordinateText = computed(() => {
  if (!previewClickedPoint.value) {
    return t('config.noClickedCoordinate');
  }

  return `X ${previewClickedPoint.value[0].toFixed(2)} / Z ${previewClickedPoint.value[2].toFixed(2)}`;
});
const scaleRatioDisplay = ref('');
function updateScaleRatioDisplay() {
  scaleRatioDisplay.value = String(draftMap.value ? getSafeScaleRatio(draftMap.value) : 100);
}
function onScaleRatioInput(event: Event) {
  scaleRatioDisplay.value = (event.target as HTMLInputElement).value;
  const value = Number(scaleRatioDisplay.value);
  if (Number.isFinite(value) && value > 0) {
    setScaleRatio(value);
  }
}

function setScaleRatio(value: number) {
  if (!draftMap.value || !Number.isFinite(value) || value <= 0) return;
  draftMap.value.metadata.scaleRatio = value;
  draftMap.value.config.floor.scale = value;
  draftMap.value.metadata.floors.forEach((floor) => {
    floor.config.floor.scale = value;
  });
}

function onScaleRatioBlur() {
  if (!draftMap.value) return;
  const raw = scaleRatioDisplay.value.trim();
  if (raw === '' || raw === '-' || raw === '.') {
    updateScaleRatioDisplay();
    return;
  }
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) {
    updateScaleRatioDisplay();
    return;
  }
  setScaleRatio(num);
  scaleRatioDisplay.value = String(num);
}

// Building-level positioning origin shared by every floor.
const positioningOriginDisplay = ref<Point3D>([0, 0, 0]);
function syncPositioningOriginDisplay() {
  if (!draftMap.value) return;
  positioningOriginDisplay.value = [...draftMap.value.metadata.positioningOrigin] as Point3D;
}
function commitPositioningOriginDisplay() {
  if (!draftMap.value) return;
  draftMap.value.metadata.positioningOrigin = [...positioningOriginDisplay.value] as Point3D;
  applyBuildingSettingsToFloors(draftMap.value);
}
watch(() => draftMap.value, syncPositioningOriginDisplay, { immediate: true });
watch(() => draftMap.value?.metadata.activeFloorId, updateScaleRatioDisplay);
watch(() => draftMap.value, updateScaleRatioDisplay, { immediate: true });
function addAudit(content: string) {
  audits.unshift({ time: t('config.justNow'), content });
  if (audits.length > 5) {
    audits.pop();
  }
}

function recordSettingChange(title: string, enabled: boolean) {
  selectedSetting.value = title;
  addAudit(enabled ? t('config.enabled', { title }) : t('config.disabled', { title }));
}

function addRule() {
  const nextRule: RuleItem = {
    name: t('config.tempVisitorCrossing', { n: rules.length + 1 }),
    condition: t('config.tempVisitorCrossingCond'),
    level: 'warn',
    levelText: t('config.medium'),
  };
  rules.unshift(nextRule);
  selectedRuleName.value = nextRule.name;
  addAudit(t('config.ruleAdded', { name: nextRule.name }));
}

function showMessage(content: string) {
  message.value = content;
  window.setTimeout(() => {
    if (message.value === content) {
      message.value = '';
    }
  }, 2400);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return t('config.justNow');
  }

  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

function sanitizeModelNumberField(arr: number[], index: number, fallback = 0) {
  if (!Number.isFinite(arr[index])) {
    arr[index] = fallback;
  }
}

function commitBuildingModelParameters() {
  if (!draftMap.value) return;
  captureBuildingModelParameters(draftMap.value);
  applyBuildingSettingsToFloors(draftMap.value);
}

function commitBaseModelParameter(index: number) {
  if (!baseMapModel.value) return;
  sanitizeModelNumberField(baseMapModel.value.center, index);
  commitBuildingModelParameters();
}

function commitBaseModelRotation() {
  if (!baseMapModel.value) return;
  sanitizeModelNumberField(baseMapModel.value.rotation, 1);
  commitBuildingModelParameters();
}

function getPreviewBox(config: SceneConfig) {
  const xs: number[] = [];
  const ys: number[] = [];
  (config.areas ?? []).forEach((area) => {
    area.points?.forEach(([x, y]) => {
      xs.push(x);
      ys.push(y);
    });
  });
  (config.walls ?? []).forEach((wall) => {
    xs.push(wall.start[0], wall.end[0]);
    ys.push(wall.start[1], wall.end[1]);
  });

  if (xs.length === 0 || ys.length === 0) {
    return `0 0 ${Math.max(config.floor.width, 1)} ${Math.max(config.floor.height, 1)}`;
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = Math.max(Math.max(maxX - minX, maxY - minY) * 0.04, 20);
  return `${minX - padding} ${minY - padding} ${Math.max(maxX - minX + padding * 2, 1)} ${Math.max(maxY - minY + padding * 2, 1)}`;
}

function getSafeScaleRatio(map: SavedMap): number {
  const scaleRatio = map.metadata.scaleRatio;
  return Number.isFinite(scaleRatio) && scaleRatio > 0 ? scaleRatio : 100;
}

function syncScaleRatioToConfig(map: SavedMap) {
  const scaleRatio = getSafeScaleRatio(map);
  map.metadata.scaleRatio = scaleRatio;
  map.config.floor.scale = scaleRatio;
  map.metadata.floors.forEach((floor) => {
    floor.config.floor.scale = scaleRatio;
  });
}

function getUploadedModelId(modelPath: string | undefined): string | null {
  if (!modelPath) return null;
  const pathname = modelPath.split(/[?#]/, 1)[0].replace(/\\/g, '/');
  const match = pathname.match(/(?:^|\/)uploads\/models\/([^/]+)\.(?:glb|gltf)$/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function getBackendConfigId(map: SavedMap): string {
  const uploadedIds = map.metadata.floors
    .flatMap((floor) => floor.config.models)
    .concat(map.config.models)
    .filter((model) => model.role === 'base-map')
    .map((model) => getUploadedModelId(model.path))
    .filter((id): id is string => Boolean(id));

  return uploadedIds.find((id) => id === map.id) ?? uploadedIds[0] ?? map.id;
}

function captureBuildingModelParameters(map: SavedMap) {
  map.metadata.modelParameters = cloneModels(map.config.models);
}

function applyBuildingSettingsToFloors(map: SavedMap) {
  const parameters = cloneModels(map.metadata.modelParameters);
  const scaleRatio = getSafeScaleRatio(map);
  map.config.models = applySharedModelParameters(map.config.models, parameters);
  map.config.floor.scale = scaleRatio;
  map.metadata.floors.forEach((floor) => {
    floor.config.models = applySharedModelParameters(floor.config.models, parameters);
    floor.config.floor.scale = scaleRatio;
  });
}

function normalizeSceneModelCenters(config: SceneConfig) {
  config.models = config.models.map(normalizeModelConfig);
}

function cloneMapFloors(floors: MapFloorItem[]): MapFloorItem[] {
  return floors.map((floor) => ({
    ...floor,
    config: normalizeClonedSceneConfig(floor.config),
  }));
}

function normalizeClonedSceneConfig(config: SceneConfig): SceneConfig {
  const clonedConfig = cloneSceneConfig(config);
  normalizeSceneModelCenters(clonedConfig);
  return clonedConfig;
}

function syncActiveFloorFromConfig(map: SavedMap) {
  syncScaleRatioToConfig(map);
  captureBuildingModelParameters(map);
  applyBuildingSettingsToFloors(map);
  const activeFloorId = map.metadata.activeFloorId;
  const activeIndex = map.metadata.floors.findIndex((floor) => floor.id === activeFloorId);
  const floorItem: MapFloorItem = {
    id: map.config.floor.id || activeFloorId || `floor-${Date.now()}`,
    name: map.config.floor.name || t('config.floorLabel'),
    config: normalizeClonedSceneConfig(map.config),
  };

  if (activeIndex >= 0) {
    map.metadata.floors.splice(activeIndex, 1, floorItem);
  } else {
    map.metadata.floors.push(floorItem);
    map.metadata.activeFloorId = floorItem.id;
  }
}

function switchFloor(floorId: string) {
  if (!draftMap.value || floorId === draftMap.value.metadata.activeFloorId) {
    return;
  }

  syncActiveFloorFromConfig(draftMap.value);
  const targetFloor = draftMap.value.metadata.floors.find((floor) => floor.id === floorId);
  if (!targetFloor) {
    return;
  }

  draftMap.value.metadata.activeFloorId = targetFloor.id;
  draftMap.value.config = normalizeClonedSceneConfig(targetFloor.config);
  syncScaleRatioToConfig(draftMap.value);
  applyBuildingSettingsToFloors(draftMap.value);
  pickMode.value = null;
  previewRestoreView = null;
  previewHasFramed = false;
  previewClickedPoint.value = null;
}

function handleFloorSelect(event: Event) {
  switchFloor((event.target as HTMLSelectElement).value);
}

function addFloor() {
  if (!draftMap.value) {
    return;
  }

  syncActiveFloorFromConfig(draftMap.value);
  const floorNumber = draftMap.value.metadata.floors.length + 1;
  const config = createBlankSceneConfig(t('config.floorNameDefault', { n: floorNumber }));
  config.floor.id = `floor-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  config.floor.scale = draftMap.value.metadata.scaleRatio;
  const floorItem: MapFloorItem = {
    id: config.floor.id,
    name: config.floor.name,
    config,
  };
  draftMap.value.metadata.floors.push(floorItem);
  switchFloor(floorItem.id);
}

function removeCurrentFloor() {
  if (!draftMap.value || draftMap.value.metadata.floors.length <= 1) {
    return;
  }

  if (!window.confirm(t('config.confirmDeleteFloor', { name: draftMap.value.config.floor.name }))) {
    return;
  }

  const activeFloorId = draftMap.value.metadata.activeFloorId;
  const nextFloors = draftMap.value.metadata.floors.filter((floor) => floor.id !== activeFloorId);
  draftMap.value.metadata.floors = nextFloors;
  const nextFloor = nextFloors[0];
  draftMap.value.metadata.activeFloorId = nextFloor.id;
  draftMap.value.config = normalizeClonedSceneConfig(nextFloor.config);
  syncScaleRatioToConfig(draftMap.value);
  applyBuildingSettingsToFloors(draftMap.value);
}

function updateCurrentFloorName() {
  if (!draftMap.value) {
    return;
  }

  const floor = currentFloor.value;
  if (floor) {
    floor.name = draftMap.value.config.floor.name;
  }
}

function copyPreviewView(): PreviewViewState {
  return {
    targetX: previewView.targetX,
    targetY: previewView.targetY,
    targetZ: previewView.targetZ,
    distance: previewView.distance,
    yaw: previewView.yaw,
    pitch: previewView.pitch,
  };
}

function applyPreviewViewState(state: PreviewViewState) {
  previewView.targetX = state.targetX;
  previewView.targetY = state.targetY;
  previewView.targetZ = state.targetZ;
  previewView.distance = state.distance;
  previewView.yaw = state.yaw;
  previewView.pitch = state.pitch;
  updatePreviewCamera();
}

function setPreviewTopDownView() {
  const size = transformRange.value;
  previewView.targetY = 0;
  previewView.distance = Math.max(size * 1.25, 420);
  previewView.yaw = 0;
  previewView.pitch = 89.5;
  updatePreviewCamera();
}

function updatePreviewCamera() {
  if (!previewCamera) {
    return;
  }

  const pitch = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(previewView.pitch, 8, 89.5));
  const yaw = THREE.MathUtils.degToRad(previewView.yaw);
  const distance = Math.max(previewView.distance, 20);
  const horizontalDistance = Math.cos(pitch) * distance;
  const target = new THREE.Vector3(previewView.targetX, previewView.targetY, previewView.targetZ);
  previewCamera.position.set(
    target.x + Math.sin(yaw) * horizontalDistance,
    target.y + Math.sin(pitch) * distance,
    target.z + Math.cos(yaw) * horizontalDistance,
  );
  previewCamera.near = Math.max(distance / 2000, 0.1);
  previewCamera.far = Math.max(distance * 8, 1000);
  previewCamera.lookAt(target);
  previewCamera.updateProjectionMatrix();
}

function ensurePreviewRenderer() {
  const container = preview3dRef.value;
  if (!container) {
    return null;
  }

  if (!previewRenderer) {
    previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    previewRenderer.setClearColor(0xf3f7ff, 1);
    container.appendChild(previewRenderer.domElement);

    previewScene = new THREE.Scene();
    previewCamera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 100000);
    updatePreviewCamera();

    previewScene.add(new THREE.HemisphereLight(0xffffff, 0x6f7d91, 1.7));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
    directionalLight.position.set(320, 520, 260);
    previewScene.add(directionalLight);

    previewResizeObserver = new ResizeObserver(resizePreviewRenderer);
    previewResizeObserver.observe(container);
    startPreviewLoop();
  }

  if (previewRenderer.domElement.parentElement !== container) {
    container.appendChild(previewRenderer.domElement);
  }

  resizePreviewRenderer();
  updatePreviewCamera();
  return { renderer: previewRenderer, scene: previewScene, camera: previewCamera };
}

function resizePreviewRenderer() {
  if (!previewRenderer || !previewCamera || !preview3dRef.value) {
    return;
  }

  const { clientWidth, clientHeight } = preview3dRef.value;
  const width = Math.max(clientWidth, 1);
  const height = Math.max(clientHeight, 1);
  previewRenderer.setSize(width, height, false);
  previewCamera.aspect = width / height;
  previewCamera.updateProjectionMatrix();
}

function startPreviewLoop() {
  const render = () => {
    previewFrameId = window.requestAnimationFrame(render);
    updatePreviewCamera();
    if (previewRenderer && previewScene && previewCamera) {
      previewRenderer.render(previewScene, previewCamera);
    }
  };
  render();
}

function disposePreviewObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}

function clearPreviewScene() {
  if (!previewScene) {
    return;
  }

  const persistent = new Set<THREE.Object3D>(previewScene.children.filter((child) => child instanceof THREE.Light));
  [...previewScene.children].forEach((child) => {
    if (!persistent.has(child)) {
      previewScene?.remove(child);
      disposePreviewObject(child);
    }
  });
  previewModelObjects.clear();
  previewAuxObjects = [];
  previewAssetSignature = '';
  previewLayoutSignature = '';
}

function clearPreviewAuxObjects() {
  if (!previewScene) {
    return;
  }

  previewAuxObjects.forEach((object) => {
    previewScene?.remove(object);
    disposePreviewObject(object);
  });
  previewAuxObjects = [];
}

function addPreviewAuxObject(object: THREE.Object3D) {
  previewAuxObjects.push(object);
  previewScene?.add(object);
}

function getPreviewModelKey(modelConfig: ModelConfig, index: number): string {
  return `${index}:base-map:${modelConfig.path}`;
}

function getPreviewAssetSignature(config: SceneConfig): string {
  return config.models.map((model, index) => getPreviewModelKey(model, index)).join('|');
}

function getPreviewLayoutSignature(config: SceneConfig, origin: [number, number, number]): string {
  return `${config.floor.width}|${config.floor.height}|${origin[0]}|${origin[1]}|${origin[2]}|${config.floor.scale}`;
}

function resolveModelUrl(modelPath: string | undefined | null): string | null {
  if (!modelPath) {
    return null;
  }

  if (/^(data:|blob:|https?:\/\/)/i.test(modelPath)) {
    return modelPath;
  }

  if (modelPath.startsWith('/') && !modelPath.startsWith('/src/assets/model/')) {
    return versionModelAssetUrl(modelPath);
  }

  const configuredPath = modelPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const directKey = `/src/assets/model/${configuredPath}`;
  if (modelModules[directKey]) {
    return modelModules[directKey];
  }

  const fallbackEntry = Object.entries(modelModules).find(([key]) => key.endsWith(`/${configuredPath}`));
  if (fallbackEntry) {
    return fallbackEntry[1];
  }

  return import.meta.env.DEV ? directKey : null;
}

function applyPreviewModelConfig(model: THREE.Object3D, modelConfig: ModelConfig, config: SceneConfig) {
  const { scale, center, rotation } = modelConfig;
  const modelX = Number.isFinite(Number(center[0])) ? Number(center[0]) : 0;
  const modelY = center.length > 2 ? (Number.isFinite(Number(center[1])) ? Number(center[1]) : 0) : 0;
  const modelZ = center.length > 2 ? (Number.isFinite(Number(center[2])) ? Number(center[2]) : 0) : (Number.isFinite(Number(center[1])) ? Number(center[1]) : 0);
  const floorScaleRatio = Number(config.floor.scale);
  const scaleRatioFactor =
    modelConfig.role !== 'base-map' || !Number.isFinite(floorScaleRatio) || floorScaleRatio <= 0
      ? 1
      : floorScaleRatio / DEFAULT_MODEL_SCALE_RATIO;

  const modelScale = Number(scale);
  const finalScale = (Number.isFinite(modelScale) && modelScale > 0 ? modelScale : 1) * scaleRatioFactor;
  model.scale.setScalar(finalScale);
  model.rotation.set(
    THREE.MathUtils.degToRad(Number.isFinite(Number(rotation[0])) ? Number(rotation[0]) : 0),
    THREE.MathUtils.degToRad(Number.isFinite(Number(rotation[1])) ? Number(rotation[1]) : 0),
    THREE.MathUtils.degToRad(Number.isFinite(Number(rotation[2])) ? Number(rotation[2]) : 0),
  );

  // Compute bounding box at origin to get true local center without position offset,
  // preventing position drift on repeated updates.
  model.position.set(0, 0, 0);
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const localCenter = box.getCenter(new THREE.Vector3());
  const minY = box.min.y;
  model.position.set(modelX - localCenter.x, modelY - minY, modelZ - localCenter.z);
}

function createPositioningOriginMarker(point: [number, number, number]) {
  const group = new THREE.Group();
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(8, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0x14a46c, roughness: 0.45 }),
  );
  marker.position.set(point[0], point[1] + 8, point[2]);
  group.add(marker);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(16, 1.8, 12, 36),
    new THREE.MeshBasicMaterial({ color: 0x14a46c }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(point[0], Math.max(point[1], 0) + 0.3, point[2]);
  group.add(ring);
  return group;
}

function createPreviewGrid(config: SceneConfig) {
  const size = Math.max(config.floor.width, config.floor.height, 100);
  const divisions = Math.max(Math.round(size / 100), 4);
  const grid = new THREE.GridHelper(size, divisions, 0x8ca3c7, 0xd2dbea);
  grid.position.y = -0.05;
  return grid;
}

function createTextSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = color;
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 8;
  ctx.fillText(text, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  return new THREE.Sprite(material);
}

function createXDirectionIndicator(config: SceneConfig) {
  const maxDim = Math.max(config.floor.width, config.floor.height, 100);
  const length = maxDim * 0.12;
  const headLength = length * 0.2;
  const headWidth = length * 0.12;
  const margin = length * 0.3;

  const group = new THREE.Group();

  // X-axis positive direction arrow at the bottom-left corner of the grid,
  // pointing right (toward positive X)
  const origin = new THREE.Vector3(
    -maxDim / 2 + margin,
    0.15,
    -maxDim / 2 + margin,
  );
  const arrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0), origin, length,
    0xe74c3c, headLength, headWidth,
  );
  group.add(arrow);

  const labelScale = maxDim * 0.028;
  const label = createTextSprite('X', '#e74c3c');
  label.position.set(origin.x + length + labelScale * 0.6, origin.y, origin.z);
  label.scale.set(labelScale, labelScale, 1);
  group.add(label);

  return group;
}

async function rebuildPreviewScene() {
  const map = draftMap.value;
  const preview = ensurePreviewRenderer();
  if (!map || !preview?.scene || !preview.camera) {
    console.warn('[Preview] abort rebuild — missing:', { map: !!map, scene: !!preview?.scene, camera: !!preview?.camera, preview3dRef: !!preview3dRef.value });
    return;
  }

  const token = ++previewBuildToken;
  const config = normalizeClonedSceneConfig(map.config);
  const positioningOrigin = [...map.metadata.positioningOrigin] as [number, number, number];
  const assetSignature = getPreviewAssetSignature(config);
  const layoutSignature = getPreviewLayoutSignature(config, positioningOrigin);
  const needsAssetReload = assetSignature !== previewAssetSignature;
  const needsLayoutUpdate = layoutSignature !== previewLayoutSignature || needsAssetReload;
  // Track model config changes (scale, center, rotation) that affect visual size/position
  const scaleSignature = config.models.map((m, i) => `${i}:${m.scale}:${m.center?.join(',')}:${m.role}:${config.floor.scale}`).join('|');
  const needsCameraReframe = scaleSignature !== previewScaleSignature;
  if (needsCameraReframe) {
    previewScaleSignature = scaleSignature;
    previewHasFramed = false;
  }
  if (needsAssetReload) {
    clearPreviewScene();
    previewAssetSignature = assetSignature;
  }
  if (needsLayoutUpdate) {
    clearPreviewAuxObjects();
    addPreviewAuxObject(createPreviewGrid(config));
    addPreviewAuxObject(createXDirectionIndicator(config));
    addPreviewAuxObject(createPositioningOriginMarker(positioningOrigin));
    previewLayoutSignature = layoutSignature;
  }

  const loadedModels: THREE.Object3D[] = [];
  for (const [index, modelConfig] of config.models.entries()) {
    const modelKey = getPreviewModelKey(modelConfig, index);
    const cachedModel = previewModelObjects.get(modelKey);
    if (cachedModel) {
      applyPreviewModelConfig(cachedModel, modelConfig, config);
      loadedModels.push(cachedModel);
      continue;
    }

    const modelUrl = resolveModelUrl(modelConfig.path);
    if (!modelUrl) {
      console.warn('[Preview] no URL for model:', modelConfig.path);
      continue;
    }

    try {
      const gltf = await gltfLoader.loadAsync(modelUrl);
      if (token !== previewBuildToken) {
        disposePreviewObject(gltf.scene);
        return;
      }
      const model = gltf.scene.clone(true);
      model.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      applyPreviewModelConfig(model, modelConfig, config);
      preview.scene.add(model);
      previewModelObjects.set(modelKey, model);
      loadedModels.push(model);
    } catch (error) {
      console.warn(`Failed to load preview model ${modelConfig.path}`, error);
    }
  }

  if (!previewHasFramed || pickMode.value) {
    framePreviewCamera(loadedModels, config);
    previewHasFramed = true;
  } else {
    updatePreviewCamera();
  }
}

function framePreviewCamera(models: THREE.Object3D[], config: SceneConfig) {
  if (!previewCamera) {
    return;
  }

  const box = new THREE.Box3();
  models.forEach((model) => box.expandByObject(model));
  if (box.isEmpty()) {
    const size = Math.max(config.floor.width, config.floor.height, 100);
    box.setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(size, 20, size));
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 100);
  previewView.targetX = center.x;
  previewView.targetY = center.y;
  previewView.targetZ = center.z;
  previewView.distance = Math.max(radius * 1.45, 260);
  if (pickMode.value) {
    setPreviewTopDownView();
  } else {
    updatePreviewCamera();
  }
}

function getPreviewPlanePoint(event: MouseEvent): [number, number, number] | null {
  if (!previewCamera || !previewRenderer) {
    return null;
  }

  const rect = previewRenderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -(((event.clientY - rect.top) / rect.height) * 2 - 1),
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, previewCamera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const target = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, target)) {
    return null;
  }

  return [
    Number(target.x.toFixed(2)),
    0,
    Number(target.z.toFixed(2)),
  ];
}

function formatPoints(points: AreaConfig['points']) {
  return points.map((point) => point.join(',')).join(' ');
}

function syncMaps(nextMaps: SavedMap[]) {
  try {
    maps.value = nextMaps;
    saveMapLibrary(nextMaps);
  } catch {
    showMessage(t('config.saveFailed'));
  }
}

/** Convert a backend MapModelDetail to the local SavedMap format. */
function modelDetailToSavedMap(detail: MapModelDetail): SavedMap | null {
  // Backend may return models whose detail doesn't include full config/metadata yet.
  // Validate required fields and fill defaults before converting.
  if (!detail.config || !isSceneConfig(detail.config)) {
    console.warn('[loadMapsFromApi] skipping map with incomplete config:', detail.id, detail.name);
    return null;
  }
  const saved: SavedMap = {
    id: detail.id,
    name: detail.name,
    description: detail.description || '',
    updatedAt: detail.updatedAt || new Date().toISOString(),
    config: cloneSceneConfig(detail.config),
    metadata: createDefaultMetadata(detail.config, detail.metadata),
  };
  return saved;
}

/** Try to load custom maps from the backend API and merge into the local list. */
async function loadMapsFromApi() {
  try {
    const models = await apiFetchModelList();
    if (!models.length) return;

    // Load full detail for each model (parallel)
    const details = await Promise.all(
      models.map((m) => apiFetchModelDetail(m.id).catch(() => null)),
    );

    const apiMaps: SavedMap[] = details
      .filter((d): d is MapModelDetail => d !== null)
      .map(modelDetailToSavedMap)
      .filter((m): m is SavedMap => m !== null);

    // Merge: replace any existing map with same id, keep the rest
    const merged = [...maps.value];
    for (const apiMap of apiMaps) {
      const idx = merged.findIndex((m) => m.id === apiMap.id);
      if (idx >= 0) {
        merged[idx] = apiMap;
      } else {
        merged.push(apiMap);
      }
    }

    maps.value = merged;
    saveMapLibrary(merged);
  } catch {
    // API not available — keep localStorage data as-is
  }
}

// Kick off the API load once the component mounts. The ref is already
// populated from localStorage so the UI is immediately usable.
void loadMapsFromApi();

function openEditor(map: SavedMap) {
  previewHasFramed = false;
  previewRestoreView = null;
  previewClickedPoint.value = null;
  draftMap.value = {
    ...map,
    metadata: {
      ...map.metadata,
      mapOrigin: [...map.metadata.mapOrigin] as [number, number, number],
      positioningOrigin: [...map.metadata.positioningOrigin] as [number, number, number],
      modelParameters: cloneModels(map.metadata.modelParameters),
      floors: cloneMapFloors(map.metadata.floors),
    },
    config: normalizeClonedSceneConfig(map.config),
  };
  syncScaleRatioToConfig(draftMap.value);
  applyBuildingSettingsToFloors(draftMap.value);
  viewMode.value = 'edit';

  // Update URL to include map ID so refresh restores the editor
  const editorUrl = `/config/map-editor/${encodeURIComponent(map.id)}`;
  if (window.location.pathname !== editorUrl) {
    window.history.pushState({}, '', editorUrl);
  }
}

function closeEditor() {
  if (baseMapImporting.value) {
    console.warn('[MapEditor] closeEditor suppressed — base map upload in progress');
    return;
  }
  draftMap.value = null;
  viewMode.value = 'list';
  pickMode.value = null;
  thumbnailUploadStatus.value = '';
  previewRestoreView = null;
  previewClickedPoint.value = null;
  navigateToMapList();
}

function createBlankMap() {
  const map = createSavedMap(t('config.unnamedMap'), t('config.blankMap'), createBlankSceneConfig());
  syncMaps([map, ...maps.value]);
  openEditor(map);
}

function saveDraft() {
  if (!draftMap.value) {
    return;
  }
  syncScaleRatioToConfig(draftMap.value);
  syncActiveFloorFromConfig(draftMap.value);

  const nextMap: SavedMap =
    draftMap.value.id === DEFAULT_MAP_ID
      ? createSavedMap(
          draftMap.value.name || t('config.defaultMapCopy'),
          draftMap.value.description || t('config.fromDefaultEdit'),
          draftMap.value.config,
          draftMap.value.metadata,
        )
      : {
          ...draftMap.value,
          name: draftMap.value.name || t('config.unnamedMap'),
          updatedAt: new Date().toISOString(),
          metadata: {
            ...draftMap.value.metadata,
            scaleRatio: Number(draftMap.value.metadata.scaleRatio) > 0 ? Number(draftMap.value.metadata.scaleRatio) : 100,
            modelParameters: cloneModels(draftMap.value.metadata.modelParameters),
            floors: cloneMapFloors(draftMap.value.metadata.floors),
          },
          config: normalizeClonedSceneConfig(draftMap.value.config),
        };

  const nextMaps = maps.value.some((item) => item.id === nextMap.id)
    ? maps.value.map((item) => (item.id === nextMap.id ? nextMap : item))
    : [nextMap, ...maps.value];
  syncMaps(nextMaps);
  draftMap.value = { ...nextMap, config: normalizeClonedSceneConfig(nextMap.config) };
  if (sceneStore.activeMapId === nextMap.id) {
    sceneStore.setActiveMap(nextMap.id, normalizeClonedSceneConfig(nextMap.config));
  }

  // Uploaded model/config files use the server-generated model ID. Legacy
  // locally-created maps may still have a different `map-*` browser ID, so
  // resolve the backend ID from the persisted model path before saving.
  if (nextMap.id !== DEFAULT_MAP_ID) {
    const backendConfigId = getBackendConfigId(nextMap);
    apiSaveModelConfig(backendConfigId, {
      name: nextMap.name,
      description: nextMap.description,
      config: nextMap.config,
      metadata: nextMap.metadata,
      thumbnail: nextMap.metadata.thumbnail || undefined,
    }).catch((error) => {
      console.error(`[saveDraft] failed to save backend config ${backendConfigId}`, error);
      const reason = error instanceof Error ? error.message : t('config.mapSaveServerFailed');
      showMessage(t('config.mapSaveServerFailed', { reason }));
    });
  }

  showMessage(t('config.mapSaved'));
}

function applyMap(map: SavedMap) {
  sceneStore.setActiveMap(map.id, normalizeClonedSceneConfig(map.config));
  showMessage(t('config.mapApplied', { name: map.name }));
}

function applyDraft() {
  if (!draftMap.value) {
    return;
  }

  saveDraft();
  applyMap(draftMap.value);
}

async function deleteMap(map: SavedMap) {
  if (map.id === DEFAULT_MAP_ID) {
    return;
  }

  if (!window.confirm(t('config.confirmDeleteModel', { name: map.name }))) {
    return;
  }

  const nextMaps = maps.value.filter((item) => item.id !== map.id);

  // Delete via backend API (removes model file + config JSON + thumbnail)
  apiDeleteModel(getBackendConfigId(map)).catch(() => {
    // Backend not available — silently ignore; localStorage will be cleaned up.
  });

  syncMaps(nextMaps);
  if (sceneStore.activeMapId === map.id) {
    const fallbackMap = nextMaps[0];
    sceneStore.setActiveMap(fallbackMap.id, normalizeClonedSceneConfig(fallbackMap.config));
  }
  showMessage(t('config.mapDeleted', { name: map.name }));
}

async function importMapFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) {
    return;
  }

  mapImporting.value = true;
  try {
    if (/\.(glb|gltf)$/i.test(file.name)) {
      const mapName = file.name.replace(/\.(glb|gltf)$/i, '');
      const config = createBlankSceneConfig(mapName);
      config.models.push({
        path: '', // will be filled from API response
        scale: 1, // native scale; use 比例尺 to adjust
        center: [0, 0, 0],
        rotation: [0, 0, 0],
        role: 'base-map',
      });

      // Upload via backend API
      const detail = await apiUploadModel(file, mapName, t('config.importedFrom', { file: file.name }));
      // Update model path from the API response
      config.models[0].path = detail.modelPath;

      // Use the backend-generated ID so the map ID matches the server's
      // config file name (uploads/configs/{id}.json), enabling future
      // re-uploads to overwrite the same model file.
      const map = {
        ...createSavedMap(mapName, t('config.importedFrom', { file: file.name }), config, detail.metadata),
        id: detail.id,
      };
      syncMaps([map, ...maps.value]);

      // Open editor — the deep watcher will trigger rebuildPreviewScene,
      // which loads the model via URL through the /uploads proxy.
      openEditor(map);
      showMessage(t('config.mapImportedGLB', { scale: 1 }));
      return;
    }

    if (!/\.json$/i.test(file.name)) {
      showMessage(t('config.invalidFileType'));
      return;
    }

    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    const config = isSceneConfig(parsed) ? parsed : (parsed as { config?: unknown }).config;
    if (!isSceneConfig(config)) {
      showMessage(t('config.importConfigFailed'));
      return;
    }

    const map = createSavedMap(config.floor.name || file.name.replace(/\.json$/i, ''), `从 ${file.name} 导入`, config);
    syncMaps([map, ...maps.value]);
    openEditor(map);
    showMessage(t('config.mapSaved'));
  } catch (error) {
    console.error('[ImportMap] ERROR:', error);
    const errorMessage =
      error instanceof TypeError
        ? t('config.uploadServiceError')
        : error instanceof Error
          ? error.message
          : t('config.mapImportFailed');
    showMessage(errorMessage);
  } finally {
    mapImporting.value = false;
  }
}

async function importThumbnailFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !draftMap.value) {
    return;
  }

  if (!/\.(png|jpe?g|webp)$/i.test(file.name)) {
    thumbnailUploadStatus.value = t('config.coverInvalidFile');
    showMessage(thumbnailUploadStatus.value);
    return;
  }

  thumbnailUploading.value = true;
  thumbnailUploadStatus.value = `${t('config.uploading')} ${file.name}...`;
  try {
    const thumbnailPath = await apiUploadThumbnail(file);
    draftMap.value.metadata.thumbnail = thumbnailPath;
    thumbnailUploadStatus.value = t('config.coverSaved');
    showMessage(thumbnailUploadStatus.value);
  } catch (error) {
    const errorMessage =
      error instanceof TypeError
        ? t('config.coverUploadError')
        : error instanceof Error
          ? error.message
          : t('config.coverUploadFailed');
    thumbnailUploadStatus.value = errorMessage;
    showMessage(errorMessage);
  } finally {
    thumbnailUploading.value = false;
  }
}

function openMapFilePicker() {
  mapFileInput.value?.click();
}

function openBaseMapFilePicker() {
  baseMapFileInput.value?.click();
}

function replaceCurrentFloorBaseMap(baseModel: ModelConfig) {
  if (!draftMap.value) {
    return;
  }

  const nonBaseModels = draftMap.value.config.models.filter((model) => model.role !== 'base-map');
  draftMap.value.config.models = [normalizeModelConfig(baseModel), ...cloneModels(nonBaseModels)];
  captureBuildingModelParameters(draftMap.value);
  applyBuildingSettingsToFloors(draftMap.value);
  syncActiveFloorFromConfig(draftMap.value);
}

function openThumbnailFilePicker() {
  thumbnailFileInput.value?.click();
}

function clearThumbnail() {
  if (!draftMap.value) {
    return;
  }

  if (!window.confirm(t('config.confirmDeleteCover'))) {
    return;
  }

  draftMap.value.metadata.thumbnail = '';
  thumbnailUploadStatus.value = '';
}

function handlePreviewPointerDown(event: MouseEvent) {
  if (!previewRenderer || event.button === 1) {
    return;
  }

  previewClickBlocked = false;
  previewDragState = {
    mode: event.button === 0 ? 'rotate' : 'pan',
    lastX: event.clientX,
    lastY: event.clientY,
  };
  window.addEventListener('mousemove', handlePreviewWindowMove);
  window.addEventListener('mouseup', handlePreviewWindowUp, { once: true });
}

function handlePreviewWindowMove(event: MouseEvent) {
  if (!previewDragState) {
    return;
  }

  const deltaX = event.clientX - previewDragState.lastX;
  const deltaY = event.clientY - previewDragState.lastY;
  previewDragState.lastX = event.clientX;
  previewDragState.lastY = event.clientY;
  if (Math.abs(deltaX) + Math.abs(deltaY) > 3) {
    previewClickBlocked = true;
  }

  if (previewDragState.mode === 'rotate' && !pickMode.value) {
    previewView.yaw -= deltaX * 0.32;
    previewView.pitch = THREE.MathUtils.clamp(previewView.pitch + deltaY * 0.24, 12, 82);
    updatePreviewCamera();
    return;
  }

  panPreviewByPixels(deltaX, deltaY);
}

function handlePreviewWindowUp() {
  window.removeEventListener('mousemove', handlePreviewWindowMove);
  previewDragState = null;
  window.setTimeout(() => {
    previewClickBlocked = false;
  }, 0);
}

function panPreviewByPixels(deltaX: number, deltaY: number) {
  if (!previewCamera || !previewRenderer) {
    return;
  }

  const rect = previewRenderer.domElement.getBoundingClientRect();
  const panScale = previewView.distance / Math.max(rect.height, 1);
  const target = new THREE.Vector3(previewView.targetX, previewView.targetY, previewView.targetZ);
  const forward = new THREE.Vector3().subVectors(target, previewCamera.position).normalize();
  const right = new THREE.Vector3().crossVectors(forward, previewCamera.up).normalize();
  const upOnPlane = new THREE.Vector3().crossVectors(right, new THREE.Vector3(0, 1, 0)).normalize();

  previewView.targetX += (-right.x * deltaX - upOnPlane.x * deltaY) * panScale;
  previewView.targetZ += (-right.z * deltaX - upOnPlane.z * deltaY) * panScale;
  updatePreviewCamera();
}

function handlePreviewWheel(event: WheelEvent) {
  const scale = event.deltaY > 0 ? 1.12 : 0.88;
  previewView.distance = THREE.MathUtils.clamp(previewView.distance * scale, 40, Math.max(transformRange.value * 8, 1200));
  updatePreviewCamera();
}

function startPick(mode: PickMode) {
  if (!pickMode.value) {
    previewRestoreView = copyPreviewView();
  }
  pickMode.value = mode;
  setPreviewTopDownView();
}

function cancelPick() {
  pickMode.value = null;
  if (previewRestoreView) {
    applyPreviewViewState(previewRestoreView);
    previewRestoreView = null;
  }
}

async function importBaseMapFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !draftMap.value) {
    return;
  }

  if (!/\.(glb|gltf)$/i.test(file.name)) {
    showMessage(t('config.modelInvalidFile'));
    return;
  }

  baseMapImporting.value = true;

  try {
    // Each floor keeps its own model path. Replacing the current floor reuses
    // the map file only when that floor already has a base model.
    const existingBase = draftMap.value.config.models.find((m) => m.role === 'base-map');
    const existingBaseId = getUploadedModelId(existingBase?.path);
    const hasUploadedBaseModel = draftMap.value.metadata.floors.some((floor) =>
      floor.config.models.some((model) => model.role === 'base-map' && getUploadedModelId(model.path)),
    );
    // The first upload for a blank local map creates the server config under
    // the local map ID. Replacing an existing floor model reuses that model's
    // own server ID; adding another floor gets a separate model asset ID.
    const uploadId = existingBaseId ?? (!hasUploadedBaseModel ? draftMap.value.id : undefined);
    const detail = await apiUploadModel(file, undefined, undefined, undefined, uploadId);

    // The re-upload keeps the same URL; bump its asset version so the preview
    // (THREE.Cache + browser cache) reloads the new bytes instead of the old GLB.
    invalidateModelAssetUrl(detail.modelPath);

    // Keep the previous base map's transform when replacing. replaceCurrentFloorBaseMap
    // propagates modelParameters to every floor (shared building alignment), so if we
    // always reset to scale 2.5 / [0,0,0] here, replacing ONE floor's map would reset
    // ALL floors' base maps to the origin — the "更换地图" regression.
    const baseModel: ModelConfig = {
      path: detail.modelPath,
      scale: existingBase && Number.isFinite(existingBase.scale) ? existingBase.scale : 2.5,
      center: existingBase?.center ? ([...existingBase.center] as [number, number, number]) : [0, 0, 0],
      rotation: existingBase?.rotation ? ([...existingBase.rotation] as [number, number, number]) : [0, 0, 0],
      role: 'base-map',
    };

    // Force the preview to treat this as a new asset - file content may have changed.
    previewAssetSignature = '';
    previewModelObjects.clear();

    replaceCurrentFloorBaseMap(baseModel);
    previewHasFramed = false;

    showMessage(t('config.baseMapReady', { path: detail.modelPath, scale: baseModel.scale }));
  } catch (error) {
    const errorMessage =
      error instanceof TypeError
        ? t('config.modelUploadError')
        : error instanceof Error
          ? error.message
          : t('config.modelImportFailed');
    showMessage(errorMessage);
  } finally {
    baseMapImporting.value = false;
  }
}

function handlePreviewClick(event: MouseEvent) {
  if (!draftMap.value) {
    return;
  }

  if (previewClickBlocked) {
    previewClickBlocked = false;
    return;
  }

  const mapPoint = getPreviewPlanePoint(event);
  if (!mapPoint) {
    return;
  }
  previewClickedPoint.value = mapPoint;
  if (!pickMode.value) {
    return;
  }

  if (pickMode.value === 'positioning-origin') {
    draftMap.value.metadata.positioningOrigin = [
      mapPoint[0],
      0,
      mapPoint[2],
    ];
    applyBuildingSettingsToFloors(draftMap.value);
    syncPositioningOriginDisplay();
    showMessage(t('config.positioningOriginUpdated'));
  }

  pickMode.value = null;
  if (previewRestoreView) {
    applyPreviewViewState(previewRestoreView);
    previewRestoreView = null;
  }
}

watch(
  () => (viewMode.value === 'edit' ? draftMap.value : null),
  () => {
    if (viewMode.value !== 'edit') {
      return;
    }
    void nextTick(() => {
      void rebuildPreviewScene();
    });
  },
  { deep: true, flush: 'post' },
);

// Auto-open editor when navigating directly to a map-editor/:mapId route
watch(
  () => props.editMapId,
  (mapId) => {
    if (!mapId || viewMode.value === 'edit') return;
    const target = maps.value.find((m) => m.id === mapId);
    if (target) {
      openEditor(target);
    }
  },
  { immediate: true },
);

// When the user clicks "back" from the editor, navigate to the map-list route
function navigateToMapList() {
  const baseUrl = '/config/map-editor';
  if (window.location.pathname !== baseUrl) {
    window.history.pushState({}, '', baseUrl);
  }
}

onBeforeUnmount(() => {
  previewBuildToken += 1;
  window.removeEventListener('mousemove', handlePreviewWindowMove);
  if (previewFrameId) {
    window.cancelAnimationFrame(previewFrameId);
  }
  previewResizeObserver?.disconnect();
  clearPreviewScene();
  previewRenderer?.dispose();
  previewRenderer?.domElement.remove();
  previewRenderer = null;
  previewScene = null;
  previewCamera = null;
});


</script>

<style scoped>
.map-editor-page {
  position: relative;
  display: grid;
  gap: 14px;
}

.map-toolbar,
.editor-header,
.map-row,
.preview-panel,
.form-panel {
  border: 1px solid rgba(118, 148, 212, 0.2);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(243, 247, 255, 0.94));
  box-shadow: 0 16px 34px rgba(31, 55, 93, 0.08);
}

.map-toolbar,
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px;
}

.map-toolbar h2,
.editor-header h2,
.preview-panel h3,
.form-panel h3 {
  margin: 0 0 6px;
  color: #142033;
}

.map-toolbar p,
.editor-header p,
.map-row__content p {
  margin: 0;
  color: rgba(47, 63, 89, 0.72);
  line-height: 1.6;
}

.toolbar-actions,
.map-row__actions,
.pick-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.floor-management-actions,
.origin-editor {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.floor-management-actions select,
.floor-management-actions button,
.origin-editor input {
  min-height: 34px;
}

.origin-editor {
  padding: 10px 0 0;
}

.origin-editor label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: rgba(47, 63, 89, 0.76);
  font-size: 12px;
  font-weight: 700;
}

.origin-editor input {
  width: 88px;
  padding: 0 8px;
}

.map-editor-page button,
.map-editor-page .upload-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(88, 119, 174, 0.28);
  border-radius: 6px;
  background: #fff;
  color: #20314f;
  cursor: pointer;
  font-weight: 700;
}

.map-editor-page button:disabled {
  cursor: not-allowed;
  opacity: 0.44;
}

.map-editor-page .primary-button {
  border-color: rgba(28, 94, 214, 0.56);
  background: #1f6feb;
  color: #fff;
}

.map-editor-page button.active {
  border-color: rgba(31, 111, 235, 0.62);
  background: rgba(31, 111, 235, 0.12);
  color: #174ea6;
}

.map-editor-page .ghost-button,
.map-editor-page .back-button {
  background: rgba(236, 242, 255, 0.9);
}

.map-editor-page .upload-button input,
.map-editor-page .model-file-input {
  display: none;
}

.map-list {
  display: grid;
  gap: 12px;
}

.map-row {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 14px;
}

.map-row.active {
  border-color: rgba(31, 111, 235, 0.48);
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.98), rgba(250, 252, 255, 0.98));
}

.map-row__preview,
.map-preview {
  overflow: hidden;
  border: 1px solid rgba(89, 119, 168, 0.18);
  border-radius: 8px;
  background: #eef4fb;
}

.map-row__preview {
  height: 92px;
}

.map-row__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.map-row svg {
  width: 100%;
  height: 100%;
}

.map-editor-page polygon {
  fill: rgba(91, 141, 203, 0.18);
  stroke: rgba(46, 96, 168, 0.4);
  stroke-width: 2;
}

.map-editor-page line {
  stroke: rgba(22, 39, 67, 0.58);
  stroke-width: 3;
}

.map-editor-page circle {
  fill: #d9480f;
}

.map-editor-page .origin-marker circle {
  fill: #1f6feb;
  stroke: #fff;
  stroke-width: 3;
}

.map-editor-page .positioning-marker circle {
  fill: #14a46c;
  stroke: #fff;
  stroke-width: 3;
}

.map-editor-page text {
  fill: #17233c;
  font-size: 18px;
  font-weight: 800;
  paint-order: stroke;
  stroke: rgba(255, 255, 255, 0.82);
  stroke-width: 4;
}

.map-row__title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.map-row__title h3 {
  margin: 0;
  color: #142033;
}

.map-row__title span {
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(31, 111, 235, 0.12);
  color: #1d5db8;
  font-size: 12px;
  font-weight: 700;
}

.map-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.map-row__meta span,
.preview-stats span {
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(47, 73, 113, 0.08);
  color: rgba(38, 54, 82, 0.72);
  font-size: 12px;
}

.editor-layout {
  display: grid;
  grid-template-columns: minmax(360px, 0.92fr) minmax(0, 1.08fr);
  gap: 14px;
}

.preview-panel,
.form-panel {
  padding: 18px;
}

.preview-panel {
  display: grid;
  align-content: start;
  gap: 12px;
  grid-column: 1 / -1;
  order: 10;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-heading p {
  margin: 0;
  color: rgba(47, 63, 89, 0.68);
  font-size: 13px;
  line-height: 1.5;
}

.map-preview {
  aspect-ratio: 16 / 9;
}

.map-preview--3d {
  position: relative;
  min-height: 420px;
  background: #f3f7ff;
  cursor: grab;
}

.map-preview--3d:active {
  cursor: grabbing;
}

.map-preview--3d canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.map-preview__hud {
  position: absolute;
  left: 12px;
  top: 12px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid rgba(83, 112, 164, 0.22);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 8px 18px rgba(31, 55, 93, 0.12);
  color: rgba(35, 50, 78, 0.64);
  font-size: 12px;
  pointer-events: none;
}

.map-preview__hud strong {
  color: #17233c;
  font-size: 13px;
}

.map-preview__base-tools {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(2, minmax(96px, 1fr));
  gap: 8px;
  width: min(520px, calc(100% - 24px));
  max-width: calc(100% - 24px);
  padding: 10px;
  border: 1px solid rgba(83, 112, 164, 0.22);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 12px 24px rgba(31, 55, 93, 0.14);
}

.map-preview__base-toggle {
  position: absolute;
  top: 50%;
  right: 12px;
  z-index: 3;
  width: 34px;
  height: 44px;
  padding: 0;
  transform: translateY(-50%);
  box-shadow: 0 10px 20px rgba(31, 55, 93, 0.14);
}

.map-preview__base-toggle:not(.collapsed) {
  right: min(544px, calc(100% - 46px));
}

.map-preview__base-toggle span {
  font-size: 18px;
  line-height: 1;
}

.map-preview__base-title,
.map-preview__rotation-field {
  grid-column: 1 / -1;
}

.map-preview__scale-field {
  grid-column: 1 / -1;
}

.map-preview__base-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.map-preview__base-title strong {
  flex: 0 0 auto;
  color: #17233c;
}

.map-preview__base-title span {
  min-width: 0;
  overflow: hidden;
  color: rgba(40, 59, 91, 0.64);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-preview__base-tools label {
  gap: 4px;
  font-size: 12px;
}

.map-preview__base-tools input {
  height: 30px;
}

.map-preview__base-tools .upload-button {
  justify-self: start;
}

.map-preview__empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(40, 59, 91, 0.55);
  font-size: 14px;
  font-weight: 700;
  pointer-events: none;
}

.preview-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.floor-tabs {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.slider-field {
  grid-template-columns: minmax(86px, 1fr) 72px;
  align-items: center;
  gap: 5px 8px;
}

.slider-field span {
  grid-column: 1 / -1;
}

.slider-field input[type='range'] {
  height: 28px;
  padding: 0;
  accent-color: #1f6feb;
}

.slider-field input[type='number'] {
  padding: 0 8px;
}

.map-workflow {
  display: grid;
  gap: 10px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.coordinate-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.map-editor-page label {
  display: grid;
  gap: 6px;
  color: rgba(35, 50, 78, 0.72);
  font-size: 13px;
  font-weight: 700;
}

.map-editor-page label.wide {
  grid-column: 1 / -1;
}

.map-editor-page input,
.map-editor-page select,
.map-editor-page textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid rgba(83, 112, 164, 0.25);
  border-radius: 6px;
  background: #fff;
  color: #162338;
  font: inherit;
}

.map-editor-page input,
.map-editor-page select {
  height: 34px;
  padding: 0 10px;
}

.map-editor-page textarea {
  resize: vertical;
  padding: 9px 10px;
}

.editor-span {
  grid-column: 1 / -1;
}

.thumbnail-uploader {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: 12px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(83, 112, 164, 0.14);
}

.thumbnail-uploader__preview {
  display: grid;
  place-items: center;
  height: 90px;
  overflow: hidden;
  border: 1px solid rgba(89, 119, 168, 0.18);
  border-radius: 8px;
  background: #eef4fb;
  color: rgba(45, 62, 92, 0.58);
  font-size: 13px;
  font-weight: 700;
}

.thumbnail-uploader__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-uploader__actions {
  display: flex;
  align-items: center;
  align-content: center;
  flex-wrap: wrap;
  gap: 10px;
}

.thumbnail-uploader__actions > span {
  width: 100%;
  color: rgba(35, 50, 78, 0.72);
  font-size: 13px;
  font-weight: 700;
}

.thumbnail-uploader__actions small {
  color: rgba(40, 59, 91, 0.58);
  line-height: 1.5;
}

.toast-message {
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 20;
  margin: 0;
  padding: 10px 14px;
  border-radius: 8px;
  background: #18345d;
  color: #fff;
  box-shadow: 0 12px 28px rgba(18, 34, 61, 0.22);
}

.config-page {
  display: grid;
  gap: 14px;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.config-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr) minmax(280px, 1fr);
  gap: 14px;
}

.setting-panel,
.rule-panel,
.integration-panel,
.audit-panel {
  border: 1px solid rgba(118, 148, 212, 0.2);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(25, 31, 45, 0.92), rgba(13, 17, 27, 0.88)),
    rgba(13, 17, 27, 0.88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 16px 34px rgba(0, 0, 0, 0.18);
}

.setting-panel {
  position: relative;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  min-height: 152px;
  padding: 18px;
  overflow: hidden;
  transition: border-color 160ms ease, transform 160ms ease;
}

.setting-panel::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #4d8dff, #7c68ff);
}

.setting-panel:hover {
  transform: translateY(-1px);
  border-color: rgba(116, 156, 255, 0.44);
}

.setting-panel.active {
  border-color: rgba(100, 181, 246, 0.58);
  background:
    linear-gradient(180deg, rgba(36, 54, 86, 0.95), rgba(19, 28, 45, 0.9)),
    rgba(13, 17, 27, 0.88);
}

.setting-panel h3,
.rule-panel h3,
.integration-panel h3,
.audit-panel h3 {
  margin: 0 0 10px;
  color: #fff;
}

.setting-panel p {
  margin: 0;
  color: rgba(224, 235, 255, 0.68);
  line-height: 1.7;
}

.setting-panel label {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 8px;
  min-width: 62px;
  color: rgba(226, 237, 255, 0.7);
  font-size: 13px;
}

.setting-panel input {
  accent-color: #6b66ff;
}

.rule-panel,
.integration-panel,
.audit-panel {
  padding: 18px;
}

.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-title button {
  height: 32px;
  padding: 0 12px;
  border: 1px solid rgba(94, 143, 255, 0.42);
  border-radius: 6px;
  background: rgba(49, 91, 194, 0.32);
  color: #fff;
  cursor: pointer;
  font-weight: 700;
  transition: background 160ms ease, border-color 160ms ease;
}

.panel-title button:hover {
  border-color: rgba(123, 162, 255, 0.7);
  background: rgba(67, 107, 220, 0.44);
}

.rule-list,
.channel-list,
.audit-list {
  display: grid;
  gap: 10px;
}

.rule-list div {
  display: grid;
  grid-template-columns: minmax(120px, 0.9fr) minmax(0, 1.5fr) 42px;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid rgba(118, 148, 212, 0.16);
  border-radius: 6px;
  background: rgba(6, 10, 18, 0.42);
  transition: background 160ms ease;
}

.rule-list div:hover,
.rule-list div.active,
.channel-list div:hover,
.channel-list div.active {
  background: rgba(74, 111, 190, 0.12);
}

.rule-list div,
.channel-list div {
  cursor: pointer;
}

.rule-list strong,
.channel-list strong {
  color: #fff;
  font-size: 14px;
}

.rule-list span,
.channel-list span,
.audit-list span {
  color: rgba(224, 235, 255, 0.68);
  font-size: 13px;
}

.rule-list small {
  justify-self: end;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 12px;
}

.rule-list small.alarm {
  color: #ff8585;
  background: rgba(255, 83, 83, 0.12);
}

.rule-list small.warn {
  color: #ffcf75;
  background: rgba(255, 189, 91, 0.12);
}

.rule-list small.normal {
  color: #8db8ff;
  background: rgba(87, 128, 255, 0.12);
}

.channel-list div {
  display: grid;
  gap: 5px;
  padding: 12px;
  border: 1px solid rgba(118, 148, 212, 0.16);
  border-radius: 6px;
  background: rgba(6, 10, 18, 0.42);
  transition: background 160ms ease;
}

.channel-list small,
.audit-list time {
  color: rgba(224, 235, 255, 0.48);
  font-size: 12px;
}

.selected-channel {
  display: grid;
  gap: 6px;
  margin-top: 12px;
  padding: 12px;
  border: 1px solid rgba(118, 148, 212, 0.16);
  border-radius: 6px;
  background: rgba(57, 95, 178, 0.14);
}

.selected-channel span,
.selected-channel small {
  color: rgba(224, 235, 255, 0.62);
  font-size: 12px;
}

.selected-channel strong {
  color: #fff;
}

.audit-list div {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 10px;
  min-height: 32px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(118, 148, 212, 0.1);
}

.audit-list div:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

@media (max-width: 1120px) {
  .map-row,
  .editor-layout {
    grid-template-columns: 1fr;
  }

  .map-row__actions {
    justify-content: flex-start;
  }
}

@media (max-width: 760px) {
  .map-toolbar,
  .editor-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .form-grid,
  .coordinate-grid,
  .thumbnail-uploader,
  .config-grid,
  .config-layout,
  .rule-list div {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1180px) {
  .config-grid,
  .config-layout {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .config-grid,
  .config-layout,
  .rule-list div {
    grid-template-columns: 1fr;
  }
}
</style>

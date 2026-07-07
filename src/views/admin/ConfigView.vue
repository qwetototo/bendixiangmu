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
          <h2>{{ t('config.mapEditor') }}</h2>
          <p>{{ t('config.mapEditorDesc') }}</p>
        </div>
        <div class="toolbar-actions">
          <input ref="mapFileInput" class="model-file-input" type="file" @change="importMapFile" />
          <button type="button" class="upload-button" :disabled="mapImporting" @click="openMapFilePicker">
            <UploadOutlined />
            <span>{{ mapImporting ? t('config.importing') : t('config.importMap') }}</span>
          </button>
          <button type="button" class="primary-button" @click="createBlankMap">
            <PlusOutlined />
            <span>{{ t('config.createMap') }}</span>
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
          <p>{{ t('config.editorDesc') }}</p>
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
              <h3>{{ t('config.mapPreview') }}</h3>
              <p>{{ pickMode ? t('config.pickModeActive', { target: pickModeLabel }) : t('config.pickModeIdle') }}</p>
            </div>
            <button v-if="pickMode" type="button" class="ghost-button" @click="cancelPick">
              <span>{{ t('common.cancel') }}</span>
            </button>
          </div>
          <div class="floor-tabs">
            <button
              v-for="floor in draftMap.metadata.floors"
              :key="floor.id"
              type="button"
              :class="{ active: floor.id === draftMap.metadata.activeFloorId }"
              @click="switchFloor(floor.id)"
            >
              <span>{{ floor.name }}</span>
            </button>
            <button type="button" @click="addFloor">
              <PlusOutlined />
              <span>{{ t('config.addFloor') }}</span>
            </button>
            <button type="button" :disabled="draftMap.metadata.floors.length <= 1" @click="removeCurrentFloor">
              <DeleteOutlined />
              <span>{{ t('config.removeFloor') }}</span>
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
                <span>{{ t('config.scaleRatio') }}</span>
                <input v-model.number="scaleRatioInput" type="number" min="1" step="1" />
              </label>
              <template v-if="baseMapModel">
                <label>
                  <span>{{ t('config.modelX') }}</span>
                  <input v-model.number="baseMapModel.center[0]" type="number" step="0.1" @change="sanitizeModelNumberField(baseMapModel!.center, 0)" />
                </label>
                <label>
                  <span>{{ t('config.modelY') }}</span>
                  <input v-model.number="baseMapModel.center[1]" type="number" step="0.1" @change="sanitizeModelNumberField(baseMapModel!.center, 1)" />
                </label>
                <label>
                  <span>{{ t('config.modelZ') }}</span>
                  <input v-model.number="baseMapModel.center[2]" type="number" step="0.1" @change="sanitizeModelNumberField(baseMapModel!.center, 2)" />
                </label>
                <label class="slider-field map-preview__rotation-field">
                  <span>{{ t('config.rotationY') }}</span>
                  <input v-model.number="baseMapModel.rotation[1]" type="range" min="-180" max="180" step="1" @change="sanitizeModelNumberField(baseMapModel!.rotation, 1)" />
                  <input v-model.number="baseMapModel.rotation[1]" type="number" step="1" @change="sanitizeModelNumberField(baseMapModel!.rotation, 1)" />
                </label>
              </template>
              <input ref="baseMapFileInput" class="model-file-input" type="file" @change="importBaseMapFile" />
              <button type="button" class="upload-button" :disabled="baseMapImporting" @click.stop="openBaseMapFilePicker">
                <UploadOutlined />
                <span>{{ baseMapImporting ? t('config.uploading') : t('config.uploadBaseMap') }}</span>
              </button>
            </div>
            <span v-if="!baseMapModel && !detailModelRows.length" class="map-preview__empty">
              {{ t('config.noBaseMap') }}
            </span>
          </div>
          <div class="preview-stats">
            <span>{{ t('config.floorName', { name: draftMap.config.floor.name }) }}</span>
            <span>{{ t('config.scaleLabel', { scale: `1:${draftMap.metadata.scaleRatio}` }) }}</span>
            <span>{{ t('config.modelsCount', { n: detailModelRows.length }) }}</span>
          </div>
          <div class="pick-actions">
            <button type="button" :class="{ active: pickMode === 'positioning-origin' }" @click="startPick('positioning-origin')">
              <span>{{ t('config.pickPositioningOrigin') }}</span>
            </button>
            <button type="button" :class="{ active: pickMode === 'new-model' }" :disabled="!hasBaseLayer" @click="startPick('new-model')">
              <span>{{ t('config.pickAddModel') }}</span>
            </button>
          </div>
        </article>

        <article class="form-panel">
          <h3>{{ t('config.basicInfo') }}</h3>
          <div class="form-grid">
            <label>
              <span>{{ t('config.mapName') }}</span>
              <input v-model.trim="draftMap.name" type="text" />
            </label>
            <label>
              <span>{{ t('config.floorNameLabel') }}</span>
              <input v-model.trim="draftMap.config.floor.name" type="text" @input="updateCurrentFloorName" />
            </label>
            <label>
              <span>{{ t('config.floorLabel') }}</span>
              <input v-model.trim="draftMap.metadata.floor" type="text" />
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
              <span v-else>{{ t('config.noThumbnail') }}</span>
            </div>
            <div class="thumbnail-uploader__actions">
              <span>{{ t('config.thumbnail') }}</span>
              <input ref="thumbnailFileInput" class="model-file-input" type="file" accept=".png,.jpg,.jpeg,.webp" @change="importThumbnailFile" />
              <button type="button" class="upload-button" :disabled="thumbnailUploading" @click="openThumbnailFilePicker">
                <UploadOutlined />
                <span>{{ thumbnailUploading ? t('config.uploading') : t('config.uploadThumbnail') }}</span>
              </button>
              <button v-if="draftMap.metadata.thumbnail" type="button" @click="clearThumbnail">
                <DeleteOutlined />
                <span>{{ t('config.clearThumbnail') }}</span>
              </button>
              <small>{{ thumbnailUploadStatus || t('config.thumbnailUploadHint') }}</small>
            </div>
          </div>
        </article>

        <article class="form-panel">
          <h3>{{ t('config.coordinateSetup') }}</h3>
          <div class="form-grid coordinate-grid">
            <label>
              <span>{{ t('config.positioningOriginX') }}</span>
              <input v-model.number="draftMap.metadata.positioningOrigin[0]" type="number" />
            </label>
            <label>
              <span>{{ t('config.positioningOriginY') }}</span>
              <input v-model.number="draftMap.metadata.positioningOrigin[1]" type="number" />
            </label>
            <label>
              <span>{{ t('config.positioningOriginZ') }}</span>
              <input v-model.number="draftMap.metadata.positioningOrigin[2]" type="number" />
            </label>
          </div>
          <div class="map-workflow">
            <div class="model-add-panel">
              <label>
                <span>{{ t('config.modelPath') }}</span>
                <select v-model="newModel.path">
                  <option v-for="path in modelLibraryPaths" :key="path" :value="path">{{ path }}</option>
                </select>
              </label>
              <label>
                <span>{{ t('config.modelScale') }}</span>
                <input v-model.number="newModel.scale" type="number" min="0.01" step="0.1" />
              </label>
              <label>
                <span>{{ t('config.modelX') }}</span>
                <input v-model.number="newModel.center[0]" type="number" />
              </label>
              <label>
                <span>{{ t('config.modelY') }}</span>
                <input v-model.number="newModel.center[1]" type="number" />
              </label>
              <label>
                <span>{{ t('config.modelZ') }}</span>
                <input v-model.number="newModel.center[2]" type="number" />
              </label>
              <label>
                <span>{{ t('config.rotationY') }}</span>
                <input v-model.number="newModel.rotation[1]" type="number" />
              </label>
              <button type="button" :disabled="!newModel.path || !hasBaseLayer" @click="fitNewModel">
                <ExpandOutlined />
                <span>{{ t('config.autoBestScale') }}</span>
              </button>
              <button type="button" class="primary-button" :disabled="!hasBaseLayer" @click="() => addModelFromDraft()">
                <PlusOutlined />
                <span>{{ t('config.addAtCoordinate') }}</span>
              </button>
              <small v-if="!hasBaseLayer">{{ t('config.baseMapRequired') }}</small>
            </div>
            <div class="model-tools">
              <label class="model-directory-field">
                <span>{{ t('config.saveDir') }}</span>
                <input v-model.trim="modelUploadDirectory" type="text" placeholder="uploads" />
              </label>
              <input ref="modelFileInput" class="model-file-input" type="file" @change="importModelFile" />
              <button
                type="button"
                class="upload-button"
                :disabled="modelUploading"
                @click="openModelFilePicker"
              >
                <UploadOutlined />
                <span>{{ modelUploading ? t('config.uploading') : t('config.uploadModelGLB') }}</span>
              </button>
              <small>{{ t('config.modelUploadOnlyHint') }}</small>
            </div>
            <p v-if="modelUploadStatus" :class="['model-upload-status', { error: modelUploadFailed }]">
              {{ modelUploadStatus }}
            </p>
          </div>
        </article>

        <article class="form-panel editor-span">
          <h3>{{ t('config.currentFloorModels') }}</h3>

          <div class="model-list">
            <div v-for="{ model, index } in detailModelRows" :key="`${model.path}-${index}`" class="model-row">
              <input v-model.trim="model.path" class="model-row__path" :title="t('config.modelPath')" />
              <label>
                <span>{{ t('config.modelScale') }}</span>
                <input v-model.number="model.scale" type="number" min="0.01" step="0.01" />
              </label>
              <label>
                <span>{{ t('config.modelX') }}</span>
                <input v-model.number="model.center[0]" type="number" step="0.1" />
              </label>
              <label>
                <span>{{ t('config.modelY') }}</span>
                <input v-model.number="model.center[1]" type="number" step="0.1" />
              </label>
              <label>
                <span>{{ t('config.modelZ') }}</span>
                <input v-model.number="model.center[2]" type="number" step="0.1" />
              </label>
              <label class="slider-field">
                <span>{{ t('config.rotationY') }}</span>
                <input v-model.number="model.rotation[1]" type="range" min="-180" max="180" step="1" />
                <input v-model.number="model.rotation[1]" type="number" step="1" />
              </label>
              <div class="model-row__actions">
                <button type="button" :title="t('config.pickModelPosition')" @click="startPick('model-position', index)">
                  <EditOutlined />
                </button>
                <button type="button" :title="t('config.autoFitModel')" @click="fitModelToMap(model)">
                  <ExpandOutlined />
                </button>
                <button type="button" :title="t('common.delete')" @click="removeModel(index)">
                  <DeleteOutlined />
                </button>
              </div>
            </div>
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
  DeleteOutlined,
  EditOutlined,
  ExpandOutlined,
  PlusOutlined,
  SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useSceneStore } from '@/stores/scene';
import type { AreaConfig, ModelConfig, SceneConfig } from '@/types/scene';
import {
  DEFAULT_MAP_ID,
  cloneSceneConfig,
  createBlankSceneConfig,
  createSavedMap,
  getMapLibrary,
  isSceneConfig,
  saveMapLibrary,
  type MapFloorItem,
  type SavedMap,
} from '@/services/mapLibrary';

type RuleLevel = 'alarm' | 'warn' | 'normal';
type PickMode = 'positioning-origin' | 'new-model' | 'model-position';
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

defineProps<{
  pageKey?: string;
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
const modelUploadDirectory = ref('uploads');
const modelFileInput = ref<HTMLInputElement | null>(null);
const modelUploading = ref(false);
const modelUploadStatus = ref('');
const modelUploadFailed = ref(false);
const baseMapToolsOpen = ref(true);
const pickMode = ref<PickMode | null>(null);
const selectedModelIndex = ref<number | null>(null);
const modelPresets = ['cabinet.glb', 'desk2.glb', 'desk2b.glb', 'desk3.glb', 'desk3b.glb', 'desk4.glb', 'desk5.glb', 'rel.glb', 'boss.glb'];
const newModel = reactive<ModelConfig>({
  path: 'cabinet.glb',
  scale: 1,
  center: [0, 0, 0],
  rotation: [0, 0, 0],
});
const gltfLoader = new GLTFLoader();
const modelModules = import.meta.glob('/src/assets/model/**/*.{glb,gltf}', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;
const DEFAULT_MODEL_SCALE_RATIO = 300;
let previewRenderer: THREE.WebGLRenderer | null = null;
let previewScene: THREE.Scene | null = null;
let previewCamera: THREE.PerspectiveCamera | null = null;
let previewResizeObserver: ResizeObserver | null = null;
let previewFrameId = 0;
let previewBuildToken = 0;
let previewHasFramed = false;
let previewAssetSignature = '';
let previewLayoutSignature = '';
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
  yaw: 42,
  pitch: 52,
});
const previewClickedPoint = ref<[number, number, number] | null>(null);

const selectedChannel = computed(() => {
  return channels.find((channel) => channel.name === selectedChannelName.value) ?? channels[0];
});

const previewAreas = computed(() => (config: SceneConfig) => config.areas.filter((area) => area.type === 'floor'));
const pickModeLabel = computed(() => {
  if (pickMode.value === 'positioning-origin') {
    return t('config.positioningOrigin');
  }
  if (pickMode.value === 'model-position') {
    return t('config.modelPosition');
  }
  return t('config.newModel');
});
const modelLibraryPaths = computed(() => {
  const paths = new Set(modelPresets);
  if (newModel.path) {
    paths.add(newModel.path);
  }
  draftMap.value?.config.models.filter((model) => model.role !== 'base-map').forEach((model) => {
    if (model.path) {
      paths.add(model.path);
    }
  });
  return [...paths];
});
const currentFloor = computed(() => {
  if (!draftMap.value) {
    return null;
  }

  return draftMap.value.metadata.floors.find((floor) => floor.id === draftMap.value?.metadata.activeFloorId) ?? draftMap.value.metadata.floors[0] ?? null;
});
const detailModelRows = computed(() =>
  draftMap.value?.config.models
    .map((model, index) => ({ model, index }))
    .filter((row) => row.model.role !== 'base-map') ?? [],
);
const baseMapModel = computed(() => draftMap.value?.config.models.find((model) => model.role === 'base-map') ?? null);
const hasBaseLayer = computed(() => Boolean(baseMapModel.value || draftMap.value?.config.areas.length || draftMap.value?.config.walls.length));
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
const scaleRatioInput = computed({
  get: () => (draftMap.value ? getSafeScaleRatio(draftMap.value) : 300),
  set: (value: number) => {
    if (!draftMap.value) {
      return;
    }

    const nextScaleRatio = Number(value);
    draftMap.value.metadata.scaleRatio = Number.isFinite(nextScaleRatio) && nextScaleRatio > 0 ? nextScaleRatio : 300;
    syncScaleRatioToConfig(draftMap.value);
  },
});
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

function getPreviewBox(config: SceneConfig) {
  const xs: number[] = [];
  const ys: number[] = [];
  config.areas.forEach((area) => {
    area.points.forEach(([x, y]) => {
      xs.push(x);
      ys.push(y);
    });
  });
  config.walls.forEach((wall) => {
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
  const scaleRatio = Number(map.metadata.scaleRatio);
  return Number.isFinite(scaleRatio) && scaleRatio > 0 ? scaleRatio : 300;
}

function syncScaleRatioToConfig(map: SavedMap) {
  const scaleRatio = getSafeScaleRatio(map);
  map.metadata.scaleRatio = scaleRatio;
  map.config.floor.scale = scaleRatio;
  map.metadata.floors.forEach((floor) => {
    floor.config.floor.scale = scaleRatio;
  });
}

function normalizeModelConfig(model: ModelConfig): ModelConfig {
  const legacyCenter = model.center as unknown as number[];
  const legacyHeight = Number((model as { heightOffset?: unknown }).heightOffset);
  const center: [number, number, number] =
    legacyCenter.length > 2
      ? [Number(legacyCenter[0]) || 0, Number(legacyCenter[1]) || 0, Number(legacyCenter[2]) || 0]
      : [Number(legacyCenter[0]) || 0, Number.isFinite(legacyHeight) ? legacyHeight : 0, Number(legacyCenter[1]) || 0];

  return {
    path: model.path,
    scale: model.scale,
    center,
    rotation: model.rotation,
    role: model.role,
  };
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
  const activeFloorId = map.metadata.activeFloorId;
  const activeIndex = map.metadata.floors.findIndex((floor) => floor.id === activeFloorId);
  const floorItem: MapFloorItem = {
    id: map.config.floor.id || activeFloorId || `floor-${Date.now()}`,
    name: map.config.floor.name || map.metadata.floor || t('config.floorLabel'),
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
  draftMap.value.metadata.floor = targetFloor.name;
  draftMap.value.config = normalizeClonedSceneConfig(targetFloor.config);
  syncScaleRatioToConfig(draftMap.value);
  pickMode.value = null;
  selectedModelIndex.value = null;
  previewRestoreView = null;
  previewHasFramed = false;
  previewClickedPoint.value = null;
}

function addFloor() {
  if (!draftMap.value) {
    return;
  }

  syncActiveFloorFromConfig(draftMap.value);
  const floorNumber = draftMap.value.metadata.floors.length + 1;
  const config = createBlankSceneConfig(t('config.floorNameDefault', { n: floorNumber }));
  config.floor.id = `floor-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
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

  const activeFloorId = draftMap.value.metadata.activeFloorId;
  const nextFloors = draftMap.value.metadata.floors.filter((floor) => floor.id !== activeFloorId);
  draftMap.value.metadata.floors = nextFloors;
  const nextFloor = nextFloors[0];
  draftMap.value.metadata.activeFloorId = nextFloor.id;
  draftMap.value.metadata.floor = nextFloor.name;
  draftMap.value.config = normalizeClonedSceneConfig(nextFloor.config);
  syncScaleRatioToConfig(draftMap.value);
}

function updateCurrentFloorName() {
  if (!draftMap.value) {
    return;
  }

  draftMap.value.metadata.floor = draftMap.value.config.floor.name;
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
  return `${index}:${modelConfig.role ?? 'detail'}:${modelConfig.path}`;
}

function getPreviewAssetSignature(config: SceneConfig): string {
  return config.models.map((model, index) => getPreviewModelKey(model, index)).join('|');
}

function getPreviewLayoutSignature(config: SceneConfig, origin: [number, number, number]): string {
  return `${config.floor.width}|${config.floor.height}|${origin[0]}|${origin[1]}|${origin[2]}`;
}

function resolveModelUrl(modelPath: string): string | null {
  if (/^(data:|blob:|https?:\/\/)/i.test(modelPath)) {
    return modelPath;
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
      : DEFAULT_MODEL_SCALE_RATIO / floorScaleRatio;

  const modelScale = Number(scale);
  model.scale.setScalar((Number.isFinite(modelScale) && modelScale > 0 ? modelScale : 1) * scaleRatioFactor);
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

async function rebuildPreviewScene() {
  const map = draftMap.value;
  const preview = ensurePreviewRenderer();
  if (!map || !preview?.scene || !preview.camera) {
    return;
  }

  const token = ++previewBuildToken;
  const config = normalizeClonedSceneConfig(map.config);
  const positioningOrigin = [...map.metadata.positioningOrigin] as [number, number, number];
  const assetSignature = getPreviewAssetSignature(config);
  const layoutSignature = getPreviewLayoutSignature(config, positioningOrigin);
  const needsAssetReload = assetSignature !== previewAssetSignature;
  const needsLayoutUpdate = layoutSignature !== previewLayoutSignature || needsAssetReload;
  if (needsAssetReload) {
    clearPreviewScene();
    previewAssetSignature = assetSignature;
  }
  if (needsLayoutUpdate) {
    clearPreviewAuxObjects();
    addPreviewAuxObject(createPreviewGrid(config));
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
      floors: cloneMapFloors(map.metadata.floors),
    },
    config: normalizeClonedSceneConfig(map.config),
  };
  syncScaleRatioToConfig(draftMap.value);
  viewMode.value = 'edit';
}

function closeEditor() {
  draftMap.value = null;
  viewMode.value = 'list';
  pickMode.value = null;
  selectedModelIndex.value = null;
  thumbnailUploadStatus.value = '';
  previewRestoreView = null;
  previewClickedPoint.value = null;
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
            scaleRatio: Number(draftMap.value.metadata.scaleRatio) > 0 ? Number(draftMap.value.metadata.scaleRatio) : 300,
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

function deleteMap(map: SavedMap) {
  if (map.id === DEFAULT_MAP_ID) {
    return;
  }

  const nextMaps = maps.value.filter((item) => item.id !== map.id);
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
      const modelPath = await uploadModelAsset(file, 'maps');
      const mapName = file.name.replace(/\.(glb|gltf)$/i, '');
      const config = createBlankSceneConfig(mapName);
      const scale = await calculateModelFitScaleFromFile(file, config);
      config.models.push({
        path: modelPath,
        scale,
        center: [0, 0, 0],
        rotation: [0, 0, 0],
        role: 'base-map',
      });
      const map = createSavedMap(mapName, t('config.importedFrom', { file: file.name }), config);
      syncMaps([map, ...maps.value]);
      openEditor(map);
      modelUploadStatus.value = t('config.modelSavedTo', { path: modelPath });
      showMessage(t('config.mapImportedGLB', { scale }));
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

async function importModelFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !draftMap.value) {
    return;
  }

  if (!/\.(glb|gltf)$/i.test(file.name)) {
    modelUploadFailed.value = true;
    modelUploadStatus.value = t('config.modelInvalidFile');
    showMessage(modelUploadStatus.value);
    return;
  }

  modelUploading.value = true;
  modelUploadFailed.value = false;
  modelUploadStatus.value = `${t('config.uploading')} ${file.name}...`;

  try {
    const modelPath = await uploadModelAsset(file, modelUploadDirectory.value || 'uploads');
    const scale = await calculateModelFitScaleFromFile(file, draftMap.value.config);

    newModel.path = modelPath;
    newModel.scale = scale;
    modelUploadStatus.value = t('config.modelReadyToPlace', { path: modelPath, scale });
    showMessage(modelUploadStatus.value);
  } catch (error) {
    modelUploadFailed.value = true;
    const errorMessage =
      error instanceof TypeError
        ? t('config.modelUploadError')
        : error instanceof Error
          ? error.message
          : t('config.modelImportFailed');
    modelUploadStatus.value = errorMessage;
    showMessage(errorMessage);
  } finally {
    modelUploading.value = false;
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
    thumbnailUploadStatus.value = t('config.thumbnailInvalidFile');
    showMessage(thumbnailUploadStatus.value);
    return;
  }

  thumbnailUploading.value = true;
  thumbnailUploadStatus.value = `${t('config.uploading')} ${file.name}...`;
  try {
    const thumbnailPath = await uploadThumbnailAsset(file);
    draftMap.value.metadata.thumbnail = thumbnailPath;
    thumbnailUploadStatus.value = t('config.thumbnailSaved');
    showMessage(thumbnailUploadStatus.value);
  } catch (error) {
    const errorMessage =
      error instanceof TypeError
        ? t('config.thumbnailUploadError')
        : error instanceof Error
          ? error.message
          : t('config.thumbnailUploadFailed');
    thumbnailUploadStatus.value = errorMessage;
    showMessage(errorMessage);
  } finally {
    thumbnailUploading.value = false;
  }
}

async function uploadModelAsset(file: File, directory: string): Promise<string> {
  const response = await fetch('/__twintrack/model-upload', {
    method: 'POST',
    headers: {
      'X-File-Name': encodeURIComponent(file.name),
      'X-Model-Directory': encodeURIComponent(directory),
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });
  const responseText = await response.text();
  let result: { path?: string; message?: string } = {};
  try {
    result = JSON.parse(responseText) as { path?: string; message?: string };
  } catch {
    throw new Error(t('config.uploadServiceError'));
  }

  if (!response.ok || !result.path) {
    throw new Error(result.message || t('config.modelImportFailed'));
  }

  return result.path;
}

async function uploadThumbnailAsset(file: File): Promise<string> {
  const response = await fetch('/__twintrack/thumbnail-upload', {
    method: 'POST',
    headers: {
      'X-File-Name': encodeURIComponent(file.name),
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });
  const responseText = await response.text();
  let result: { path?: string; message?: string } = {};
  try {
    result = JSON.parse(responseText) as { path?: string; message?: string };
  } catch {
    throw new Error(t('config.thumbnailUploadError'));
  }

  if (!response.ok || !result.path) {
    throw new Error(result.message || t('config.thumbnailUploadFailed'));
  }

  return result.path;
}

async function calculateModelFitScaleFromFile(file: File, config: SceneConfig): Promise<number> {
  const buffer = await file.arrayBuffer();
  const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
    gltfLoader.parse(buffer, '', resolve, reject);
  });
  return calculateModelFitScale(gltf.scene, config);
}

function calculateModelFitScale(model: THREE.Object3D, config: SceneConfig): number {
  model.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const width = Math.max(size.x, 0.0001);
  const depth = Math.max(size.z, 0.0001);
  const widthScale = config.floor.width / width;
  const depthScale = config.floor.height / depth;
  const fitScale = Math.min(widthScale, depthScale) * 0.8;
  return Number(THREE.MathUtils.clamp(fitScale, 0.001, 10_000).toFixed(3));
}

async function fitModelToMap(modelConfig: ModelConfig) {
  if (!draftMap.value) {
    return;
  }

  modelUploadFailed.value = false;
  modelUploadStatus.value = t('config.modelFitCalc');
  try {
    const modelPath = modelConfig.path.replace(/\\/g, '/').replace(/^\/+/, '');
    const modelUrl = /^(data:|blob:|https?:\/\/)/i.test(modelPath) ? modelPath : `/src/assets/model/${modelPath}`;
    const gltf = await gltfLoader.loadAsync(modelUrl);
    modelConfig.scale = calculateModelFitScale(gltf.scene, draftMap.value.config);
    modelUploadStatus.value = t('config.modelFitDone', { scale: modelConfig.scale });
    showMessage(modelUploadStatus.value);
  } catch {
    modelUploadFailed.value = true;
    modelUploadStatus.value = t('config.modelSizeError');
    showMessage(modelUploadStatus.value);
  }
}

function openMapFilePicker() {
  mapFileInput.value?.click();
}

function openBaseMapFilePicker() {
  baseMapFileInput.value?.click();
}

function openModelFilePicker() {
  modelFileInput.value?.click();
}

function openThumbnailFilePicker() {
  thumbnailFileInput.value?.click();
}

function clearThumbnail() {
  if (!draftMap.value) {
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

function startPick(mode: PickMode, modelIndex: number | null = null) {
  if (!pickMode.value) {
    previewRestoreView = copyPreviewView();
  }
  pickMode.value = mode;
  selectedModelIndex.value = modelIndex;
  setPreviewTopDownView();
}

function cancelPick() {
  pickMode.value = null;
  selectedModelIndex.value = null;
  if (previewRestoreView) {
    applyPreviewViewState(previewRestoreView);
    previewRestoreView = null;
  }
}

function addModelFromDraft(center = newModel.center) {
  if (!draftMap.value || !hasBaseLayer.value) {
    return;
  }

  draftMap.value.config.models.push({
    path: newModel.path || 'cabinet.glb',
    scale: Number(newModel.scale) > 0 ? Number(newModel.scale) : 1,
    center: [Number(center[0]) || 0, 0, Number(center[2]) || 0],
    rotation: [0, Number(newModel.rotation[1]) || 0, 0],
    role: 'detail',
  });
}

async function importBaseMapFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !draftMap.value) {
    return;
  }

  if (!/\.(glb|gltf)$/i.test(file.name)) {
    modelUploadFailed.value = true;
    modelUploadStatus.value = t('config.modelInvalidFile');
    showMessage(modelUploadStatus.value);
    return;
  }

  baseMapImporting.value = true;
  modelUploadFailed.value = false;
  modelUploadStatus.value = `${t('config.uploading')} ${file.name}...`;
  try {
    const modelPath = await uploadModelAsset(file, 'maps');
    const scale = await calculateModelFitScaleFromFile(file, draftMap.value.config);
    const baseModel: ModelConfig = {
      path: modelPath,
      scale,
      center: [0, 0, 0],
      rotation: [0, 0, 0],
      role: 'base-map',
    };
    draftMap.value.config.models = [baseModel, ...draftMap.value.config.models.filter((model) => model.role !== 'base-map')];
    previewHasFramed = false;
    modelUploadStatus.value = t('config.baseMapReady', { path: modelPath, scale });
    showMessage(modelUploadStatus.value);
  } catch (error) {
    modelUploadFailed.value = true;
    const errorMessage =
      error instanceof TypeError
        ? t('config.modelUploadError')
        : error instanceof Error
          ? error.message
          : t('config.modelImportFailed');
    modelUploadStatus.value = errorMessage;
    showMessage(errorMessage);
  } finally {
    baseMapImporting.value = false;
  }
}

function handlePreviewClick(event: MouseEvent) {
  if (!draftMap.value || event.button !== 2) {
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
    showMessage(t('config.positioningOriginUpdated'));
  } else if (pickMode.value === 'new-model') {
    newModel.center = [mapPoint[0], 0, mapPoint[2]];
    addModelFromDraft(newModel.center);
    showMessage(t('config.modelAdded'));
  } else if (pickMode.value === 'model-position' && selectedModelIndex.value !== null) {
    const model = draftMap.value.config.models[selectedModelIndex.value];
    if (model) {
      model.center = [
        mapPoint[0],
        0,
        mapPoint[2],
      ];
      showMessage(t('config.modelPositionUpdated'));
    }
  }

  pickMode.value = null;
  selectedModelIndex.value = null;
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

async function fitNewModel() {
  if (!draftMap.value || !newModel.path) {
    return;
  }

  await fitModelToMap(newModel);
}

function removeModel(index: number) {
  draftMap.value?.config.models.splice(index, 1);
}
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
.model-tools,
.pick-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
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

.model-tools {
  align-items: end;
  margin: 16px 0 10px;
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

.thumbnail-uploader__actions small,
.model-tools small {
  color: rgba(40, 59, 91, 0.58);
  line-height: 1.5;
}

.model-add-panel {
  display: grid;
  grid-template-columns: minmax(180px, 1.2fr) repeat(5, minmax(88px, 0.7fr)) auto auto auto;
  align-items: end;
  gap: 10px;
}

.model-add-panel small {
  align-self: center;
  color: #9a4d12;
  font-size: 12px;
  font-weight: 700;
}

.map-editor-page .model-directory-field {
  width: min(280px, 100%);
}

.map-editor-page .model-tools .upload-button {
  display: inline-flex;
  align-self: end;
}

.model-upload-status {
  margin: 0 0 10px;
  color: #2563a8;
  font-size: 13px;
}

.model-upload-status.error {
  color: #c2413a;
}

.model-list {
  display: grid;
  gap: 8px;
}

.model-row {
  display: grid;
  grid-template-columns: minmax(180px, 1.2fr) repeat(7, minmax(120px, 1fr)) auto;
  align-items: end;
  gap: 10px;
  padding: 10px;
  border: 1px solid rgba(83, 112, 164, 0.14);
  border-radius: 8px;
  background: rgba(246, 249, 255, 0.76);
}

.model-row__path {
  align-self: end;
}

.model-row__actions {
  display: flex;
  align-items: end;
  gap: 8px;
}

.map-editor-page .model-row button {
  width: 36px;
  padding: 0;
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
  .model-add-panel,
  .thumbnail-uploader,
  .model-row,
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

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
            <svg :viewBox="getPreviewBox(map.config)" role="img">
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
          <h3>{{ t('config.mapPreview') }}</h3>
          <div class="map-preview">
            <svg :viewBox="getPreviewBox(draftMap.config)" role="img">
              <polygon
                v-for="area in previewAreas(draftMap.config)"
                :key="area.id"
                :points="formatPoints(area.points)"
              />
              <line
                v-for="wall in draftMap.config.walls"
                :key="wall.id"
                :x1="wall.start[0]"
                :y1="wall.start[1]"
                :x2="wall.end[0]"
                :y2="wall.end[1]"
              />
              <circle
                v-for="model in draftMap.config.models"
                :key="model.path + model.center.join(',')"
                :cx="model.center[0] + draftMap.config.floor.origin[0] + draftMap.config.floor.width / 2"
                :cy="model.center[1] + draftMap.config.floor.origin[1] + draftMap.config.floor.height / 2"
                r="6"
              />
            </svg>
          </div>
          <div class="preview-stats">
            <span>{{ t('config.floorName', { name: draftMap.config.floor.name }) }}</span>
            <span>{{ t('config.originLabel', { origin: draftMap.config.floor.origin.join(', ') }) }}</span>
            <span>{{ t('config.scaleLabel', { scale: draftMap.config.floor.scale }) }}</span>
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
              <input v-model.trim="draftMap.config.floor.name" type="text" />
            </label>
            <label class="wide">
              <span>{{ t('config.description') }}</span>
              <textarea v-model.trim="draftMap.description" rows="3" />
            </label>
            <label>
              <span>{{ t('config.width') }}</span>
              <input v-model.number="draftMap.config.floor.width" type="number" min="1" />
            </label>
            <label>
              <span>{{ t('config.height') }}</span>
              <input v-model.number="draftMap.config.floor.height" type="number" min="1" />
            </label>
            <label>
              <span>{{ t('config.scale') }}</span>
              <input v-model.number="draftMap.config.floor.scale" type="number" min="0.01" step="0.01" />
            </label>
            <label>
              <span>{{ t('config.originX') }}</span>
              <input v-model.number="draftMap.config.floor.origin[0]" type="number" />
            </label>
            <label>
              <span>{{ t('config.originY') }}</span>
              <input v-model.number="draftMap.config.floor.origin[1]" type="number" />
            </label>
          </div>
        </article>

        <article class="form-panel">
          <h3>{{ t('config.texturesAndModels') }}</h3>
          <div class="form-grid">
            <label class="wide">
              <span>{{ t('config.overlayPath') }}</span>
              <input v-model.trim="draftMap.config.overlay.path" type="text" />
            </label>
            <label>
              <span>{{ t('config.overlayScale') }}</span>
              <input v-model.number="draftMap.config.overlay.scale" type="number" min="0.01" step="0.01" />
            </label>
            <label>
              <span>{{ t('config.opacity') }}</span>
              <input v-model.number="draftMap.config.overlay.opacity" type="number" min="0" max="1" step="0.01" />
            </label>
            <label>
              <span>{{ t('config.offsetX') }}</span>
              <input v-model.number="draftMap.config.overlay.offset[0]" type="number" />
            </label>
            <label>
              <span>{{ t('config.offsetY') }}</span>
              <input v-model.number="draftMap.config.overlay.offset[1]" type="number" />
            </label>
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
              <span>{{ modelUploading ? t('config.uploading') : t('config.uploadMapGLB') }}</span>
            </button>
            <button type="button" @click="addModelByPath">
              <PlusOutlined />
              <span>{{ t('config.addModelPath') }}</span>
            </button>
          </div>
          <p v-if="modelUploadStatus" :class="['model-upload-status', { error: modelUploadFailed }]">
            {{ modelUploadStatus }}
          </p>

          <div class="model-list">
            <div v-for="(model, index) in draftMap.config.models" :key="`${model.path}-${index}`" class="model-row">
              <input v-model.trim="model.path" type="text" title="模型路径" />
              <input v-model.number="model.scale" type="number" min="0.01" step="0.1" title="缩放" />
              <input v-model.number="model.center[0]" type="number" title="X" />
              <input v-model.number="model.center[1]" type="number" title="Y" />
              <input v-model.number="model.rotation[1]" type="number" title="Y轴旋转" />
              <button type="button" title="自动适配地图尺寸" @click="fitModelToMap(model)">
                <ExpandOutlined />
              </button>
              <button type="button" title="删除模型" @click="removeModel(index)">
                <DeleteOutlined />
              </button>
            </div>
          </div>
        </article>
      </section>
    </template>

    <p v-if="message" class="toast-message">{{ message }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
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
  type SavedMap,
} from '@/services/mapLibrary';

type RuleLevel = 'alarm' | 'warn' | 'normal';

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
const mapImporting = ref(false);
const modelUploadDirectory = ref('uploads');
const modelFileInput = ref<HTMLInputElement | null>(null);
const modelUploading = ref(false);
const modelUploadStatus = ref('');
const modelUploadFailed = ref(false);
const gltfLoader = new GLTFLoader();

const selectedChannel = computed(() => {
  return channels.find((channel) => channel.name === selectedChannelName.value) ?? channels[0];
});

const previewAreas = computed(() => (config: SceneConfig) => config.areas.filter((area) => area.type === 'floor'));

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

function getPreviewBox(config: SceneConfig) {
  return `${config.floor.origin[0]} ${config.floor.origin[1]} ${Math.max(config.floor.width, 1)} ${Math.max(config.floor.height, 1)}`;
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
  draftMap.value = {
    ...map,
    config: cloneSceneConfig(map.config),
  };
  viewMode.value = 'edit';
}

function closeEditor() {
  draftMap.value = null;
  viewMode.value = 'list';
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

  const nextMap: SavedMap =
    draftMap.value.id === DEFAULT_MAP_ID
      ? createSavedMap(draftMap.value.name || t('config.defaultMapCopy'), draftMap.value.description || t('config.fromDefaultEdit'), draftMap.value.config)
      : {
          ...draftMap.value,
          name: draftMap.value.name || t('config.unnamedMap'),
          updatedAt: new Date().toISOString(),
          config: cloneSceneConfig(draftMap.value.config),
        };

  const nextMaps = maps.value.some((item) => item.id === nextMap.id)
    ? maps.value.map((item) => (item.id === nextMap.id ? nextMap : item))
    : [nextMap, ...maps.value];
  syncMaps(nextMaps);
  draftMap.value = { ...nextMap, config: cloneSceneConfig(nextMap.config) };
  if (sceneStore.activeMapId === nextMap.id) {
    sceneStore.setActiveMap(nextMap.id, cloneSceneConfig(nextMap.config));
  }
  showMessage(t('config.mapSaved'));
}

function applyMap(map: SavedMap) {
  sceneStore.setActiveMap(map.id, cloneSceneConfig(map.config));
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
    sceneStore.setActiveMap(fallbackMap.id, cloneSceneConfig(fallbackMap.config));
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
        center: [0, 0],
        rotation: [0, 0, 0],
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

    draftMap.value.config.models.push({
      path: modelPath,
      scale,
      center: [0, 0],
      rotation: [0, 0, 0],
    });
    modelUploadStatus.value = t('config.modelSavedTo', { path: modelPath });
    showMessage(t('config.modelFitDone', { scale }));
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

function openModelFilePicker() {
  modelFileInput.value?.click();
}

function addModelByPath() {
  draftMap.value?.config.models.push({
    path: 'cabinet.glb',
    scale: 1,
    center: [0, 0],
    rotation: [0, 0, 0],
  });
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
.model-tools {
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

.map-row svg,
.map-preview svg {
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
}

.map-preview {
  aspect-ratio: 16 / 9;
}

.preview-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
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
.map-editor-page textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid rgba(83, 112, 164, 0.25);
  border-radius: 6px;
  background: #fff;
  color: #162338;
  font: inherit;
}

.map-editor-page input {
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
  grid-template-columns: minmax(180px, 1fr) 78px 78px 78px 92px 36px 36px;
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

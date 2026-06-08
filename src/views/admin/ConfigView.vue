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
          <span>启用</span>
        </label>
      </article>
    </section>

    <section class="config-layout">
      <article class="rule-panel">
        <div class="panel-title">
          <h3>告警规则</h3>
          <button type="button" @click="addRule">新增规则</button>
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
        <h3>数据通道</h3>
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
          <span>当前通道</span>
          <strong>{{ selectedChannel.name }}</strong>
          <small>{{ selectedChannel.status }} / {{ selectedChannel.value }}</small>
        </div>
      </article>

      <article class="audit-panel">
        <h3>最近配置变更</h3>
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
          <h2>地图编辑</h2>
          <p>管理轨迹中心使用的地图配置、平面贴图和参考模型。</p>
        </div>
        <div class="toolbar-actions">
          <input ref="mapFileInput" class="model-file-input" type="file" @change="importMapFile" />
          <button type="button" class="upload-button" :disabled="mapImporting" @click="openMapFilePicker">
            <UploadOutlined />
            <span>{{ mapImporting ? '正在导入' : '导入地图' }}</span>
          </button>
          <button type="button" class="primary-button" @click="createBlankMap">
            <PlusOutlined />
            <span>新建地图</span>
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
              <span v-if="map.id === sceneStore.activeMapId">当前地图</span>
            </div>
            <p>{{ map.description || '未填写地图说明' }}</p>
            <div class="map-row__meta">
              <span>{{ map.config.floor.width }} x {{ map.config.floor.height }}</span>
              <span>{{ map.config.areas.length }} 个区域</span>
              <span>{{ map.config.walls.length }} 段围墙</span>
              <span>{{ map.config.models.length }} 个模型</span>
              <span>更新 {{ formatDate(map.updatedAt) }}</span>
            </div>
          </div>
          <div class="map-row__actions">
            <button type="button" @click="applyMap(map)">
              <CheckCircleOutlined />
              <span>应用</span>
            </button>
            <button type="button" @click="openEditor(map)">
              <EditOutlined />
              <span>编辑</span>
            </button>
            <button type="button" :disabled="map.id === DEFAULT_MAP_ID" @click="deleteMap(map)">
              <DeleteOutlined />
              <span>删除</span>
            </button>
          </div>
        </article>
      </section>
    </template>

    <template v-else-if="draftMap">
      <section class="editor-header">
        <button type="button" class="back-button" @click="closeEditor">
          <ArrowLeftOutlined />
          <span>返回列表</span>
        </button>
        <div>
          <h2>{{ draftMap.name }}</h2>
          <p>调整后保存，可立即应用到轨迹中心。</p>
        </div>
        <div class="toolbar-actions">
          <button type="button" class="ghost-button" @click="applyDraft">
            <CheckCircleOutlined />
            <span>应用到轨迹中心</span>
          </button>
          <button type="button" class="primary-button" @click="saveDraft">
            <SaveOutlined />
            <span>保存地图</span>
          </button>
        </div>
      </section>

      <section class="editor-layout">
        <article class="preview-panel">
          <h3>地图形象</h3>
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
            <span>楼层 {{ draftMap.config.floor.name }}</span>
            <span>原点 {{ draftMap.config.floor.origin.join(', ') }}</span>
            <span>比例 {{ draftMap.config.floor.scale }}</span>
          </div>
        </article>

        <article class="form-panel">
          <h3>基本信息</h3>
          <div class="form-grid">
            <label>
              <span>地图名称</span>
              <input v-model.trim="draftMap.name" type="text" />
            </label>
            <label>
              <span>楼层名称</span>
              <input v-model.trim="draftMap.config.floor.name" type="text" />
            </label>
            <label class="wide">
              <span>基本信息</span>
              <textarea v-model.trim="draftMap.description" rows="3" />
            </label>
            <label>
              <span>宽度</span>
              <input v-model.number="draftMap.config.floor.width" type="number" min="1" />
            </label>
            <label>
              <span>高度</span>
              <input v-model.number="draftMap.config.floor.height" type="number" min="1" />
            </label>
            <label>
              <span>缩放比例</span>
              <input v-model.number="draftMap.config.floor.scale" type="number" min="0.01" step="0.01" />
            </label>
            <label>
              <span>原点 X</span>
              <input v-model.number="draftMap.config.floor.origin[0]" type="number" />
            </label>
            <label>
              <span>原点 Y</span>
              <input v-model.number="draftMap.config.floor.origin[1]" type="number" />
            </label>
          </div>
        </article>

        <article class="form-panel">
          <h3>贴图与模型</h3>
          <div class="form-grid">
            <label class="wide">
              <span>平面贴图路径</span>
              <input v-model.trim="draftMap.config.overlay.path" type="text" />
            </label>
            <label>
              <span>贴图缩放</span>
              <input v-model.number="draftMap.config.overlay.scale" type="number" min="0.01" step="0.01" />
            </label>
            <label>
              <span>透明度</span>
              <input v-model.number="draftMap.config.overlay.opacity" type="number" min="0" max="1" step="0.01" />
            </label>
            <label>
              <span>偏移 X</span>
              <input v-model.number="draftMap.config.overlay.offset[0]" type="number" />
            </label>
            <label>
              <span>偏移 Y</span>
              <input v-model.number="draftMap.config.overlay.offset[1]" type="number" />
            </label>
          </div>

          <div class="model-tools">
            <label class="model-directory-field">
              <span>保存目录</span>
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
              <span>{{ modelUploading ? '正在上传' : '上传地图 GLB' }}</span>
            </button>
            <button type="button" @click="addModelByPath">
              <PlusOutlined />
              <span>添加模型路径</span>
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
  { title: '轨迹采样策略', text: '统一管理实时刷新频率、轨迹点保留时长与回放精度。', enabled: true },
  { title: '电子围栏规则', text: '配置重点区域、越界告警、滞留告警与事件推送级别。', enabled: true },
  { title: '外部数据接入', text: '维护 MQTT 地址、接口凭证、组织系统和设备平台同步设置。', enabled: false },
  { title: '审计与安全', text: '记录关键操作，预留单点登录、角色权限和数据脱敏策略。', enabled: true },
]);

const rules = reactive<RuleItem[]>([
  { name: '重点区域越界', condition: '非授权人员进入实验区超过 10 秒', level: 'alarm', levelText: '高' },
  { name: '人员长时间静止', condition: '同一区域停留超过 45 分钟', level: 'warn', levelText: '中' },
  { name: '设备低电量', condition: '标签电量低于 20%', level: 'warn', levelText: '中' },
  { name: '设备离线', condition: '超过 3 分钟未收到上报', level: 'normal', levelText: '低' },
]);

const channels = reactive<ChannelItem[]>([
  { name: 'MQTT WebSocket', value: 'ws://localhost:8080', status: '主通道' },
  { name: '轨迹归档接口', value: '/api/track/archive', status: '待接入' },
  { name: '组织同步', value: '企业通讯录', status: '每日 02:00' },
  { name: '告警推送', value: 'Webhook / 短信', status: '已启用' },
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
  audits.unshift({ time: '刚刚', content });
  if (audits.length > 5) {
    audits.pop();
  }
}

function recordSettingChange(title: string, enabled: boolean) {
  selectedSetting.value = title;
  addAudit(`${title}${enabled ? '已启用' : '已停用'}`);
}

function addRule() {
  const nextRule: RuleItem = {
    name: `临时访客越界 ${rules.length + 1}`,
    condition: '临时访客进入非授权区域超过 5 秒',
    level: 'warn',
    levelText: '中',
  };
  rules.unshift(nextRule);
  selectedRuleName.value = nextRule.name;
  addAudit(`新增告警规则：${nextRule.name}`);
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
    return '刚刚';
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
    showMessage('保存失败：浏览器本地存储空间不足');
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
  const map = createSavedMap('未命名地图', '空白地图', createBlankSceneConfig());
  syncMaps([map, ...maps.value]);
  openEditor(map);
}

function saveDraft() {
  if (!draftMap.value) {
    return;
  }

  const nextMap: SavedMap =
    draftMap.value.id === DEFAULT_MAP_ID
      ? createSavedMap(draftMap.value.name || '默认地图副本', draftMap.value.description || '从默认地图编辑保存', draftMap.value.config)
      : {
          ...draftMap.value,
          name: draftMap.value.name || '未命名地图',
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
  showMessage('地图已保存');
}

function applyMap(map: SavedMap) {
  sceneStore.setActiveMap(map.id, cloneSceneConfig(map.config));
  showMessage(`已应用：${map.name}`);
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
  showMessage(`已删除：${map.name}`);
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
      const map = createSavedMap(mapName, `从 ${file.name} 导入`, config);
      syncMaps([map, ...maps.value]);
      openEditor(map);
      modelUploadStatus.value = `已保存到 src/assets/model/${modelPath}`;
      showMessage(`GLB 地图已导入，已自动缩放为 ${scale}`);
      return;
    }

    if (!/\.json$/i.test(file.name)) {
      showMessage('请选择 .json、.glb 或 .gltf 文件');
      return;
    }

    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    const config = isSceneConfig(parsed) ? parsed : (parsed as { config?: unknown }).config;
    if (!isSceneConfig(config)) {
      showMessage('导入失败：JSON 不符合当前地图配置结构');
      return;
    }

    const map = createSavedMap(config.floor.name || file.name.replace(/\.json$/i, ''), `从 ${file.name} 导入`, config);
    syncMaps([map, ...maps.value]);
    openEditor(map);
    showMessage('地图已导入');
  } catch (error) {
    const errorMessage =
      error instanceof TypeError
        ? '无法连接地图上传服务，请通过 npm run dev 启动项目后再导入 GLB'
        : error instanceof Error
          ? error.message
          : '地图导入失败';
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
    modelUploadStatus.value = '请选择 .glb 或 .gltf 模型文件';
    showMessage(modelUploadStatus.value);
    return;
  }

  modelUploading.value = true;
  modelUploadFailed.value = false;
  modelUploadStatus.value = `正在上传 ${file.name}...`;

  try {
    const modelPath = await uploadModelAsset(file, modelUploadDirectory.value || 'uploads');
    const scale = await calculateModelFitScaleFromFile(file, draftMap.value.config);

    draftMap.value.config.models.push({
      path: modelPath,
      scale,
      center: [0, 0],
      rotation: [0, 0, 0],
    });
    modelUploadStatus.value = `已保存到 src/assets/model/${modelPath}，自动缩放为 ${scale}`;
    showMessage(`模型已导入并自动缩放为 ${scale}`);
  } catch (error) {
    modelUploadFailed.value = true;
    const errorMessage =
      error instanceof TypeError
        ? '无法连接模型上传服务，请通过 npm run dev 启动项目后再上传'
        : error instanceof Error
          ? error.message
          : '模型导入失败';
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
    throw new Error(`上传接口不可用（HTTP ${response.status}），请使用 npm run dev 启动项目`);
  }

  if (!response.ok || !result.path) {
    throw new Error(result.message || '模型保存失败');
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
  modelUploadStatus.value = '正在计算模型尺寸...';
  try {
    const modelPath = modelConfig.path.replace(/\\/g, '/').replace(/^\/+/, '');
    const modelUrl = /^(data:|blob:|https?:\/\/)/i.test(modelPath) ? modelPath : `/src/assets/model/${modelPath}`;
    const gltf = await gltfLoader.loadAsync(modelUrl);
    modelConfig.scale = calculateModelFitScale(gltf.scene, draftMap.value.config);
    modelUploadStatus.value = `模型已自动缩放为 ${modelConfig.scale}`;
    showMessage(modelUploadStatus.value);
  } catch {
    modelUploadFailed.value = true;
    modelUploadStatus.value = '无法读取模型尺寸，请确认模型文件路径有效';
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

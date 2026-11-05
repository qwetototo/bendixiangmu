<template>
  <section class="floor-plan-editor">
    <header class="floor-plan-toolbar">
      <div class="floor-plan-tools">
        <button v-for="item in tools" :key="item.id" type="button" :class="{ active: tool === item.id }" @click="setTool(item.id)">
          {{ item.label }}
        </button>
        <button v-if="tool === 'outline' && pendingOutline.length >= 3" type="button" @click="finishOutline">完成轮廓</button>
        <select v-if="tool === 'model'" v-model="selectedAssetId" aria-label="选择小模型">
          <option value="">选择小模型</option>
          <option v-for="asset in assets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
        </select>
        <label class="file-button">
          导入 2D / GeoJSON
          <input ref="importFileInput" type="file" accept=".json,.geojson,.svg,application/geo+json,application/json,image/svg+xml" @change="importPlanFile" />
        </label>
        <button type="button" @click="exportPlan">导出 2D</button>
        <button type="button" :disabled="!selected" @click="deleteSelected">删除选中</button>
        <button type="button" class="clear-plan-button" @click="clearPlan">清空本层图纸</button>
      </div>
      <small>{{ status }}</small>
    </header>

    <div class="floor-plan-stage" @wheel.prevent="onWheel">
      <svg
        ref="svgRef"
        :viewBox="`0 0 ${floorWidth} ${floorHeight}`"
        preserveAspectRatio="xMidYMid meet"
        tabindex="0"
        aria-label="楼层二维编辑画布"
        @click="onCanvasClick"
        @dblclick.prevent="finishOutline"
        @mousedown="onPointerDown"
        @keydown.delete.prevent="deleteSelected"
        @keydown.backspace.prevent="deleteSelected"
      >
        <defs>
          <pattern id="floor-grid" :width="gridSize" :height="gridSize" patternUnits="userSpaceOnUse">
            <path :d="`M ${gridSize} 0 L 0 0 0 ${gridSize}`" fill="none" stroke="#dfe7f0" stroke-width="1" />
          </pattern>
        </defs>
        <rect :width="floorWidth" :height="floorHeight" fill="#fbfdff" />
        <rect :width="floorWidth" :height="floorHeight" fill="url(#floor-grid)" />
        <g :transform="`translate(${view.x} ${view.y}) scale(${view.zoom})`">
          <polygon
            v-for="area in floor.areas.filter((item) => item.type === 'floor')"
            :key="area.id"
            :points="formatPoints(area.points)"
            :class="['plan-outline', { selected: selected?.kind === 'area' && selected.id === area.id }]"
            @click.stop="selectItem('area', area.id)"
          />
          <g v-for="wall in floor.walls" :key="wall.id" @click.stop="selectItem('wall', wall.id)">
            <line :x1="wall.start[0]" :y1="wall.start[1]" :x2="wall.end[0]" :y2="wall.end[1]" class="wall-hit" />
            <line
              :x1="wall.start[0]" :y1="wall.start[1]" :x2="wall.end[0]" :y2="wall.end[1]"
              :class="['plan-wall', { selected: selected?.kind === 'wall' && selected.id === wall.id }]"
              :stroke-width="Math.max(wall.thickness, 0.15)"
            />
            <text :x="(wall.start[0] + wall.end[0]) / 2" :y="(wall.start[1] + wall.end[1]) / 2 - 0.45" class="measure-label">
              {{ distance(wall.start, wall.end).toFixed(1) }} m
            </text>
          </g>
          <g v-for="door in floor.doors || []" :key="door.id" @click.stop="selectItem('door', door.id)">
            <circle :cx="door.position[0]" :cy="door.position[1]" :r="Math.max(door.width * 0.22, 0.22)" :class="['door-point', { selected: selected?.kind === 'door' && selected.id === door.id }]" />
            <text :x="door.position[0] + 0.3" :y="door.position[1] - 0.3" class="object-label">门</text>
          </g>
          <g v-for="(model, index) in placedModels" :key="model.id || `${model.path}-${index}`" @click.stop="selectItem('model', model.id || `${model.path}-${index}`)">
            <circle :cx="model.center[0] + floorWidth / 2" :cy="model.center[2] + floorHeight / 2" r="0.42" :class="['asset-point', { selected: selected?.kind === 'model' && selected.id === (model.id || `${model.path}-${index}`) }]" />
            <text :x="model.center[0] + floorWidth / 2 + 0.5" :y="model.center[2] + floorHeight / 2 - 0.35" class="object-label">{{ model.name || '小模型' }}</text>
          </g>
          <polyline v-if="pendingOutline.length" :points="formatPoints(pendingOutline)" class="pending-outline" />
          <line v-if="pendingWall" :x1="pendingWall[0]" :y1="pendingWall[1]" :x2="pointerWorld[0]" :y2="pointerWorld[1]" class="pending-wall" />
          <circle v-if="pendingWall" :cx="pendingWall[0]" :cy="pendingWall[1]" r="0.24" class="pending-point" />
        </g>
        <g class="axis-overlay" pointer-events="none">
          <line x1="0" :y1="floorHeight / 2" :x2="floorWidth" :y2="floorHeight / 2" />
          <line :x1="floorWidth / 2" y1="0" :x2="floorWidth / 2" :y2="floorHeight" />
          <text :x="floorWidth / 2 + 0.8" :y="floorHeight / 2 - 0.8">(0, 0)</text>
        </g>
      </svg>
      <div class="floor-plan-readout">
        <span>X {{ pointerWorld[0].toFixed(2) }} m</span>
        <span>Z {{ pointerWorld[1].toFixed(2) }} m</span>
        <span>{{ Math.round(view.zoom * 100) }}%</span>
        <button type="button" title="缩小" aria-label="缩小" @click.stop="zoomBy(1 / 1.2)">−</button>
        <button type="button" title="放大" aria-label="放大" @click.stop="zoomBy(1.2)">+</button>
        <button type="button" title="重置视图" @click="resetView">重置视图</button>
      </div>
    </div>
    <footer class="floor-plan-footer">
      <span>{{ floor.walls.length }} 段墙</span>
      <span>{{ (floor.doors || []).length }} 个门</span>
      <span>{{ placedModels.length }} 个小模型</span>
      <span v-if="selected">已选中 {{ selected.label }}</span>
      <span v-if="assets.length === 0">先上传 GLB / GLTF 小模型后，可在画布点击放置</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { AreaConfig, DoorConfig, ModelConfig, SceneConfig, WallConfig } from '@/types/scene';
import type { MapAsset } from '@/services/mapLibrary';

type ToolId = 'select' | 'outline' | 'wall' | 'door' | 'model';
type Point = [number, number];
type SelectableKind = 'area' | 'wall' | 'door' | 'model';
type Selection = { kind: SelectableKind; id: string; label: string } | null;
type ImportedSource = { type: 'geojson' | 'osm' | 'file'; center?: [number, number]; geoJson?: unknown; fileName?: string };

const props = defineProps<{ modelValue: SceneConfig; assets: MapAsset[] }>();
const emit = defineEmits<{ (event: 'update:modelValue', value: SceneConfig): void; (event: 'source-imported', value: ImportedSource): void }>();
const tools: { id: ToolId; label: string }[] = [
  { id: 'select', label: '选择 / 平移' }, { id: 'outline', label: '外墙轮廓' },
  { id: 'wall', label: '内部墙体' }, { id: 'door', label: '门' }, { id: 'model', label: '放置小模型' },
];
const tool = ref<ToolId>('select');
const selected = ref<Selection>(null);
const selectedAssetId = ref('');
const pendingOutline = ref<Point[]>([]);
const pendingWall = ref<Point | null>(null);
const pointerWorld = ref<Point>([0, 0]);
const status = ref('左键选择或绘制，选择模式下拖动画布；滚轮缩放');
const svgRef = ref<SVGSVGElement | null>(null);
const importFileInput = ref<HTMLInputElement | null>(null);
const view = ref({ zoom: 1, x: 0, y: 0 });
const pan = ref<{ startX: number; startY: number; x: number; y: number; moved: boolean } | null>(null);
const panMoved = ref(false);
const floor = computed(() => props.modelValue);
const floorWidth = computed(() => Math.max(20, Number(props.modelValue.floor.width) || 100));
const floorHeight = computed(() => Math.max(20, Number(props.modelValue.floor.height) || 100));
const gridSize = computed(() => Math.max(1, Math.round(Math.max(floorWidth.value, floorHeight.value) / 40)));
const placedModels = computed(() => props.modelValue.models.filter((model) => model.role !== 'base-map'));

watch(() => props.modelValue.floor.id, () => { pendingOutline.value = []; pendingWall.value = null; selected.value = null; resetView(); });
watch(() => props.assets, (assets) => { if (!assets.some((asset) => asset.id === selectedAssetId.value)) selectedAssetId.value = assets[0]?.id || ''; }, { immediate: true });
onBeforeUnmount(() => { window.removeEventListener('mousemove', onPointerMove); window.removeEventListener('mouseup', onPointerUp); });

function cloneConfig(): SceneConfig {
  const copy = JSON.parse(JSON.stringify(props.modelValue)) as SceneConfig;
  copy.doors = copy.doors || [];
  return copy;
}
function commit(config: SceneConfig) { emit('update:modelValue', config); }
function setTool(next: ToolId) { tool.value = next; pendingWall.value = null; if (next !== 'outline') pendingOutline.value = []; }
function formatPoints(points: Array<{ x?: number; y?: number } | Point>): string {
  return points.map((point) => Array.isArray(point) ? `${point[0]},${point[1]}` : `${point.x},${point.y}`).join(' ');
}
function distance(a: Point, b: Point) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }
function screenToWorld(event: MouseEvent | WheelEvent): Point {
  const [baseX, baseY] = screenToBase(event);
  return [(baseX - view.value.x) / view.value.zoom, (baseY - view.value.y) / view.value.zoom];
}
function screenToBase(event: MouseEvent | WheelEvent): Point {
  const rect = svgRef.value?.getBoundingClientRect();
  if (!rect) return [0, 0];
  const scale = Math.min(rect.width / floorWidth.value, rect.height / floorHeight.value);
  const offsetX = (rect.width - floorWidth.value * scale) / 2;
  const offsetY = (rect.height - floorHeight.value * scale) / 2;
  return [(event.clientX - rect.left - offsetX) / scale, (event.clientY - rect.top - offsetY) / scale];
}
function onPointerDown(event: MouseEvent) {
  if (event.button !== 0 || tool.value !== 'select') return;
  const point = screenToBase(event);
  panMoved.value = false;
  pan.value = { startX: point[0], startY: point[1], x: view.value.x, y: view.value.y, moved: false };
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp, { once: true });
}
function onPointerMove(event: MouseEvent) {
  if (pan.value) {
    const current = screenToBase(event);
    const dx = current[0] - pan.value.startX;
    const dy = current[1] - pan.value.startY;
    if (Math.hypot(dx, dy) > 0.12) { pan.value.moved = true; panMoved.value = true; }
    if (pan.value.moved) view.value = { ...view.value, x: pan.value.x + dx, y: pan.value.y + dy };
  }
  pointerWorld.value = screenToWorld(event);
}
function onPointerUp() { window.removeEventListener('mousemove', onPointerMove); pan.value = null; }
function onWheel(event: WheelEvent) {
  const rect = svgRef.value?.getBoundingClientRect();
  if (!rect) return;
  const before = screenToWorld(event);
  const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
  const zoom = Math.min(8, Math.max(0.25, view.value.zoom * factor));
  const scale = Math.min(rect.width / floorWidth.value, rect.height / floorHeight.value);
  const offsetX = (rect.width - floorWidth.value * scale) / 2;
  const offsetY = (rect.height - floorHeight.value * scale) / 2;
  const baseX = (event.clientX - rect.left - offsetX) / scale;
  const baseY = (event.clientY - rect.top - offsetY) / scale;
  view.value = { zoom, x: baseX - before[0] * zoom, y: baseY - before[1] * zoom };
}
function resetView() { view.value = { zoom: 1, x: 0, y: 0 }; }
function zoomBy(factor: number) {
  const rect = svgRef.value?.getBoundingClientRect();
  if (!rect) return;
  const baseScale = Math.min(rect.width / floorWidth.value, rect.height / floorHeight.value);
  const offsetX = (rect.width - floorWidth.value * baseScale) / 2;
  const offsetY = (rect.height - floorHeight.value * baseScale) / 2;
  const centerX = (rect.width / 2 - offsetX) / baseScale;
  const centerY = (rect.height / 2 - offsetY) / baseScale;
  const zoom = Math.min(8, Math.max(0.25, view.value.zoom * factor));
  const worldX = (centerX - view.value.x) / view.value.zoom;
  const worldY = (centerY - view.value.y) / view.value.zoom;
  view.value = { zoom, x: centerX - worldX * zoom, y: centerY - worldY * zoom };
}
function openImportFilePicker() { importFileInput.value?.click(); }
defineExpose({ openImportFilePicker });

function clearPlan() {
  if (!window.confirm('清空当前楼层的外墙、墙体、门和小模型？已上传的建筑 3D 模型及定位配置会保留。')) return;
  const config = cloneConfig();
  config.areas = config.areas.filter((area) => area.type !== 'floor');
  config.walls = [];
  config.doors = [];
  config.models = config.models.filter((model) => model.role === 'base-map');
  commit(config);
  pendingOutline.value = [];
  pendingWall.value = null;
  selected.value = null;
  status.value = '已清空当前楼层图纸；3D 建筑模型和定位配置未变。';
}

function onCanvasClick(event: MouseEvent) {
  if (panMoved.value) { panMoved.value = false; return; }
  const [x, y] = screenToWorld(event);
  pointerWorld.value = [x, y];
  const config = cloneConfig();
  if (tool.value === 'outline') {
    pendingOutline.value = [...pendingOutline.value, [x, y]];
    status.value = `外墙轮廓 ${pendingOutline.value.length} 点；双击或点“完成轮廓”结束`;
    return;
  }
  if (tool.value === 'wall') {
    if (!pendingWall.value) { pendingWall.value = [x, y]; status.value = '再点击墙体终点'; return; }
    if (distance(pendingWall.value, [x, y]) < 0.2) return;
    config.walls.push({ id: crypto.randomUUID(), start: pendingWall.value, end: [x, y], thickness: 0.18, height: 3, color: '#d8e0ea' });
    pendingWall.value = null;
    commit(config);
    return;
  }
  if (tool.value === 'door') {
    config.doors = config.doors || [];
    config.doors.push({ id: crypto.randomUUID(), name: '门', position: [x, y], width: 0.9, height: 2.1, rotation: 0, color: '#e79a32' });
    commit(config);
    status.value = '已添加门，3D 预览中会切出墙段并显示门框';
    return;
  }
  if (tool.value === 'model') {
    const asset = props.assets.find((item) => item.id === selectedAssetId.value);
    if (!asset) { status.value = '请先上传并选择小模型'; return; }
    config.models.push({ id: crypto.randomUUID(), assetId: asset.id, name: asset.name, path: asset.path, scale: 1, center: [x - floorWidth.value / 2, 0, y - floorHeight.value / 2], rotation: [0, 0, 0] });
    commit(config);
    return;
  }
  selected.value = pickObject([x, y]);
  status.value = selected.value ? `已选中 ${selected.value.label}` : '未选中对象';
}
function finishOutline() {
  if (pendingOutline.value.length < 3) return;
  const points = [...pendingOutline.value];
  if (points.length > 3 && distance(points[0], points[points.length - 1]) < 0.25) points.pop();
  const config = cloneConfig();
  const groupId = crypto.randomUUID();
  const areaId = crypto.randomUUID();
  const area: AreaConfig = { id: areaId, groupId, name: `外墙轮廓 ${config.areas.length + 1}`, type: 'floor', height: 0.12, color: '#d5e1ed', opacity: 1, points };
  config.areas.push(area);
  points.forEach((start, index) => {
    const end = points[(index + 1) % points.length];
    config.walls.push({ id: crypto.randomUUID(), groupId, start, end, thickness: 0.2, height: 3, color: '#d8e0ea' });
  });
  commit(config);
  pendingOutline.value = [];
  tool.value = 'select';
  status.value = '外墙轮廓已闭合，已生成地面和 3D 外墙';
}
function selectItem(kind: SelectableKind, id: string) {
  if (panMoved.value) return;
  const labels = { area: '外墙轮廓', wall: '墙体', door: '门', model: '小模型' };
  selected.value = { kind, id, label: labels[kind] };
}
function pickObject(point: Point): Selection {
  const config = props.modelValue;
  const model = config.models.find((item) => item.role !== 'base-map' && Math.hypot(item.center[0] + floorWidth.value / 2 - point[0], item.center[2] + floorHeight.value / 2 - point[1]) < 0.7);
  if (model) return { kind: 'model', id: model.id || model.path, label: model.name || '小模型' };
  const door = (config.doors || []).find((item) => distance(item.position, point) < Math.max(item.width / 2, 0.5));
  if (door) return { kind: 'door', id: door.id, label: door.name };
  const wall = config.walls.find((item) => pointSegmentDistance(point, item.start, item.end) < Math.max(item.thickness * 2, 0.45));
  if (wall) return { kind: 'wall', id: wall.id, label: '墙体' };
  const area = config.areas.find((item) => item.type === 'floor' && insidePolygon(point, item.points));
  if (area) return { kind: 'area', id: area.id, label: area.name };
  return null;
}
function deleteSelected() {
  if (!selected.value) return;
  const config = cloneConfig();
  const current = selected.value;
  if (current.kind === 'area') {
    const area = config.areas.find((item) => item.id === current.id);
    config.areas = config.areas.filter((item) => item.id !== current.id);
    if (area?.groupId) config.walls = config.walls.filter((wall) => wall.groupId !== area.groupId);
  } else if (current.kind === 'wall') config.walls = config.walls.filter((item) => item.id !== current.id);
  else if (current.kind === 'door') config.doors = (config.doors || []).filter((item) => item.id !== current.id);
  else config.models = config.models.filter((item) => item.id !== current.id && item.path !== current.id);
  commit(config);
  selected.value = null;
  status.value = '已删除选中对象';
}
function pointSegmentDistance(point: Point, a: Point, b: Point) {
  const dx = b[0] - a[0]; const dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  const t = length2 ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2)) : 0;
  return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy));
}
function insidePolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]; const b = polygon[j];
    if (((a[1] > point[1]) !== (b[1] > point[1])) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / ((b[1] - a[1]) || 1) + a[0]) inside = !inside;
  }
  return inside;
}
async function importPlanFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0]; input.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const converted = file.name.toLowerCase().endsWith('.svg')
      ? convertSvgPlan(text, file.name)
      : convertImportedPlan(JSON.parse(text) as Record<string, unknown>, file.name);
    commit(converted.config);
    emit('source-imported', converted.source);
    selected.value = null; pendingOutline.value = []; pendingWall.value = null; resetView();
    status.value = `已导入 ${file.name}，包含 ${converted.config.areas.length} 个轮廓、${converted.config.walls.length} 段墙`;
  } catch (error) {
    status.value = error instanceof Error ? error.message : '文件格式无法识别';
  }
}
function convertSvgPlan(text: string, fileName: string): { config: SceneConfig; source: ImportedSource } {
  const document = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (document.querySelector('parsererror')) throw new Error('SVG 文件格式无效');
  const polygon = document.querySelector('polygon');
  if (!polygon) throw new Error('SVG 中没有可识别的 polygon 建筑轮廓');
  const values = (polygon.getAttribute('points') || '').trim().split(/[\s,]+/).filter(Boolean).map(Number);
  if (values.length < 6 || values.length % 2 !== 0 || values.some((value) => !Number.isFinite(value))) {
    throw new Error('SVG 建筑轮廓点格式无效');
  }

  const sourcePoints: Point[] = [];
  for (let index = 0; index < values.length; index += 2) sourcePoints.push([values[index], values[index + 1]]);
  if (sourcePoints.length < 3) throw new Error('建筑轮廓至少需要三个有效点');
  const minX = Math.min(...sourcePoints.map(([x]) => x));
  const minY = Math.min(...sourcePoints.map(([, y]) => y));
  const maxX = Math.max(...sourcePoints.map(([x]) => x));
  const maxY = Math.max(...sourcePoints.map(([, y]) => y));
  const factor = 0.08;
  const padding = 5;
  const points = sourcePoints.map(([x, y]) => [(x - minX) * factor + padding, (y - minY) * factor + padding] as Point);
  const config = cloneConfig();
  const groupId = crypto.randomUUID();
  config.floor.width = Math.max(20, (maxX - minX) * factor + padding * 2);
  config.floor.height = Math.max(20, (maxY - minY) * factor + padding * 2);
  config.areas = [{
    id: crypto.randomUUID(), groupId, name: 'SVG 建筑轮廓', type: 'floor',
    height: 0.12, color: '#d5e1ed', opacity: 1, points,
  }];
  config.walls = points.map((start, index) => ({
    id: crypto.randomUUID(), groupId, start, end: points[(index + 1) % points.length],
    thickness: 0.2, height: 3, color: '#d8e0ea',
  }));
  config.doors = [];
  config.floor.name = fileName.replace(/\.svg$/i, '') || config.floor.name;
  return { config, source: { type: 'file', fileName } };
}

function convertImportedPlan(data: Record<string, unknown>, fileName: string): { config: SceneConfig; source: ImportedSource } {
  if (data.type === 'Feature' || data.type === 'FeatureCollection') return convertGeoJson(data);
  const project = (data.project || {}) as Record<string, unknown>;
  const floorData = (data.floor || {}) as Record<string, unknown>;
  const plan = (data.plan || floorData.plan || {}) as Record<string, unknown>;
  const buildings = Array.isArray(plan.buildings) ? plan.buildings as Array<Record<string, unknown>> : [];
  const sourceWalls = Array.isArray(plan.walls) ? plan.walls as Array<Record<string, unknown>> : [];
  if (!buildings.length && !sourceWalls.length) throw new Error('文件中没有可识别的建筑轮廓或墙体');
  const all = buildings.flatMap((building) => Array.isArray(building.outer) ? building.outer as Array<{ x: number; y: number }> : []);
  const minX = Math.min(...all.map((point) => point.x), 0); const minY = Math.min(...all.map((point) => point.y), 0);
  const maxX = Math.max(...all.map((point) => point.x), 100); const maxY = Math.max(...all.map((point) => point.y), 100);
  const factor = 0.2; const padding = 5;
  const transform = (p: { x: number; y: number }): Point => [(p.x - minX) * factor + padding, (p.y - minY) * factor + padding];
  const config = cloneConfig();
  config.floor.width = Math.max(20, (maxX - minX) * factor + padding * 2);
  config.floor.height = Math.max(20, (maxY - minY) * factor + padding * 2);
  config.areas = buildings.flatMap((building, index) => {
    const pts = Array.isArray(building.outer) ? (building.outer as Array<{ x: number; y: number }>).map(transform) : [];
    if (pts.length < 3) return [];
    const groupId = crypto.randomUUID();
    config.walls.push(...pts.map((point, i) => ({ id: crypto.randomUUID(), groupId, start: point, end: pts[(i + 1) % pts.length], thickness: 0.2, height: 3, color: '#d8e0ea' })));
    return [{ id: crypto.randomUUID(), groupId, name: String(building.name || `建筑 ${index + 1}`), type: 'floor', height: 0.12, color: '#d5e1ed', opacity: 1, points: pts }];
  });
  config.walls.push(...sourceWalls.flatMap((wall) => {
    const x1 = Number(wall.x1); const y1 = Number(wall.y1); const x2 = Number(wall.x2); const y2 = Number(wall.y2);
    if (![x1, y1, x2, y2].every(Number.isFinite)) return [];
    return [{ id: crypto.randomUUID(), start: transform({ x: x1, y: y1 }), end: transform({ x: x2, y: y2 }), thickness: 0.18, height: 3, color: '#d8e0ea' }];
  }));
  config.doors = (Array.isArray(plan.doors) ? plan.doors as Array<Record<string, unknown>> : []).flatMap((door) => {
    const x = Number(door.x); const y = Number(door.y);
    return Number.isFinite(x) && Number.isFinite(y) ? [{ id: crypto.randomUUID(), name: '门', position: transform({ x, y }), width: 0.9, height: 2.1, rotation: 0, color: '#e79a32' }] : [];
  });
  config.floor.name = String((floorData.name as string) || '导入楼层');
  const projectName = String(project.name || '');
  return { config, source: { type: 'file', fileName: projectName || fileName } };
}
function convertGeoJson(data: Record<string, unknown>): { config: SceneConfig; source: ImportedSource } {
  const features = data.type === 'FeatureCollection' ? (data.features as Array<Record<string, unknown>> || []) : [data];
  const polygons = features.flatMap((feature) => {
    const geometry = (feature.geometry || {}) as Record<string, unknown>;
    const coordinates = geometry.coordinates as unknown[];
    const rings = geometry.type === 'Polygon' ? [coordinates?.[0]] : geometry.type === 'MultiPolygon' ? (coordinates || []).map((polygon) => (polygon as unknown[])[0]) : [];
    return rings.filter(Array.isArray).map((ring) => ({ feature, ring: ring as number[][] }));
  });
  if (!polygons.length) throw new Error('GeoJSON 中没有 Polygon / MultiPolygon 建筑');
  const coords = polygons.flatMap((item) => item.ring).filter((point) => point.length >= 2);
  const minLng = Math.min(...coords.map((point) => point[0])); const maxLng = Math.max(...coords.map((point) => point[0]));
  const minLat = Math.min(...coords.map((point) => point[1])); const maxLat = Math.max(...coords.map((point) => point[1]));
  const centerLng = (minLng + maxLng) / 2; const centerLat = (minLat + maxLat) / 2;
  const metersPerLon = 111320 * Math.cos(centerLat * Math.PI / 180); const metersPerLat = 110540; const padding = 8;
  const project = (point: number[]): Point => [(point[0] - minLng) * metersPerLon + padding, (maxLat - point[1]) * metersPerLat + padding];
  const config = cloneConfig(); config.walls = [];
  config.floor.width = Math.max(20, (maxLng - minLng) * metersPerLon + padding * 2);
  config.floor.height = Math.max(20, (maxLat - minLat) * metersPerLat + padding * 2);
  config.areas = polygons.map(({ feature, ring }, index) => {
    const props = (feature.properties || {}) as Record<string, unknown>;
    const points = ring.slice(0, -1).map(project); const groupId = crypto.randomUUID();
    config.walls.push(...points.map((point, i) => ({ id: crypto.randomUUID(), groupId, start: point, end: points[(i + 1) % points.length], thickness: 0.2, height: Number(props.model_height) || 3, color: '#d8e0ea' })));
    return { id: crypto.randomUUID(), groupId, name: String(props.name || `建筑 ${index + 1}`), type: 'floor', height: 0.12, color: '#d5e1ed', opacity: 1, points };
  });
  config.floor.name = '地图导入'; config.doors = [];
  return { config, source: { type: 'geojson', center: [centerLng, centerLat], geoJson: data } };
}
function exportPlan() {
  const data = { floor: props.modelValue.floor, areas: props.modelValue.areas, walls: props.modelValue.walls, doors: props.modelValue.doors || [], models: placedModels.value };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `${props.modelValue.floor.name || 'floor'}.json`; link.click(); URL.revokeObjectURL(url);
}
</script>

<style scoped>
.floor-plan-editor { display: grid; gap: 10px; }
.floor-plan-toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
.floor-plan-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
.floor-plan-editor button, .floor-plan-editor select, .file-button { min-height: 34px; padding: 0 10px; border: 1px solid rgba(83,112,164,.25); border-radius: 6px; background: #fff; color: #233654; cursor: pointer; font: inherit; font-size: 13px; }
.floor-plan-editor button.active { border-color: #3274e8; background: #eaf1ff; color: #1e5fce; }
.floor-plan-editor button:disabled { opacity: .5; cursor: not-allowed; }
.file-button { display: inline-flex; align-items: center; }
.file-button input { display: none; }
.floor-plan-toolbar small { color: #728198; }
.floor-plan-stage { position: relative; height: min(72vh, 820px); min-height: 520px; overflow: hidden; border: 1px solid rgba(83,112,164,.22); border-radius: 8px; background: #fbfdff; }
.floor-plan-stage svg { width: 100%; height: 100%; outline: none; cursor: crosshair; user-select: none; }
.plan-outline { fill: rgba(67,137,207,.12); stroke: #4286be; stroke-width: .28; cursor: pointer; vector-effect: non-scaling-stroke; }
.plan-outline.selected { stroke: #e98d22; stroke-width: 3; }
.plan-wall, .wall-hit { stroke-linecap: round; vector-effect: non-scaling-stroke; }
.plan-wall { stroke: #73859a; cursor: pointer; }
.plan-wall.selected { stroke: #e98d22; }
.wall-hit { stroke: transparent; stroke-width: 14; pointer-events: stroke; }
.door-point { fill: #e9a23a; stroke: #fff; stroke-width: 2; vector-effect: non-scaling-stroke; cursor: pointer; }
.door-point.selected, .asset-point.selected { stroke: #172b4d; stroke-width: 3; }
.asset-point { fill: #438de2; stroke: #fff; stroke-width: 2; vector-effect: non-scaling-stroke; cursor: pointer; }
.object-label, .measure-label, .axis-overlay text { fill: #42536b; font: 12px sans-serif; paint-order: stroke; stroke: #fff; stroke-width: 3; stroke-linejoin: round; pointer-events: none; }
.measure-label { text-anchor: middle; font-size: 10px; }
.pending-outline, .pending-wall { fill: none; stroke: #e6a23d; stroke-width: 3; stroke-dasharray: 8 5; vector-effect: non-scaling-stroke; pointer-events: none; }
.pending-point { fill: #e6a23d; pointer-events: none; }
.axis-overlay line { stroke: rgba(94,111,133,.22); stroke-width: 1; stroke-dasharray: 5 6; vector-effect: non-scaling-stroke; }
.floor-plan-readout { position: absolute; left: 10px; bottom: 10px; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; max-width: calc(100% - 20px); padding: 6px 8px; border: 1px solid rgba(83,112,164,.2); border-radius: 6px; background: rgba(255,255,255,.92); color: #4e6078; font-size: 12px; }
.floor-plan-readout button { min-width: 28px; min-height: 26px; padding: 0 6px; }
.clear-plan-button { color: #b54747 !important; }
.floor-plan-footer { display: flex; flex-wrap: wrap; gap: 14px; color: #718096; font-size: 12px; }
@media (max-width: 760px) { .floor-plan-stage { min-height: 340px; height: 54vh; } .floor-plan-toolbar { align-items: flex-start; } }
</style>

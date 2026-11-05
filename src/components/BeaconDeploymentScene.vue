<template>
  <div
    ref="host"
    class="beacon-scene"
    :class="`beacon-scene--${interactionMode}`"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel.prevent="onWheel"
  >
    <div v-if="loading" class="beacon-scene__notice">{{ t('management.loadingMap') }}</div>
    <div v-if="error" class="beacon-scene__notice beacon-scene__notice--error">{{ error }}</div>
    <div class="beacon-scene__hint">{{ t('management.panZoomBeaconHint') }}</div>
    <div class="beacon-scene__tools" @pointerdown.stop @wheel.stop.prevent>
      <button type="button" :aria-label="t('management.zoomIn')" :title="t('management.zoomIn')" @click.stop="zoomBy(1.25)">+</button>
      <button type="button" :aria-label="t('management.zoomOut')" :title="t('management.zoomOut')" @click.stop="zoomBy(0.8)">−</button>
      <button class="fit-button" type="button" @click.stop="fitView">{{ t('management.fitView') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { SceneConfig } from '@/types/scene';
import type { BeaconVO } from '@/services/adminApi';
import { getModelingAssetUrl, modelingAssetIdFromPath } from '@/modeling-workbench/assetCache';

const props = defineProps<{
  config: SceneConfig;
  beacons: BeaconVO[];
  beaconId: string;
  position: { x: number; y: number; z: number };
}>();
const emit = defineEmits<{ positionChange: [position: { x: number; y: number; z: number }] }>();
const { t } = useI18n();
const host = ref<HTMLElement>();
const loading = ref(false);
const error = ref('');
const interactionMode = ref<'idle' | 'panning' | 'dragging'>('idle');

const modelModules = import.meta.glob('/src/assets/model/**/*.{glb,gltf}', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;
const loader = new GLTFLoader();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 12;
const BEACON_DIAMETER_METERS = 1;
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;
let resizeObserver: ResizeObserver | null = null;
let frameId = 0;
let buildToken = 0;
let editingMarkerGroup: THREE.Group | null = null;
let editingHitTarget: THREE.Mesh | null = null;
let editingHalo: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null;
let viewSize = 1000;
let fittedViewSize = 1000;
let cameraHeight = 1000;
let cameraZoom = 1;
let rendererWidth = 0;
let rendererHeight = 0;
let panStartClient: [number, number] = [0, 0];
let panStartTarget: [number, number] = [0, 0];
let haloBaseScale = 1;
const cameraTarget = new THREE.Vector3();
const fittedTarget = new THREE.Vector3();
const labels: THREE.Sprite[] = [];
const hitTargets: THREE.Mesh[] = [];
const disposableTextures: THREE.Texture[] = [];

function resolveModelPath(path: string) {
  if (/^(https?:|data:|blob:|\/)/.test(path)) return path;
  const normalized = path.startsWith('@/') ? `/src/${path.slice(2)}` : path.startsWith('src/') ? `/${path}` : path;
  return modelModules[normalized] ?? path;
}

function createLabel(text: string, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  context.font = '700 42px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = 'rgba(15, 23, 42, .82)';
  context.fillRect(8, 16, 496, 96);
  context.strokeStyle = color;
  context.lineWidth = 6;
  context.strokeRect(8, 16, 496, 96);
  context.fillStyle = '#fff';
  context.fillText(text, 256, 66, 470);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  disposableTextures.push(texture);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.renderOrder = 20;
  labels.push(sprite);
  return sprite;
}

function addMarker(beacon: BeaconVO, editable: boolean) {
  if (!scene) return;
  const color = editable ? 0x2f7cff : 0x7b8798;
  const group = new THREE.Group();
  group.position.set(beacon.x, beacon.y, beacon.z);

  // 场景单位与 GLB 米制单位保持一致：信标可见球体直径固定为 1 米。
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(BEACON_DIAMETER_METERS / 2, 24, 16),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: editable ? 0.65 : 0.12 }),
  );
  marker.renderOrder = 12;
  group.add(marker);

  const label = createLabel(beacon.beaconId, editable ? '#60a5fa' : '#94a3b8');
  group.add(label);

  if (editable) {
    const hitTarget = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    hitTarget.userData.editableBeacon = true;
    group.add(hitTarget);
    hitTargets.push(hitTarget);

    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.2, 64), haloMaterial);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.04;
    halo.renderOrder = 18;
    halo.visible = false;
    group.add(halo);
    editingMarkerGroup = group;
    editingHitTarget = hitTarget;
    editingHalo = halo;
  }

  scene.add(group);
}

function addConfigGeometry(config: SceneConfig) {
  if (!scene) return;
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xdde5ef, transparent: true, opacity: 0.32, side: THREE.DoubleSide });
  for (const area of config.areas ?? []) {
    if (!area.points?.length) continue;
    const shape = new THREE.Shape();
    area.points.forEach(([x, z], index) => index === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z));
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), floorMaterial.clone());
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 0;
    scene.add(mesh);
  }
  for (const wall of config.walls ?? []) {
    const [x1, z1] = wall.start;
    const [x2, z2] = wall.end;
    const length = Math.hypot(x2 - x1, z2 - z1);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(length, Math.max(wall.height, 2), Math.max(wall.thickness, 1)),
      new THREE.MeshStandardMaterial({ color: wall.color || 0x8291a6 }),
    );
    mesh.position.set((x1 + x2) / 2, Math.max(wall.height, 2) / 2, (z1 + z2) / 2);
    mesh.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    scene.add(mesh);
  }
}

async function rebuild() {
  if (!host.value || !renderer) return;
  const token = ++buildToken;
  loading.value = true;
  error.value = '';
  disposableTextures.splice(0).forEach((texture) => texture.dispose());
  labels.splice(0);
  hitTargets.splice(0);
  editingMarkerGroup = null;
  editingHitTarget = null;
  editingHalo = null;

  const nextScene = new THREE.Scene();
  nextScene.background = new THREE.Color(0x111827);
  nextScene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2.3));
  const light = new THREE.DirectionalLight(0xffffff, 2.2);
  light.position.set(200, 500, 250);
  nextScene.add(light);
  scene = nextScene;
  addConfigGeometry(props.config);

  try {
    await Promise.all((props.config.models ?? []).map(async (model) => {
      if (!model.path) return;
      const modelingAssetId = modelingAssetIdFromPath(model.path);
      const modelUrl = modelingAssetId
        ? await getModelingAssetUrl(modelingAssetId)
        : resolveModelPath(model.path);
      if (!modelUrl) return;
      const gltf = await loader.loadAsync(modelUrl);
      if (token !== buildToken || !scene) return;
      const object = gltf.scene;
      object.scale.setScalar(Number(model.scale) || 1);
      object.position.set(model.center?.[0] ?? 0, model.center?.[1] ?? 0, model.center?.[2] ?? 0);
      object.rotation.set(model.rotation?.[0] ?? 0, model.rotation?.[1] ?? 0, model.rotation?.[2] ?? 0);
      scene.add(object);
    }));
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : t('management.loadMapFailed');
  }
  if (token !== buildToken || !scene) return;

  // 先按建筑模型取景，避免信标标签参与包围盒计算并把地图缩得过小。
  calculateFittedView();
  const visibleBeacons = props.beacons.filter((beacon) => beacon.deploymentStatus === 'deployed');
  visibleBeacons.forEach((beacon) => addMarker(beacon, beacon.beaconId === props.beaconId));
  if (!visibleBeacons.some((beacon) => beacon.beaconId === props.beaconId)) {
    addMarker({ ...props.position, beaconId: props.beaconId, battery: 0, status: '', deploymentStatus: 'deployed' }, true);
  }
  updateMarkerScreenSizes();
  loading.value = false;
}

function calculateFittedView() {
  if (!scene) return;
  const box = new THREE.Box3().setFromObject(scene);
  const center = box.isEmpty() ? new THREE.Vector3(0, 0, 0) : box.getCenter(new THREE.Vector3());
  const size = box.isEmpty()
    ? new THREE.Vector3(props.config.floor.width, 0, props.config.floor.height)
    : box.getSize(new THREE.Vector3());
  fittedViewSize = Math.max(size.x, size.z, props.config.floor.width * 0.25, props.config.floor.height * 0.25, 20) * 1.18;
  fittedTarget.set(center.x, 0, center.z);
  cameraHeight = Math.max(size.y + fittedViewSize, 500);
  fitView();
}

function fitView() {
  viewSize = fittedViewSize;
  cameraZoom = 1;
  cameraTarget.copy(fittedTarget);
  updateCamera();
}

function updateCamera() {
  if (!camera) return;
  camera.position.set(cameraTarget.x, cameraHeight, cameraTarget.z + 0.001);
  camera.up.set(0, 0, -1);
  camera.lookAt(cameraTarget.x, 0, cameraTarget.z);
  if (host.value) {
    host.value.dataset.cameraZoom = cameraZoom.toFixed(4);
    host.value.dataset.cameraTarget = `${cameraTarget.x.toFixed(3)},${cameraTarget.z.toFixed(3)}`;
  }
  updateCameraFrustum();
}

function updateCameraFrustum() {
  if (!camera || !host.value) return;
  const aspect = Math.max(host.value.clientWidth, 1) / Math.max(host.value.clientHeight, 1);
  const visibleSize = viewSize / cameraZoom;
  camera.left = -visibleSize * aspect / 2;
  camera.right = visibleSize * aspect / 2;
  camera.top = visibleSize / 2;
  camera.bottom = -visibleSize / 2;
  camera.updateProjectionMatrix();
  updateMarkerScreenSizes();
}

function updateMarkerScreenSizes() {
  if (!host.value) return;
  const worldPerPixel = viewSize / Math.max(cameraZoom * host.value.clientHeight, 1);
  labels.forEach((label) => {
    label.scale.set(90 * worldPerPixel, 22.5 * worldPerPixel, 1);
    label.position.set(0, Math.max(1.1, 15 * worldPerPixel), 0);
  });
  hitTargets.forEach((target) => {
    const radius = Math.max(0.75, 11 * worldPerPixel);
    target.scale.setScalar(radius);
  });
  haloBaseScale = Math.max(1, (16 * worldPerPixel) / 1.2);
}

function setPointer(event: PointerEvent | WheelEvent) {
  if (!host.value) return;
  const rect = host.value.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
}

function groundPoint(event: PointerEvent | WheelEvent, y = 0) {
  if (!camera) return null;
  setPointer(event);
  raycaster.setFromCamera(pointer, camera);
  const point = new THREE.Vector3();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
  return raycaster.ray.intersectPlane(plane, point) ? point : null;
}

function onPointerDown(event: PointerEvent) {
  if (!camera || !host.value || event.button !== 0) return;
  setPointer(event);
  raycaster.setFromCamera(pointer, camera);
  if (editingHitTarget && raycaster.intersectObject(editingHitTarget, false).length) {
    interactionMode.value = 'dragging';
    dragPlane.constant = -props.position.y;
    if (editingHalo) editingHalo.visible = true;
    host.value.dataset.haloActive = 'true';
  } else {
    interactionMode.value = 'panning';
    panStartClient = [event.clientX, event.clientY];
    panStartTarget = [cameraTarget.x, cameraTarget.z];
  }
  host.value.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (!camera || !host.value) return;
  if (interactionMode.value === 'dragging') {
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const target = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(dragPlane, target)) {
      emit('positionChange', { x: target.x, y: props.position.y, z: target.z });
    }
    return;
  }
  if (interactionMode.value === 'panning') {
    const worldPerPixel = viewSize / Math.max(cameraZoom * host.value.clientHeight, 1);
    cameraTarget.x = panStartTarget[0] - (event.clientX - panStartClient[0]) * worldPerPixel;
    cameraTarget.z = panStartTarget[1] - (event.clientY - panStartClient[1]) * worldPerPixel;
    updateCamera();
  }
}

function onPointerUp(event: PointerEvent) {
  interactionMode.value = 'idle';
  if (editingHalo) editingHalo.visible = false;
  if (host.value) host.value.dataset.haloActive = 'false';
  if (host.value?.hasPointerCapture(event.pointerId)) host.value.releasePointerCapture(event.pointerId);
}

function zoomBy(factor: number, anchor?: THREE.Vector3 | null) {
  const previousZoom = cameraZoom;
  cameraZoom = THREE.MathUtils.clamp(cameraZoom * factor, MIN_ZOOM, MAX_ZOOM);
  if (cameraZoom === previousZoom) return;
  if (anchor) {
    const ratio = previousZoom / cameraZoom;
    cameraTarget.x = anchor.x - (anchor.x - cameraTarget.x) * ratio;
    cameraTarget.z = anchor.z - (anchor.z - cameraTarget.z) * ratio;
  }
  updateCamera();
}

function onWheel(event: WheelEvent) {
  const anchor = groundPoint(event);
  zoomBy(Math.exp(-event.deltaY * 0.0015), anchor);
}

function updateEditingMarker() {
  if (editingMarkerGroup) editingMarkerGroup.position.set(props.position.x, props.position.y, props.position.z);
}

onMounted(() => {
  if (!host.value) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'beacon-scene__canvas';
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', display: 'block', width: '100%', height: '100%' });
  host.value.prepend(renderer.domElement);
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100000);
  resizeObserver = new ResizeObserver(() => {
    if (!host.value || !renderer) return;
    const width = Math.round(host.value.clientWidth);
    const height = Math.round(host.value.clientHeight);
    if (width <= 0 || height <= 0 || (width === rendererWidth && height === rendererHeight)) return;
    rendererWidth = width;
    rendererHeight = height;
    renderer.setSize(width, height, false);
    updateCameraFrustum();
  });
  resizeObserver.observe(host.value);
  const animate = () => {
    frameId = requestAnimationFrame(animate);
    if (editingHalo?.visible) {
      const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.12;
      editingHalo.scale.setScalar(haloBaseScale * pulse);
      editingHalo.material.opacity = 0.62 + Math.sin(performance.now() * 0.008) * 0.16;
    }
    if (renderer && scene && camera) renderer.render(scene, camera);
  };
  animate();
  void rebuild();
});

watch(() => props.position, updateEditingMarker, { deep: true });
watch(() => [props.config, props.beacons, props.beaconId], () => void rebuild(), { deep: true });

onBeforeUnmount(() => {
  buildToken += 1;
  cancelAnimationFrame(frameId);
  resizeObserver?.disconnect();
  disposableTextures.forEach((texture) => texture.dispose());
  renderer?.dispose();
  renderer?.domElement.remove();
});
</script>

<style scoped>
.beacon-scene { position: relative; width: 100%; height: 100%; min-height: 0; overflow: hidden; border-radius: 10px; background: #111827; cursor: grab; touch-action: none; user-select: none; }
.beacon-scene--panning,
.beacon-scene--dragging { cursor: grabbing; }
:deep(.beacon-scene__canvas) { display: block; width: 100%; height: 100%; position: absolute; inset: 0; }
.beacon-scene__notice { position: absolute; z-index: 3; inset: 50% auto auto 50%; transform: translate(-50%, -50%); padding: 10px 14px; border-radius: 8px; background: rgba(15, 23, 42, .82); color: #fff; }
.beacon-scene__notice--error { color: #fecaca; }
.beacon-scene__hint { position: absolute; z-index: 2; top: 14px; left: 14px; padding: 7px 10px; border-radius: 7px; background: rgba(15, 23, 42, .72); color: #dbeafe; font-size: 12px; pointer-events: none; }
.beacon-scene__tools { position: absolute; z-index: 4; top: 14px; right: 14px; display: flex; gap: 6px; }
.beacon-scene__tools button { min-width: 34px; min-height: 34px; padding: 0 10px; border-color: rgba(96, 165, 250, .48); background: rgba(15, 23, 42, .84); color: #dbeafe; backdrop-filter: blur(8px); }
.beacon-scene__tools .fit-button { min-width: auto; }
</style>

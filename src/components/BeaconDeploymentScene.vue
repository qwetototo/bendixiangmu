<template>
  <div ref="host" class="beacon-scene" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp">
    <div v-if="loading" class="beacon-scene__notice">{{ t('management.loadingMap') }}</div>
    <div v-if="error" class="beacon-scene__notice beacon-scene__notice--error">{{ error }}</div>
    <div class="beacon-scene__hint">{{ t('management.dragBeaconHint') }}</div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { SceneConfig } from '@/types/scene';
import type { BeaconVO } from '@/services/adminApi';

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

const modelModules = import.meta.glob('/src/assets/model/**/*.{glb,gltf}', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;
const loader = new GLTFLoader();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;
let resizeObserver: ResizeObserver | null = null;
let frameId = 0;
let buildToken = 0;
let editingMarker: THREE.Mesh | null = null;
let dragging = false;
let viewSize = 1000;
let rendererWidth = 0;
let rendererHeight = 0;
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
  sprite.scale.set(54, 13.5, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function addMarker(beacon: BeaconVO, editable: boolean) {
  if (!scene) return;
  const color = editable ? 0x2f7cff : 0x7b8798;
  const group = new THREE.Group();
  group.position.set(beacon.x, beacon.y, beacon.z);
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(editable ? 7 : 5, 24, 16),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: editable ? 0.45 : 0.08 }),
  );
  marker.position.y = 4;
  group.add(marker);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 8, 12),
    new THREE.MeshStandardMaterial({ color }),
  );
  group.add(stem);
  const label = createLabel(beacon.beaconId, editable ? '#60a5fa' : '#94a3b8');
  label.position.set(0, 17, 0);
  group.add(label);
  group.userData.beaconMarker = true;
  group.userData.editable = editable;
  scene.add(group);
  if (editable) editingMarker = marker;
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
  const nextScene = new THREE.Scene();
  nextScene.background = new THREE.Color(0x111827);
  nextScene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2.3));
  const light = new THREE.DirectionalLight(0xffffff, 2.2);
  light.position.set(200, 500, 250);
  nextScene.add(light);
  scene = nextScene;
  editingMarker = null;
  addConfigGeometry(props.config);

  try {
    await Promise.all((props.config.models ?? []).map(async (model) => {
      if (!model.path) return;
      const gltf = await loader.loadAsync(resolveModelPath(model.path));
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

  const visibleBeacons = props.beacons.filter((beacon) => beacon.deploymentStatus === 'deployed');
  visibleBeacons.forEach((beacon) => addMarker(beacon, beacon.beaconId === props.beaconId));
  if (!visibleBeacons.some((beacon) => beacon.beaconId === props.beaconId)) {
    addMarker({ ...props.position, beaconId: props.beaconId, battery: 0, status: '', deploymentStatus: 'deployed' }, true);
  }
  frameScene();
  loading.value = false;
}

function frameScene() {
  if (!scene || !camera || !host.value) return;
  const box = new THREE.Box3().setFromObject(scene);
  const center = box.isEmpty() ? new THREE.Vector3(0, 0, 0) : box.getCenter(new THREE.Vector3());
  const size = box.isEmpty()
    ? new THREE.Vector3(props.config.floor.width, 0, props.config.floor.height)
    : box.getSize(new THREE.Vector3());
  viewSize = Math.max(size.x, size.z, props.config.floor.width * 0.25, props.config.floor.height * 0.25, 100) * 1.18;
  camera.position.set(center.x, Math.max(size.y + viewSize, 500), center.z + 0.001);
  camera.up.set(0, 0, -1);
  camera.lookAt(center.x, 0, center.z);
  updateCameraFrustum();
}

function updateCameraFrustum() {
  if (!camera || !host.value) return;
  const aspect = Math.max(host.value.clientWidth, 1) / Math.max(host.value.clientHeight, 1);
  camera.left = -viewSize * aspect / 2;
  camera.right = viewSize * aspect / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();
}

function setPointer(event: PointerEvent) {
  if (!host.value) return;
  const rect = host.value.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
}

function onPointerDown(event: PointerEvent) {
  if (!camera || !editingMarker || !host.value) return;
  setPointer(event);
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.intersectObject(editingMarker, false).length) return;
  dragging = true;
  dragPlane.constant = -props.position.y;
  host.value.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (!dragging || !camera) return;
  setPointer(event);
  raycaster.setFromCamera(pointer, camera);
  const target = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(dragPlane, target)) return;
  emit('positionChange', { x: target.x, y: props.position.y, z: target.z });
}

function onPointerUp(event: PointerEvent) {
  dragging = false;
  if (host.value?.hasPointerCapture(event.pointerId)) host.value.releasePointerCapture(event.pointerId);
}

function updateEditingMarker() {
  const group = editingMarker?.parent;
  if (group) group.position.set(props.position.x, props.position.y, props.position.z);
}

onMounted(() => {
  if (!host.value) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'beacon-scene__canvas';
  Object.assign(renderer.domElement.style, {
    position: 'absolute',
    inset: '0',
    display: 'block',
    width: '100%',
    height: '100%',
  });
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
.beacon-scene { position: relative; width: 100%; height: 100%; min-height: 0; overflow: hidden; border-radius: 10px; background: #111827; touch-action: none; }
:deep(.beacon-scene__canvas) { display: block; width: 100%; height: 100%; position: absolute; inset: 0; }
.beacon-scene__notice { position: absolute; z-index: 2; inset: 50% auto auto 50%; transform: translate(-50%, -50%); padding: 10px 14px; border-radius: 8px; background: rgba(15, 23, 42, .82); color: #fff; }
.beacon-scene__notice--error { color: #fecaca; }
.beacon-scene__hint { position: absolute; z-index: 2; top: 14px; left: 14px; padding: 7px 10px; border-radius: 7px; background: rgba(15, 23, 42, .72); color: #dbeafe; font-size: 12px; pointer-events: none; }
</style>

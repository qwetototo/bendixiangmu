<template>
  <section class="view active preview-screen">
    <div class="preview-layout">
      <article class="panel preview-panel wide-preview preview-canvas-panel">
        <div class="canvas-header">
          <div>
            <h2>3D 效果预览</h2>
            <p>左键旋转，右键平移，滚轮缩放。</p>
          </div>
          <span>{{ store.previewMode === 'whole' ? '整栋楼' : store.activeFloor.name }}</span>
        </div>
        <div
          ref="sceneRef"
          :class="['scene', { 'scene-picking': Boolean(pickMode) }]"
          @click="pickScenePoint"
          @contextmenu.prevent
        >
          <div v-if="pickMode" class="scene-pick-hint">{{ pickHint }}</div>
        </div>
      </article>

      <aside class="panel preview-settings-panel">
        <section class="preview-parameters">
          <h2>生成参数</h2>
          <div class="preview-mode-row">
            <button :class="{ active: store.previewMode === 'current' }" @click="setPreviewMode('current')">当前层</button>
            <button :class="{ active: store.previewMode === 'whole' }" @click="setPreviewMode('whole')">整栋楼</button>
            <button @click="downloadJson('building-3d-structure.json', store.exportWhole3d())">导出 3D</button>
          </div>
          <div class="preview-metric-list">
            <div><span>楼层数量</span><strong>{{ store.floors.length }}</strong></div>
            <div><span>当前楼层</span><strong>{{ store.activeFloor.name }}</strong></div>
            <div><span>小模型</span><strong>{{ store.activeFloor.plan.assets.length }}</strong></div>
          </div>
        </section>

        <section class="preview-visibility-settings">
          <header class="preview-settings-heading">
            <h3>整栋透视</h3>
            <small>实心外墙与楼板；窗玻璃不变</small>
          </header>
          <label class="preview-visibility-field">
            <span>外墙透明度 <strong>{{ exteriorTransparency }}%</strong></span>
            <input v-model.number="exteriorTransparency" type="range" min="0" max="90" step="1" :disabled="store.previewMode !== 'whole'">
          </label>
          <label class="preview-visibility-field">
            <span>楼板透明度 <strong>{{ slabTransparency }}%</strong></span>
            <input v-model.number="slabTransparency" type="range" min="0" max="90" step="1" :disabled="store.previewMode !== 'whole'">
          </label>
          <p class="preview-visibility-hint">{{ store.previewMode === 'whole' ? '窗玻璃保持原透光度，室内墙体与设备保持清晰。' : '切换到整栋楼后可调节透视。' }}</p>
        </section>

        <section class="preview-model-settings">
          <header class="preview-settings-heading">
            <h3>模型与定位参数</h3>
            <small>比例 {{ effectiveCalibrationScale.toFixed(3) }} 场景单位/米</small>
          </header>

          <label class="preview-scale-field">
            <span>模型缩放</span>
            <div><input v-model.number="store.modelSettings.modelScale" type="number" min="0.1" max="10" step="0.1" @change="normalizeModelScale"><small>×</small></div>
          </label>

          <div class="preview-origin-settings">
            <div class="preview-setting-title">
              <h4>定位原点</h4>
              <button :class="{ active: pickMode === 'origin' }" @click="togglePick('origin')">{{ pickMode === 'origin' ? '取消选点' : '画布选点' }}</button>
            </div>
            <div class="preview-coordinate-grid">
              <label><span>X</span><input v-model.number="store.modelSettings.positioningOrigin[0]" type="number" step="0.01"></label>
              <label><span>Y</span><input v-model.number="store.modelSettings.positioningOrigin[1]" type="number" step="0.01"></label>
              <label><span>Z</span><input v-model.number="store.modelSettings.positioningOrigin[2]" type="number" step="0.01"></label>
            </div>
          </div>

          <div class="preview-calibration-settings">
            <div class="preview-setting-title">
              <h4>两点校准</h4>
              <span>{{ store.modelSettings.calibrationScale.toFixed(3) }}</span>
            </div>
            <div class="preview-point-row">
              <button :class="{ active: pickMode === 'point-a' }" @click="togglePick('point-a')">A · {{ pointLabel(store.modelSettings.calibrationPoints.a) }}</button>
              <button :class="{ active: pickMode === 'point-b' }" @click="togglePick('point-b')">B · {{ pointLabel(store.modelSettings.calibrationPoints.b) }}</button>
            </div>
            <div class="preview-calibration-actions">
              <label><span>实际距离（米）</span><input v-model.number="store.modelSettings.calibrationRealDistance" type="number" min="0" step="0.01"></label>
              <button class="primary" :disabled="!calibrationValid" @click="applyCalibration">应用</button>
              <button class="ghost" @click="resetCalibration">恢复</button>
            </div>
          </div>

          <p v-if="pickMode" class="preview-pick-status" role="status">{{ pickHint }}</p>
        </section>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { useModelingStore } from '../stores/modelingStore'
import { buildScene } from '../utils/threeBuilder'
import { getModelingAssetUrl } from '../../assetCache'

const store = useModelingStore()
const sceneRef = ref(null)
const pickMode = ref('')
const exteriorTransparency = ref(72)
const slabTransparency = ref(84)
const scenePointA = computed(() => store.modelSettings.calibrationPoints.a)
const scenePointB = computed(() => store.modelSettings.calibrationPoints.b)
const realDistance = computed(() => Number(store.modelSettings.calibrationRealDistance) || 0)
const calibrationDistance = computed(() => {
  if (!scenePointA.value || !scenePointB.value) return 0
  return Math.hypot(
    scenePointB.value[0] - scenePointA.value[0],
    scenePointB.value[1] - scenePointA.value[1],
    scenePointB.value[2] - scenePointA.value[2]
  )
})
const calibrationValid = computed(() => calibrationDistance.value > 0.001 && realDistance.value > 0)
const effectiveCalibrationScale = computed(() => store.modelSettings.calibrationScale * getModelScale())
const pickHint = computed(() => ({
  origin: '请在3D画布中点击定位原点。',
  'point-a': '请在3D画布中点击校准点 A。',
  'point-b': '请在3D画布中点击校准点 B。'
}[pickMode.value] || ''))

let scene
let camera
let renderer
let controls
let frame = null
let grid
let resizeObserver
let buildVersion = 0
const gltfLoader = new GLTFLoader()
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

onMounted(() => {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xe9eff4)
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000)
  camera.position.set(28, 18, 34)
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  sceneRef.value.appendChild(renderer.domElement)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
  controls.addEventListener('change', queueRender)
  renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault())
  scene.add(new THREE.HemisphereLight(0xe4f2ff, 0x53616a, 1.05))
  const sun = new THREE.DirectionalLight(0xffedcf, 2.2)
  sun.position.set(35, 55, 25)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -80
  sun.shadow.camera.right = 80
  sun.shadow.camera.top = 80
  sun.shadow.camera.bottom = -80
  sun.shadow.camera.far = 220
  sun.shadow.bias = -0.00015
  scene.add(sun)
  const fill = new THREE.DirectionalLight(0x9bc8df, 0.55)
  fill.position.set(-35, 24, -22)
  scene.add(fill)
  resize()
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(sceneRef.value)
  window.addEventListener('resize', resize)
  rebuild()
})

onBeforeUnmount(() => {
  buildVersion += 1
  if (frame !== null) cancelAnimationFrame(frame)
  controls?.removeEventListener('change', queueRender)
  resizeObserver?.disconnect()
  window.removeEventListener('resize', resize)
  const geometries = new Set()
  const materials = new Set()
  scene?.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry)
    const list = Array.isArray(object.material) ? object.material : [object.material]
    list.filter(Boolean).forEach((material) => materials.add(material))
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  renderer?.dispose()
})

watch(() => [store.previewMode, store.activeFloorId, store.floors, store.modelSettings.modelScale], rebuild, { deep: true })
watch([exteriorTransparency, slabTransparency, () => store.previewMode], applyBuildingVisibility)
watch(() => store.modelSettings.positioningOrigin, renderOriginMarker, { deep: true })
watch(() => store.modelSettings.calibrationPoints, renderCalibrationMarkers, { deep: true })
watch(pickMode, (mode) => {
  if (controls) controls.enabled = !mode
}, { flush: 'sync' })

function getModelScale() {
  const scale = Number(store.modelSettings.modelScale)
  return Number.isFinite(scale) ? THREE.MathUtils.clamp(scale, 0.1, 10) : 1
}

function normalizeModelScale() {
  store.modelSettings.modelScale = getModelScale()
}

function setPreviewMode(mode) {
  store.previewMode = mode
}

function togglePick(mode) {
  pickMode.value = pickMode.value === mode ? '' : mode
}

function pointLabel(point) {
  return point ? `${point[0].toFixed(1)}, ${point[2].toFixed(1)}` : '未选'
}

function applyCalibration() {
  if (!calibrationValid.value) return
  store.modelSettings.calibrationScale = calibrationDistance.value / realDistance.value
}

function resetCalibration() {
  store.modelSettings.calibrationScale = 1
  store.modelSettings.calibrationRealDistance = 0
  store.modelSettings.calibrationPoints = { a: null, b: null }
  pickMode.value = ''
}

function getActiveFloorBaseHeight() {
  if (store.previewMode !== 'whole') return 0
  const index = store.floors.findIndex((floor) => floor.id === store.activeFloorId)
  return store.floors.slice(0, Math.max(index, 0)).reduce((height, floor) => height + (Number(floor.height) || 3.6), 0)
}

function pickScenePoint(event) {
  if (!pickMode.value || !renderer || !camera || !sceneRef.value) return
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
  raycaster.setFromCamera(pointer, camera)
  const scale = getModelScale()
  const planeY = getActiveFloorBaseHeight() * scale
  const target = new THREE.Vector3()
  if (!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY), target)) return
  const point = [target.x / scale, target.y / scale, target.z / scale]
  if (pickMode.value === 'origin') {
    store.modelSettings.positioningOrigin = point
  } else {
    store.modelSettings.calibrationPoints[pickMode.value === 'point-a' ? 'a' : 'b'] = point
  }
  pickMode.value = ''
  queueRender()
}

function resize() {
  if (!renderer || !sceneRef.value) return
  const w = sceneRef.value.clientWidth
  const h = sceneRef.value.clientHeight
  if (!w || !h) return
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  queueRender()
}

function rebuild() {
  if (!scene) return
  const version = ++buildVersion
  const floors = store.previewMode === 'whole' ? store.floors : [store.activeFloor]
  clearUploadedModels()
  buildScene(scene, floors)
  applyBuildingVisibility()
  scene.children.filter((child) => child.userData.tag === 'generated-model').forEach((child) => child.scale.setScalar(getModelScale()))
  const bounds = getGeneratedBounds()
  frameScene(bounds)
  renderOriginMarker()
  renderCalibrationMarkers()
  void loadUploadedModels(floors, version, bounds)
  controls.update()
  queueRender()
}

function applyBuildingVisibility() {
  if (!scene) return
  const wholeBuilding = store.previewMode === 'whole'
  const transparencyByRole = {
    exterior: wholeBuilding ? exteriorTransparency.value / 100 : 0,
    'floor-plate': wholeBuilding ? slabTransparency.value / 100 : 0
  }
  const materials = new Set()
  scene.traverse((object) => {
    const list = Array.isArray(object.material) ? object.material : [object.material]
    list.filter((material) => material?.userData?.previewVisibilityRole).forEach((material) => materials.add(material))
  })
  materials.forEach((material) => {
    const role = material.userData.previewVisibilityRole
    const baseOpacity = material.userData.previewBaseOpacity ?? 1
    const transparency = transparencyByRole[role] ?? 0
    const opacity = baseOpacity * (1 - transparency)
    material.opacity = opacity
    material.transparent = opacity < 0.999
    material.depthWrite = !material.transparent
    material.needsUpdate = true
  })
  queueRender()
}
function getGeneratedBounds() {
  const bounds = new THREE.Box3()
  scene.children.filter((child) => child.userData.tag === 'generated-model').forEach((child) => bounds.expandByObject(child))
  return bounds.isEmpty() ? null : bounds
}

function renderOriginMarker() {
  if (!scene || !store.modelSettings?.positioningOrigin) return
  const previous = scene.children.find((child) => child.userData.tag === 'modeling-origin-marker')
  if (previous) {
    scene.remove(previous)
    disposeObjectTree(previous)
  }
  const [x, y, z] = store.modelSettings.positioningOrigin
  const scale = getModelScale()
  const marker = new THREE.Group()
  marker.userData.tag = 'modeling-origin-marker'
  marker.add(new THREE.AxesHelper(1.5 * scale))
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.16 * scale, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffc857, depthTest: false })
  )
  dot.renderOrder = 20
  marker.add(dot)
  marker.position.set(x * scale, y * scale, z * scale)
  scene.add(marker)
  queueRender()
}

function renderCalibrationMarkers() {
  if (!scene) return
  scene.children.filter((child) => child.userData.tag === 'modeling-calibration-marker').forEach((child) => {
    scene.remove(child)
    disposeObjectTree(child)
  })
  const scale = getModelScale()
  for (const [key, point] of Object.entries(store.modelSettings.calibrationPoints)) {
    if (!point) continue
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.22 * scale, 16, 12),
      new THREE.MeshBasicMaterial({ color: key === 'a' ? 0x4de0ac : 0xffa94d, depthTest: false })
    )
    marker.userData.tag = 'modeling-calibration-marker'
    marker.position.set(point[0] * scale, point[1] * scale + 0.08 * scale, point[2] * scale)
    marker.renderOrder = 21
    scene.add(marker)
  }
  queueRender()
}

function clearUploadedModels() {
  scene.children.filter((child) => child.userData.tag === 'uploaded-small-model').forEach((child) => {
    scene.remove(child)
    disposeObjectTree(child)
  })
}

async function loadUploadedModels(floors, version, initialBounds) {
  let baseY = 0
  const scaleFactor = getModelScale()
  const bounds = initialBounds?.clone() || new THREE.Box3()
  let hasBounds = Boolean(initialBounds && !initialBounds.isEmpty())

  for (const floor of floors) {
    const floorHeight = Number(floor.height) > 0 ? Number(floor.height) : 3.6
    for (const asset of floor.plan?.assets || []) {
      if (asset.format !== 'glb' || !asset.storageId) continue
      try {
        const url = asset.url || await getModelingAssetUrl(asset.storageId)
        if (!url) continue
        const gltf = await gltfLoader.loadAsync(url)
        const model = gltf.scene
        if (version !== buildVersion || !scene) {
          disposeObjectTree(model)
          return
        }

        const scale = Number(asset.scale)
        model.scale.setScalar((Number.isFinite(scale) && scale > 0 ? scale : 1) * scaleFactor)
        model.rotation.y = Number(asset.rotation) || 0
        model.updateMatrixWorld(true)
        const localBounds = new THREE.Box3().setFromObject(model)
        const x = (Number(asset.x) - 600) * 0.08 * scaleFactor
        const z = (340 - Number(asset.y)) * 0.08 * scaleFactor
        model.position.set(x, baseY * scaleFactor + 0.16 * scaleFactor - localBounds.min.y, z)
        model.userData.tag = 'uploaded-small-model'
        scene.add(model)
        model.updateMatrixWorld(true)
        const modelBounds = new THREE.Box3().setFromObject(model)
        if (!modelBounds.isEmpty()) {
          if (!hasBounds) { bounds.copy(modelBounds); hasBounds = true }
          else bounds.union(modelBounds)
        }
      } catch (error) {
        console.error(`无法加载小模型 ${asset.name || asset.storageId}`, error)
      }
    }
    baseY += floorHeight
  }

  if (version === buildVersion && hasBounds) frameScene(bounds)
  queueRender()
}

function disposeObjectTree(root) {
  const geometries = new Set()
  const materials = new Set()
  const textures = new Set()
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry)
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material]
    objectMaterials.filter(Boolean).forEach((material) => {
      materials.add(material)
      Object.values(material).forEach((value) => {
        if (value?.isTexture) textures.add(value)
      })
    })
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  textures.forEach((texture) => texture.dispose())
}

function frameScene(bounds) {
  const hasBounds = bounds && !bounds.isEmpty()
  const size = hasBounds ? bounds.getSize(new THREE.Vector3()) : new THREE.Vector3(30, 6, 20)
  const center = hasBounds ? bounds.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, 1, 0)
  const radius = Math.max(size.x, size.z, 12)
  controls.target.copy(center)
  camera.near = Math.max(0.05, radius / 500)
  camera.far = Math.max(2000, radius * 24)
  camera.updateProjectionMatrix()
  controls.maxDistance = radius * 12
  camera.position.set(
    center.x + radius * 0.85,
    center.y + Math.max(size.y * 1.4, radius * 0.65),
    center.z + radius * 1.05
  )
  updateGrid(radius)
}

function updateGrid(radius) {
  if (grid) {
    scene.remove(grid)
    grid.geometry?.dispose()
    const previousMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
    previousMaterials.filter(Boolean).forEach((material) => material.dispose())
  }
  const gridSize = Math.max(200, Math.ceil(radius * 2.2 / 50) * 50)
  grid = new THREE.GridHelper(gridSize, gridSize / 5, 0x718391, 0xb5c0c8)
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
  gridMaterials.filter(Boolean).forEach((material) => {
    material.transparent = true
    material.opacity = 0.18
    material.depthWrite = false
  })
  scene.add(grid)
}

function queueRender() {
  if (frame !== null) return
  frame = requestAnimationFrame(() => {
    frame = null
    controls?.update()
    renderer?.render(scene, camera)
  })
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
</script>

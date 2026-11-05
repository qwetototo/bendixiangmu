<template>
  <section class="view active project-info-view">
    <section class="project-welcome-card" aria-label="建模流程说明">
      <span class="welcome-kicker">你好！</span>
      <h2>欢迎开始创建建筑模型</h2>
      <p>先填写基础信息，再导入图纸或地图，也可以跳过导入直接手动编辑；最后在 3D 预览中检查建筑效果。</p>
      <div class="welcome-steps">
        <div class="welcome-step"><span>01</span><div><strong>填写资料</strong><small>项目名称与楼层</small></div></div>
        <i aria-hidden="true"></i>
        <div class="welcome-step"><span>02</span><div><strong>准备平面</strong><small>上传 · 导入 · 手绘</small></div></div>
        <i aria-hidden="true"></i>
        <div class="welcome-step"><span>03</span><div><strong>查看 3D</strong><small>检查整体效果</small></div></div>
      </div>
    </section>
    <div class="grid two project-info-layout">
      <article class="panel project-info-panel project-basic-panel">
        <div class="project-panel-heading">
          <div><h2>项目基本信息</h2><p>用于识别模型项目与场地位置</p></div>
          <span class="info-tag">必填信息</span>
        </div>
        <div class="form-grid project-info-form">
          <label>模型名称<input v-model="store.project.name" placeholder="例如：研发中心办公楼"><small>建议使用易于识别的建筑或项目名称</small></label>
          <label>所在地区<input v-model="store.project.region" placeholder="选择或填写所在地区"></label>
          <label class="full">详细地址<input v-model="store.project.address" placeholder="填写建筑地址（选填）"></label>
          <label class="full">项目说明<textarea v-model="store.project.description" placeholder="简单描述建筑用途或建模需求"></textarea><small>补充建筑用途、场景特点或建模说明</small></label>
        </div>
      </article>

      <article class="panel project-info-panel floor-info-panel">
        <div class="project-panel-heading floor-panel-heading">
          <div><h2>楼层信息</h2><p>添加楼层并填写名称、层高与用途</p></div>
          <div class="floor-head-actions">
            <span class="info-tag">{{ store.floors.length }} 个楼层</span>
            <button type="button" @click="addNextFloor">＋ 添加楼层</button>
            <button type="button" class="danger ghost" :disabled="store.floors.length <= 1" title="至少保留一个楼层" @click="openDeleteDialog">删除最高层</button>
          </div>
        </div>

        <div class="floor-editor-card">
          <div class="floor-editor-heading">
            <button type="button" class="floor-number-picker" aria-haspopup="dialog" aria-label="点击选择楼层" @click="openFloorPicker">
              {{ floorNumber(floorIndex) }}<span aria-hidden="true">⌄</span>
            </button>
            <div class="floor-editor-title">
              <strong>{{ store.activeFloor.name }}</strong>
              <small :class="['floor-readiness', { ready: currentFloorReadiness.ready }]">{{ currentFloorReadiness.label }} · 填写当前楼层信息</small>
            </div>
          </div>

          <div class="form-grid floor-info-form">
            <label>楼层名称<input v-model="store.activeFloor.name" placeholder="例如：一层 · 办公区"></label>
            <label>标准层高<input v-model.number="store.activeFloor.height" type="number" min="1" step="0.1" placeholder="例如：4.0 m"></label>
            <label class="full">楼层说明<input v-model="store.activeFloor.note" placeholder="填写本层用途（选填）"></label>
          </div>

          <section class="floor-file-section">
            <div class="floor-file-heading"><strong>本层建模文件</strong><small>文件直接归属当前楼层</small></div>
            <div class="floor-file-list">
              <article class="floor-file-card">
                <div class="file-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8M8 17h6"/></svg>
                </div>
                <div class="file-copy"><strong>2D 平面图</strong><small>导入本层平面轮廓与空间结构</small><div class="file-formats"><span>JSON</span><span>GeoJSON</span><span>SVG</span></div></div>
                <label class="file-drop">
                  <input type="file" accept=".json,.geojson,.svg" @change="on2dFile">
                  <strong>{{ state2d || '选择平面图　＋' }}</strong><small>{{ state2d ? '已导入当前楼层' : '选择 JSON、GeoJSON 或 SVG 文件' }}</small>
                </label>
              </article>

              <article class="floor-file-card">
                <div class="file-icon file-icon--cyan">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.6 8-4.6M12 12v9"/></svg>
                </div>
                <div class="file-copy"><strong>建筑 3D 模型</strong><small>导入本层建筑主体，用于空间呈现</small><div class="file-formats"><span>GLB</span><span>GLTF</span><span>OBJ</span></div></div>
                <label class="file-drop">
                  <input type="file" accept=".glb,.gltf,.obj" @change="on3dFile">
                  <strong>{{ state3d || '选择建筑模型　＋' }}</strong><small>{{ state3d ? '已记录在当前楼层' : '选择 GLB、GLTF 或 OBJ 文件' }}</small>
                </label>
              </article>
            </div>
            <p v-if="uploadFeedback" class="upload-feedback" role="status" aria-live="polite">{{ uploadFeedback }}</p>
          </section>
        </div>
      </article>
    </div>

    <div v-if="floorPickerOpen" class="floor-modal-mask" @click.self="closeFloorPicker">
      <section class="floor-modal" role="dialog" aria-modal="true" aria-labelledby="floor-picker-title">
        <header><div><h3 id="floor-picker-title">选择楼层</h3><small>共 {{ store.floors.length }} 层</small></div><button type="button" class="modal-close" aria-label="关闭" @click="closeFloorPicker">×</button></header>
        <input v-model="floorSearch" class="floor-search" type="search" placeholder="搜索楼层名称或编号">
        <div class="floor-options">
          <button v-for="item in filteredFloors" :key="item.floor.id" type="button" :class="{ selected: item.floor.id === store.activeFloorId }" @click="selectFloor(item.floor.id)">
            <span class="floor-option-number">{{ floorNumber(item.index) }}</span><span class="floor-option-name">{{ item.floor.name || '楼层 ' + (item.index + 1) }}</span><span :class="['floor-status-badge', { ready: floorModelStatus(item.floor).ready }]">{{ floorModelStatus(item.floor).label }}</span><small v-if="item.floor.id === store.activeFloorId">当前</small>
          </button>
          <p v-if="!filteredFloors.length" class="floor-empty">没有匹配的楼层</p>
        </div>
      </section>
    </div>

    <div v-if="floorGateOpen" class="floor-modal-mask" @click.self="floorGateOpen = false">
      <section class="floor-modal floor-gate-modal" role="dialog" aria-modal="true" aria-labelledby="floor-gate-title">
        <header><div><h3 id="floor-gate-title">暂不能添加下一层</h3><small>{{ blockedFloorName }} 还没有可用于构建的楼层主体</small></div><button type="button" class="modal-close" aria-label="关闭" @click="floorGateOpen = false">×</button></header>
        <p class="delete-message">{{ floorGateMessage }}</p>
        <footer><button type="button" @click="floorGateOpen = false">知道了</button><button type="button" class="primary-button" @click="editBlockedFloor">去编辑本层</button></footer>
      </section>
    </div>

    <div v-if="deleteDialogOpen" class="floor-modal-mask" @click.self="closeDeleteDialog">
      <section class="floor-modal delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-floor-title">
        <header><div><h3 id="delete-floor-title">{{ deleteSucceeded ? '楼层已删除' : '确认删除最高楼层？' }}</h3><small>每次只删除编号最大的一个楼层</small></div><button type="button" class="modal-close" aria-label="关闭" @click="closeDeleteDialog">×</button></header>
        <p class="delete-message" role="status">{{ deleteSucceeded ? '已删除 ' + deletedFloorName + '，当前共 ' + store.floors.length + ' 个楼层。' : '即将删除 ' + highestFloorName + '（第 ' + store.floors.length + ' 层）及该层填写的资料。此操作无法撤销。' }}</p>
        <footer v-if="!deleteSucceeded"><button type="button" @click="closeDeleteDialog">取消</button><button type="button" class="danger-button" @click="confirmDeleteHighestFloor">确认删除</button></footer>
        <footer v-else><button type="button" class="primary-button" @click="closeDeleteDialog">完成</button></footer>
      </section>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { getFloorModelReadiness, useModelingStore } from '../stores/modelingStore'
import { parsePlanFile } from '../utils/planParser'

const emit = defineEmits(['edit-floor'])
const store = useModelingStore()
const floorPickerOpen = ref(false)
const floorSearch = ref('')
const deleteDialogOpen = ref(false)
const deleteSucceeded = ref(false)
const deletedFloorName = ref('')
const uploadFeedback = ref('')
const floorGateOpen = ref(false)
const blockedFloorId = ref('')
const blockedFloorName = ref('')
const floorGateMessage = ref('')

const floorIndex = computed(() => Math.max(0, store.floors.findIndex((floor) => floor.id === store.activeFloorId)))
const currentFloorReadiness = computed(() => getFloorModelReadiness(store.activeFloor))
function floorModelStatus(floor) {
  return getFloorModelReadiness(floor)
}
const highestFloorName = computed(() => {
  const index = store.floors.length - 1
  const floor = store.floors[index]
  return floor?.name || '楼层 ' + (index + 1)
})
const filteredFloors = computed(() => {
  const query = floorSearch.value.trim().toLowerCase()
  return store.floors.map((floor, index) => ({ floor, index })).filter(({ floor, index }) => {
    if (!query) return true
    return (floor.name + ' ' + (index + 1) + ' ' + (index + 1) + 'f').toLowerCase().includes(query)
  })
})
const state2d = computed(() => store.activeFloor?.plan?.uploaded2d?.name || '')
const state3d = computed(() => store.activeFloor?.plan?.uploaded3d?.name || '')

function floorNumber(index) {
  return String(index + 1).padStart(2, '0')
}

function openFloorPicker() {
  floorSearch.value = ''
  floorPickerOpen.value = true
}

function closeFloorPicker() {
  floorPickerOpen.value = false
}

function selectFloor(id) {
  store.activeFloorId = id
  uploadFeedback.value = ''
  closeFloorPicker()
}

function addNextFloor() {
  const result = store.addFloor()
  if (result?.added) return
  const blockedFloor = result?.floor || store.floors[store.floors.length - 1]
  blockedFloorId.value = blockedFloor?.id || ''
  blockedFloorName.value = blockedFloor?.name || '最高楼层'
  floorGateMessage.value = result?.readiness?.message || '请先完成当前最高层的主体结构，再添加下一层。'
  floorGateOpen.value = true
}

function editBlockedFloor() {
  if (blockedFloorId.value) store.activeFloorId = blockedFloorId.value
  floorGateOpen.value = false
  emit('edit-floor')
}

function openDeleteDialog() {
  if (store.floors.length <= 1) return
  deleteSucceeded.value = false
  deletedFloorName.value = ''
  deleteDialogOpen.value = true
}

function closeDeleteDialog() {
  deleteDialogOpen.value = false
}

function confirmDeleteHighestFloor() {
  const removed = store.removeHighestFloor()
  if (!removed) return
  deletedFloorName.value = removed.name || '楼层 ' + (store.floors.length + 1)
  deleteSucceeded.value = true
  uploadFeedback.value = ''
}

async function on2dFile(event) {
  const input = event.target
  const file = input.files?.[0]
  if (!file) return
  const targetFloor = store.activeFloor
  try {
    const plan = await parsePlanFile(file)
    plan.uploaded2d = { name: file.name }
    store.recordUndo('导入平面图')
    targetFloor.plan = plan
    uploadFeedback.value = file.name + ' 已导入 ' + targetFloor.name
  } catch (error) {
    uploadFeedback.value = error instanceof Error ? error.message : '平面图解析失败'
  } finally {
    input.value = ''
  }
}

function on3dFile(event) {
  const input = event.target
  const file = input.files?.[0]
  if (!file) return
  const targetFloor = store.activeFloor
  store.recordUndo('选择建筑 3D 模型')
  targetFloor.plan.uploaded3d = { name: file.name, url: URL.createObjectURL(file) }
  uploadFeedback.value = file.name + ' 已记录在 ' + targetFloor.name
  input.value = ''
}
</script>

<style scoped>
.project-welcome-card { margin-bottom: 14px; padding: 18px 22px 14px; border: 1px solid #e5ebf6; border-radius: 16px; background: linear-gradient(115deg, #fff 0%, #f3f6ff 100%); box-shadow: 0 12px 30px rgba(40, 61, 103, .07); }
.welcome-kicker { color: #4f6de8; font-size: 12px; font-weight: 800; }
.project-welcome-card h2 { margin: 5px 0 4px; font-size: 19px; }
.project-welcome-card > p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
.welcome-steps { display: grid; grid-template-columns: auto 1fr auto 1fr auto; align-items: center; gap: 12px; margin-top: 12px; }
.welcome-steps > i { height: 1px; background: #dce3ef; }
.welcome-step { display: flex; align-items: center; gap: 8px; min-width: 0; }
.welcome-step > span { width: 30px; height: 30px; flex: 0 0 30px; display: grid; place-items: center; border-radius: 50%; color: #4f6de8; background: #eaf0ff; font-size: 10px; font-weight: 800; }
.welcome-step strong, .welcome-step small { display: block; }
.welcome-step strong { font-size: 11px; }
.welcome-step small { margin-top: 2px; color: #93a0b5; font-size: 9px; }
.project-info-view .grid.two.project-info-layout { grid-template-columns: minmax(0, .86fr) minmax(0, 1.14fr) !important; align-items: stretch; min-height: calc(100vh - 370px); }
.project-info-view .project-basic-panel .form-grid.project-info-form { display: grid; grid-template-columns: minmax(0, 1fr) !important; align-content: space-between; flex: 1; gap: clamp(12px, 1.8vh, 22px); }
.project-info-view .project-basic-panel .form-grid.project-info-form .full { grid-column: auto !important; }
.project-info-panel { display: flex; flex-direction: column; min-width: 0; height: 100%; }
.project-panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.project-panel-heading h2 { margin: 0 0 5px; }
.project-panel-heading p { margin: 0; color: var(--muted); font-size: 12px; }
.info-tag { flex: 0 0 auto; border-radius: 8px; padding: 6px 9px; color: #5572dc; background: #eff3ff; font-size: 11px; font-weight: 700; }
.project-info-form { flex: 1; grid-template-columns: minmax(0, 1fr); align-content: space-between; gap: clamp(14px, 2.1vh, 25px); }
.project-info-form .full { grid-column: auto; }
.project-info-form label { font-size: 12px; }
.project-info-form label > small { display: block; margin-top: 5px; color: #98a6ba; font-size: 10px; font-weight: 400; }
.project-info-form input { min-height: 46px; font-size: 13px; }
.project-info-form textarea { min-height: 125px; font-size: 13px; }
.floor-panel-heading { align-items: center; flex-wrap: wrap; }
.floor-head-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 7px; }
.floor-head-actions button { padding: 8px 10px; font-size: 11px; }
.floor-head-actions button:disabled { cursor: not-allowed; opacity: .5; }
.floor-head-actions .danger { color: #bd5962; border-color: #efd8db; }
.floor-editor-card { min-width: 0; padding: 13px; border: 1px solid #e6ecf4; border-radius: 12px; background: linear-gradient(145deg, #fbfcff, #f6f8fd); }
.floor-editor-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 13px; }
.floor-number-picker { position: relative; width: 42px; height: 42px; flex: 0 0 42px; display: grid; place-items: center; border: 0; border-radius: 12px; background: #e9efff; color: #506fe8; font-weight: 800; cursor: pointer; }
.floor-number-picker:hover { background: #dfe8ff; }
.floor-number-picker span { position: absolute; right: 3px; bottom: 2px; color: #6c83d9; font-size: 9px; line-height: 1; }
.floor-editor-title strong { display: block; font-size: 13px; }
.floor-editor-title small { display: block; margin-top: 3px; color: #94a1b5; font-size: 10px; }
.floor-info-form { gap: 9px 12px; }
.floor-info-form label { font-size: 11px; }
.floor-info-form input { min-height: 40px; }
.floor-file-section { margin-top: 13px; padding-top: 11px; border-top: 1px solid #e6ecf4; }
.floor-file-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
.floor-file-heading strong { font-size: 12px; }
.floor-file-heading small { color: #98a5b8; font-size: 10px; }
.floor-file-list { display: grid; gap: 8px; }
.floor-file-card { display: grid; grid-template-columns: 34px minmax(0, 1fr) minmax(150px, 190px); align-items: center; gap: 9px; padding: 9px; border: 1px solid #e5ebf3; border-radius: 11px; background: #fff; }
.file-icon { width: 32px; height: 34px; display: grid; place-items: center; border-radius: 9px; color: #4c6df0; background: #edf2ff; }
.file-icon--cyan { color: #31a8b3; background: #e8f8f8; }
.file-icon svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; }
.file-copy { min-width: 0; }
.file-copy strong { display: block; margin-bottom: 3px; font-size: 11px; }
.file-copy small { display: block; color: #94a1b5; font-size: 9px; }
.file-formats { display: flex; gap: 4px; margin-top: 5px; }
.file-formats span { padding: 3px 5px; border-radius: 5px; color: #8492a8; background: #f2f5f9; font-size: 8px; }
.file-drop { min-width: 0; display: grid; justify-items: center; gap: 3px; padding: 7px 6px; border: 1px dashed #cad5e7; border-radius: 9px; background: #fbfcfe; text-align: center; cursor: pointer; }
.file-drop:hover { border-color: #7890f4; background: #f6f8ff; }
.file-drop input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.file-drop strong { max-width: 100%; overflow: hidden; color: #4d6cea; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.file-drop small { color: #a1acbd; font-size: 8px; }
.upload-feedback { margin: 8px 0 0; color: #73829a; font-size: 10px; }
.floor-modal-mask { position: fixed; inset: 0; z-index: 10050; display: grid; place-items: center; padding: 18px; background: rgba(22, 35, 58, .32); }
.floor-modal { display: flex; flex-direction: column; width: min(520px, 100%); max-height: min(680px, 82vh); padding: 18px; border: 1px solid #e4eaf3; border-radius: 16px; background: #fff; box-shadow: 0 24px 70px rgba(20, 38, 70, .22); }
.floor-modal header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 13px; }
.floor-modal header h3 { margin: 0; font-size: 15px; }
.floor-modal header small { display: block; margin-top: 4px; color: #91a0b6; font-size: 10px; }
.modal-close { width: 30px; height: 30px; padding: 0; font-size: 19px; }
.floor-search { width: 100%; margin-bottom: 11px; }
.floor-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; overflow-y: auto; padding-right: 3px; }
.floor-options button { min-width: 0; display: flex; align-items: center; gap: 8px; padding: 8px; text-align: left; }
.floor-options button.selected { border-color: #bdcbff; color: #3f63e7; background: #edf2ff; }
.floor-option-number { width: 28px; height: 28px; flex: 0 0 28px; display: grid; place-items: center; border-radius: 8px; background: #f1f4f9; font-size: 9px; font-weight: 700; }
.floor-option-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; }
.floor-readiness { color: #bd8b44 !important; }
.floor-readiness.ready { color: #3e9b7c !important; }
.floor-status-badge { flex: 0 0 auto; padding: 3px 5px; border-radius: 6px; color: #bd8b44; background: #fff5e4; font-size: 8px; white-space: nowrap; }
.floor-status-badge.ready { color: #3e9b7c; background: #e8f7f1; }
.floor-options button small { margin-left: auto; color: #4a6bea; font-size: 9px; }
.floor-empty { grid-column: 1 / -1; margin: 0; padding: 24px; text-align: center; color: #94a1b5; font-size: 11px; }
.delete-modal { width: min(430px, 100%); }
.delete-message { margin: 0 0 18px; padding: 12px; border: 1px solid #f0e3e4; border-radius: 10px; background: #fffafb; color: #6f5960; font-size: 12px; line-height: 1.7; }
.delete-modal footer { display: flex; justify-content: flex-end; gap: 8px; padding-top: 0; border: 0; }
.floor-gate-modal footer { display: flex; justify-content: flex-end; gap: 8px; padding-top: 0; border: 0; }
.danger-button, .primary-button { padding: 9px 13px; }
.danger-button { border-color: #e6c1c5; color: #b8414c; background: #fff7f8; }
.primary-button { border-color: var(--brand); color: #fff; background: var(--brand); }
@media (max-width: 1100px) {
  .project-info-view .grid.two.project-info-layout { min-height: 0; grid-template-columns: 1fr !important; }
  .project-info-panel { height: auto; }
  .project-info-form { flex: initial; align-content: initial; gap: 12px; }
}
@media (max-width: 640px) {
  .floor-panel-heading { align-items: flex-start; }
  .floor-head-actions { justify-content: flex-start; }
  .floor-file-card { grid-template-columns: 32px minmax(0, 1fr); }
  .file-drop { grid-column: 1 / -1; }
  .floor-options { grid-template-columns: 1fr; }
}
</style>

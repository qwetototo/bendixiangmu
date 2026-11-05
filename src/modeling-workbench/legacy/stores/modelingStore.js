import { defineStore } from 'pinia'
import { demoPlan } from '../utils/planParser'
import { publishModelingDraft } from '../../sceneBridge'
import { deleteModelingAsset, getModelingAssetUrl, saveModelingAsset } from '../../assetCache'

const HISTORY_STORAGE_KEY = 'modeling-platform-history-v1'
const SEED_STORAGE_KEY = 'twintrack.modeling.seed'
const DRAFT_STORAGE_KEY = 'twintrack.modeling.draft'
const SCENE_UNITS_PER_METER = 12.5
const EDIT_UNDO_LIMIT = 50
const EDIT_UNDO_GROUP_WINDOW_MS = 500

function readHistorySnapshots() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function cloneSnapshotData(value) {
  return JSON.parse(JSON.stringify(value, (key, item) => key === 'url' ? undefined : item))
}

const emptyPlan = () => ({
  buildings: [],
  rooms: [],
  walls: [],
  doors: [],
  assets: [],
  siteFeatures: [],
  referenceImage: null
})

function hasValidOuterBoundary(plan) {
  return (plan?.buildings || []).some((building) => {
    const points = building?.outer
    if (building?.closed === false || !Array.isArray(points) || points.length < 3) return false
    if (points.some((point) => !Number.isFinite(Number(point?.x)) || !Number.isFinite(Number(point?.y)))) return false
    let twiceArea = 0
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length]
      twiceArea += Number(point.x) * Number(next.y) - Number(next.x) * Number(point.y)
    })
    return Math.abs(twiceArea) > 2
  })
}

export function getFloorModelReadiness(floor) {
  const plan = floor?.plan
  if (hasValidOuterBoundary(plan)) {
    return { ready: true, label: '已有模型轮廓', message: '本层存在有效闭合外墙轮廓，可以继续添加下一层。' }
  }

  const hasImportedRooms = Boolean(plan?.uploaded2d?.name) && (plan.rooms || []).some((room) =>
    [room?.x, room?.y, room?.width, room?.height].every((value) => Number.isFinite(Number(value)))
      && Number(room.width) > 0 && Number(room.height) > 0,
  )
  const importedWalls = (plan?.walls || []).filter((wall) =>
    [wall?.x1, wall?.y1, wall?.x2, wall?.y2].every((value) => Number.isFinite(Number(value)))
      && Math.hypot(Number(wall.x2) - Number(wall.x1), Number(wall.y2) - Number(wall.y1)) > 0,
  )
  if (Boolean(plan?.uploaded2d?.name) && (hasImportedRooms || importedWalls.length >= 2)) {
    return { ready: true, label: '已有平面结构', message: '导入的平面包含有效空间或墙体，可以继续添加下一层。' }
  }

  const has3dSelection = Boolean(plan?.uploaded3d?.name)
  return {
    ready: false,
    label: '待建模',
    message: has3dSelection
      ? '本层选择了 3D 文件，但当前上传流程尚未将模型纳入保存和重建。请先导入有效平面或完成外墙轮廓。'
      : '请先导入包含有效结构的平面图，或在 2D 编辑中完成闭合外墙轮廓。单独放置门、设备或小模型不算完成楼层主体。',
  }
}

function defaultAssets() {
  return [
    { id: 'desk-basic', name: '协作工位', type: 'desk', color: '#dfaa55' },
    { id: 'chair-basic', name: '休闲座椅', type: 'chair', color: '#879fcd' },
    { id: 'sensor-basic', name: '室内定位基站', type: 'sensor', color: '#42b7d5' }
  ]
}

function readSeed() {
  try {
    const seed = JSON.parse(localStorage.getItem(SEED_STORAGE_KEY) || 'null')
    return seed?.id && seed?.metadata ? seed : null
  } catch {
    return null
  }
}

function validPoint3(value) {
  return Array.isArray(value) && value.length === 3 && value.every((item) => Number.isFinite(Number(item)))
}

function normalizeModelSettings(settings = {}, seed = null, floorId = '') {
  const floorCalibration = seed?.metadata?.positioningByFloor?.[floorId]
  const fallbackOrigin = floorCalibration?.positioningOrigin ?? seed?.metadata?.positioningOrigin ?? [0, 0, 0]
  const modelScale = Number(settings.modelScale ?? seed?.metadata?.scaleRatio ?? 1)
  const originScale = Number.isFinite(modelScale) && modelScale > 0 ? modelScale : 1
  const storedOrigin = validPoint3(settings.positioningOrigin)
    ? settings.positioningOrigin
    : fallbackOrigin.map((value) => Number(value) / SCENE_UNITS_PER_METER / originScale)
  const fallbackCalibration = Number(floorCalibration?.calibrationScale ?? seed?.metadata?.calibrationScale)
    / SCENE_UNITS_PER_METER / (Number.isFinite(modelScale) && modelScale > 0 ? modelScale : 1)
  const calibrationScale = Number(settings.calibrationScale ?? fallbackCalibration)
  const normalizePoint = (point) => validPoint3(point) ? point.map(Number) : null

  return {
    modelScale: Number.isFinite(modelScale) && modelScale > 0 ? Math.min(10, Math.max(0.1, modelScale)) : 1,
    positioningOrigin: storedOrigin.map(Number),
    calibrationScale: Number.isFinite(calibrationScale) && calibrationScale > 0 ? calibrationScale : 1,
    calibrationRealDistance: Number(settings.calibrationRealDistance) > 0 ? Number(settings.calibrationRealDistance) : 0,
    calibrationPoints: {
      a: normalizePoint(settings.calibrationPoints?.a),
      b: normalizePoint(settings.calibrationPoints?.b),
    },
  }
}

function readDraft(modelId) {
  if (!modelId) return null
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || 'null')
    if (draft?.modelId !== modelId || !draft?.state?.project || !Array.isArray(draft.state.floors)) return null
    return draft.state
  } catch {
    return null
  }
}

function sceneConfigToPlan(config = {}) {
  return {
    buildings: (config.areas || []).map((area) => ({
      id: area.id,
      name: area.name || '建筑轮廓',
      closed: true,
      outer: (area.points || []).map(([x, y]) => ({ x, y }))
    })).filter((building) => building.outer.length >= 3),
    rooms: [],
    walls: (config.walls || []).map((wall) => ({
      id: wall.id,
      x1: wall.start[0], y1: wall.start[1],
      x2: wall.end[0], y2: wall.end[1]
    })),
    doors: (config.doors || []).map((door) => ({
      id: door.id,
      name: door.name,
      x: door.position[0], y: door.position[1],
      width: door.width,
      rotation: door.rotation
    })),
    assets: [],
    siteFeatures: [],
    referenceImage: null
  }
}

function planSnapshotToPlan(plan) {
  return plan && Array.isArray(plan.buildings) && Array.isArray(plan.walls) && Array.isArray(plan.doors)
    ? JSON.parse(JSON.stringify(plan))
    : null
}

function createInitialState() {
  const seed = readSeed()
  const cached = readDraft(seed?.id)
  if (cached) {
    return {
      ...cached,
      modelSettings: normalizeModelSettings(cached.modelSettings, seed, cached.activeFloorId),
    }
  }

  if (seed) {
    const workbenchSnapshot = seed.metadata.modelingWorkbench
    const sourceFloors = Array.isArray(workbenchSnapshot?.floors) && workbenchSnapshot.floors.length
      ? workbenchSnapshot.floors
      : Array.isArray(seed.metadata.floors) && seed.metadata.floors.length
        ? seed.metadata.floors
        : [{ id: seed.config?.floor?.id || 'floor-1', name: seed.config?.floor?.name || '1F', config: seed.config }]
    const floors = sourceFloors.map((floor, index) => ({
      id: floor.id || `floor-${index + 1}`,
      name: floor.name || `${index + 1}F`,
      height: Number(floor.height) > 0 ? Number(floor.height) : 3.2,
      note: floor.description || '',
      plan: planSnapshotToPlan(floor.plan) || sceneConfigToPlan(floor.config)
    }))
    const activeFloorId = floors.some((floor) => floor.id === seed.metadata.activeFloorId)
      ? seed.metadata.activeFloorId
      : floors[0].id
    return {
      project: {
        id: seed.id,
        name: seed.name || '未命名模型',
        region: seed.metadata.region || '',
        address: seed.metadata.address || '',
        description: seed.description || ''
      },
      floors,
      activeFloorId,
      assets: Array.isArray(workbenchSnapshot?.assets) ? workbenchSnapshot.assets : defaultAssets(),
      modelSettings: normalizeModelSettings(workbenchSnapshot?.settings, seed, activeFloorId),
      previewMode: 'whole'
    }
  }

  return {
    project: {
      id: null,
      name: '云栖创新中心',
      region: '杭州 · 未来科技城',
      address: '云谷路 88 号',
      description: '三层创新研发总部示范模型，含中央庭院、联合办公、研发实验室与多功能发布空间。'
    },
    floors: [1, 2, 3].map((floor) => ({
      id: `floor-${floor}`, name: `${floor}F`, height: floor === 1 ? 4.2 : 3.6,
      note: floor === 1 ? '首层公共服务、品牌展廊与联合办公' : floor === 2 ? '研发实验室与项目协作空间' : '培训、管理与多功能发布空间',
      plan: demoPlan(floor)
    })),
    activeFloorId: 'floor-1',
    assets: defaultAssets(),
    modelSettings: normalizeModelSettings(),
    previewMode: 'whole'
  }
}

export const useModelingStore = defineStore('modeling', {
  state: () => ({
    ...createInitialState(),
    historySnapshots: readHistorySnapshots(),
    undoStack: [],
    redoStack: [],
  }),
  getters: {
    activeFloor(state) {
      return state.floors.find((floor) => floor.id === state.activeFloorId) || state.floors[0]
    },
    canUndo(state) {
      return state.undoStack.length > 0
    },
    canRedo(state) {
      return state.redoStack.length > 0
    },
    undoLabel(state) {
      return state.undoStack[state.undoStack.length - 1]?.label || ''
    },
    redoLabel(state) {
      return state.redoStack[state.redoStack.length - 1]?.label || ''
    }
  },
  actions: {
    createEditorSnapshot() {
      return cloneSnapshotData({
        project: this.project,
        floors: this.floors,
        activeFloorId: this.activeFloorId,
        assets: this.assets,
        modelSettings: this.modelSettings,
        previewMode: this.previewMode
      })
    },
    restoreEditorSnapshot(snapshot) {
      this.project = cloneSnapshotData(snapshot.project)
      this.floors = cloneSnapshotData(snapshot.floors)
      this.assets = cloneSnapshotData(snapshot.assets)
      this.modelSettings = cloneSnapshotData(snapshot.modelSettings)
      this.activeFloorId = this.floors.some((floor) => floor.id === snapshot.activeFloorId)
        ? snapshot.activeFloorId
        : this.floors[0]?.id
      this.previewMode = snapshot.previewMode || 'current'
      void this.hydrateLocalAssets()
    },
    recordUndo(label, groupKey = '') {
      const now = Date.now()
      const previous = this.undoStack[this.undoStack.length - 1]
      if (groupKey && previous?.groupKey === groupKey && now - previous.timestamp <= EDIT_UNDO_GROUP_WINDOW_MS) {
        previous.timestamp = now
        this.redoStack = []
        return
      }
      this.undoStack.push({ label, groupKey, timestamp: now, snapshot: this.createEditorSnapshot() })
      if (this.undoStack.length > EDIT_UNDO_LIMIT) this.undoStack.shift()
      this.redoStack = []
    },
    undo() {
      const entry = this.undoStack.pop()
      if (!entry) return false
      this.redoStack.push({ label: entry.label, snapshot: this.createEditorSnapshot() })
      this.restoreEditorSnapshot(entry.snapshot)
      return entry.label
    },
    redo() {
      const entry = this.redoStack.pop()
      if (!entry) return false
      this.undoStack.push({ label: entry.label, groupKey: '', timestamp: Date.now(), snapshot: this.createEditorSnapshot() })
      if (this.undoStack.length > EDIT_UNDO_LIMIT) this.undoStack.shift()
      this.restoreEditorSnapshot(entry.snapshot)
      return entry.label
    },
    loadSeedIfChanged() {
      const seed = readSeed()
      if (!seed?.id || seed.id === this.project.id) return false
      this.$patch(createInitialState())
      this.undoStack = []
      this.redoStack = []
      return true
    },
    addFloor() {
      const previousFloor = this.floors[this.floors.length - 1]
      const readiness = getFloorModelReadiness(previousFloor)
      if (!readiness.ready) return { added: false, floor: previousFloor, readiness }
      this.recordUndo('新增楼层')
      const index = this.floors.length + 1
      const floor = {
        id: `floor-${Date.now()}`,
        name: `楼层 ${index}`,
        height: 3.2,
        note: '',
        plan: emptyPlan()
      }
      this.floors.push(floor)
      this.activeFloorId = floor.id
      return { added: true, floor }
    },
    removeHighestFloor() {
      if (this.floors.length <= 1) return null
      this.recordUndo('删除最高层')
      const removedFloor = this.floors.pop()
      if (removedFloor?.id === this.activeFloorId) this.activeFloorId = this.floors[this.floors.length - 1].id
      return removedFloor || null
    },
    setActivePlan(plan) {
      this.recordUndo('导入地图轮廓')
      this.activeFloor.plan = plan
    },
    clearActivePlan() {
      this.activeFloor.plan = emptyPlan()
    },
    resetActivePlanToDemo() {
      this.activeFloor.plan = demoPlan(this.floors.indexOf(this.activeFloor) + 1)
    },
    addAsset(asset) {
      this.assets.push(asset)
    },
    async addUploadedAsset(file, modelName = '') {
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (extension !== 'glb') throw new Error('当前真实模型加载仅支持 GLB 文件。')
      const name = String(modelName || file.name.replace(/\.[^.]+$/, '')).trim()
      if (!name) throw new Error('请输入小模型名称。')
      const id = `asset-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`
      await saveModelingAsset(id, file)
      const url = await getModelingAssetUrl(id)
      if (!url) throw new Error('模型文件已上传，但无法从本地缓存读取。')
      const asset = {
        id,
        storageId: id,
        format: 'glb',
        name,
        type: file.name.toLowerCase().includes('chair') ? 'chair' : 'custom',
        color: '#f2b84b',
        url,
      }
      this.assets.push(asset)
      return asset
    },
    async hydrateLocalAssets() {
      const assets = new Map()
      this.assets.forEach((asset) => {
        if (asset.storageId) assets.set(asset.storageId, [...(assets.get(asset.storageId) || []), asset])
      })
      this.floors.forEach((floor) => floor.plan.assets.forEach((asset) => {
        if (asset.storageId) assets.set(asset.storageId, [...(assets.get(asset.storageId) || []), asset])
      }))
      await Promise.all([...assets.entries()].map(async ([id, references]) => {
        try {
          const url = await getModelingAssetUrl(id)
          if (url) references.forEach((asset) => { asset.url = url })
        } catch (error) {
          console.warn(`小模型 ${references[0]?.name || id} 暂不可读取`, error)
        }
      }))
    },
    async deleteAsset(assetId) {
      const asset = this.assets.find((item) => item.id === assetId)
      this.assets = this.assets.filter((asset) => asset.id !== assetId)
      this.floors.forEach((floor) => {
        floor.plan.assets = floor.plan.assets.filter((item) => item.id !== assetId)
      })
      const retainedByHistory = asset?.storageId && this.historySnapshots.some((snapshot) =>
        snapshot.assets?.some((item) => item.storageId === asset.storageId)
        || snapshot.floors?.some((floor) => floor.plan?.assets?.some((item) => item.storageId === asset.storageId)),
      )
      if (asset?.storageId && !retainedByHistory) {
        try {
          await deleteModelingAsset(asset.storageId)
        } catch (error) {
          console.warn(`无法清理小模型缓存 ${asset.name || asset.id}`, error)
        }
      }
    },
    exportCurrent2d() {
      return {
        project: this.project,
        floor: this.activeFloor,
        plan: this.activeFloor.plan
      }
    },
    exportWhole3d() {
      let baseHeight = 0
      return {
        project: this.project,
        unit: 'meter',
        settings: cloneSnapshotData(this.modelSettings),
        floors: this.floors.map((floor) => {
          const data = { ...floor, baseHeight }
          baseHeight += Number(floor.height || 3.2)
          return data
        })
      }
    },
    saveHistorySnapshot() {
      const snapshot = {
        id: globalThis.crypto?.randomUUID?.() || `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: this.project.name?.trim() || '未命名模型',
        createdAt: new Date().toISOString(),
        activeFloorId: this.activeFloorId,
        project: cloneSnapshotData(this.project),
        floors: cloneSnapshotData(this.floors),
        assets: cloneSnapshotData(this.assets),
        modelSettings: cloneSnapshotData(this.modelSettings)
      }
      const next = [snapshot, ...this.historySnapshots]
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next))
      this.historySnapshots = next
      return snapshot
    },
    restoreHistorySnapshot(snapshotId) {
      const snapshot = this.historySnapshots.find((item) => item.id === snapshotId)
      if (!snapshot) throw new Error('找不到这条历史模型记录。')
      this.undoStack = []
      this.redoStack = []
      this.project = cloneSnapshotData(snapshot.project)
      this.floors = cloneSnapshotData(snapshot.floors)
      this.assets = cloneSnapshotData(snapshot.assets)
      this.modelSettings = normalizeModelSettings(snapshot.modelSettings)
      this.activeFloorId = this.floors.some((floor) => floor.id === snapshot.activeFloorId)
        ? snapshot.activeFloorId
        : this.floors[0]?.id
      this.previewMode = 'current'
      void this.hydrateLocalAssets()
      return snapshot
    },
    deleteHistorySnapshot(snapshotId) {
      const next = this.historySnapshots.filter((item) => item.id !== snapshotId)
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next))
      this.historySnapshots = next
    },
    persistLocalDraft() {
      try {
        const state = {
          project: cloneSnapshotData(this.project),
          floors: cloneSnapshotData(this.floors),
          activeFloorId: this.activeFloorId,
          assets: cloneSnapshotData(this.assets),
          modelSettings: cloneSnapshotData(this.modelSettings),
          previewMode: this.previewMode
        }
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ modelId: this.project.id, state }))
        return true
      } catch (error) {
        console.warn('建模草稿暂存失败', error)
        return false
      }
    },
    saveProject() {
      this.persistLocalDraft()
      return this.project
    },
    publishToTwinTrack() {
      const seed = readSeed()
      if (!seed) return null
      const saved = publishModelingDraft({
        project: this.project,
        floors: this.floors,
        activeFloorId: this.activeFloorId,
        assets: this.assets,
        modelSettings: this.modelSettings,
      }, seed)
      localStorage.setItem(SEED_STORAGE_KEY, JSON.stringify(saved))
      return saved
    }
  }
})

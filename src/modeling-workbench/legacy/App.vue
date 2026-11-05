<template>
  <aside class="sidebar">
    <nav class="nav">
      <button v-for="item in nav" :key="item.key" :class="{ active: activeView === item.key }" @click="activeView = item.key">
        {{ item.label }}
      </button>
    </nav>
    <button class="back-to-models" type="button" @click="emit('back-to-list')">← 返回模型列表</button>
    <div class="status-card">
      <span>当前项目</span>
      <strong>{{ store.project.name }}</strong>
      <small>{{ store.activeFloor?.name }} · {{ store.previewMode === 'whole' ? '整栋预览' : '当前层' }}</small>
    </div>
  </aside>

  <main :class="['shell', { 'shell--preview': activeView === 'preview', 'shell--editor': activeView === 'editor' }]">

    <ProjectInfo v-if="activeView === 'info'" @edit-floor="activeView = 'editor'" />
    <MapImport v-if="activeView === 'map'" @created="activeView = 'editor'" />
    <Editor2D v-if="activeView === 'editor'" />
    <Preview3D v-if="activeView === 'preview'" />
    <HistoryModels v-if="activeView === 'history'" @edit="activeView = 'editor'" />
    <AssetLibrary v-if="activeView === 'assets'" />
  </main>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useModelingStore } from './stores/modelingStore'
import ProjectInfo from './views/ProjectInfo.vue'
import MapImport from './views/MapImport.vue'
import Editor2D from './views/Editor2D.vue'
import Preview3D from './views/Preview3D.vue'
import HistoryModels from './views/HistoryModels.vue'
import AssetLibrary from './views/AssetLibrary.vue'

const store = useModelingStore()
const emit = defineEmits(['back-to-list'])
const activeView = ref('info')
let draftTimer
const nav = [
  { key: 'info', label: '模型信息' },
  { key: 'map', label: '地图导入' },
  { key: 'editor', label: '2D 编辑' },
  { key: 'preview', label: '3D 预览' },
  { key: 'history', label: '历史模型' },
  { key: 'assets', label: '小模型库' }
]

onMounted(() => {
  store.loadSeedIfChanged()
  void store.hydrateLocalAssets()
  window.addEventListener('keydown', handleHistoryShortcut)
})

watch(
  () => ({
    project: store.project,
    floors: store.floors,
    activeFloorId: store.activeFloorId,
    assets: store.assets,
    modelSettings: store.modelSettings,
    previewMode: store.previewMode
  }),
  () => {
    window.clearTimeout(draftTimer)
    draftTimer = window.setTimeout(() => store.persistLocalDraft(), 300)
  },
  { deep: true }
)

onBeforeUnmount(() => {
  window.clearTimeout(draftTimer)
  window.removeEventListener('keydown', handleHistoryShortcut)
  store.persistLocalDraft()
})

function handleHistoryShortcut(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing) return
  const target = event.target
  if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return

  const key = event.key.toLowerCase()
  const wantsUndo = key === 'z' && !event.shiftKey
  const wantsRedo = key === 'y' || (key === 'z' && event.shiftKey)
  if (wantsUndo && store.canUndo) {
    event.preventDefault()
    store.undo()
  } else if (wantsRedo && store.canRedo) {
    event.preventDefault()
    store.redo()
  }
}

</script>

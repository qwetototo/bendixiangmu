<template>
  <section class="view active asset-library-view">
    <div class="grid">
      <article class="panel asset-library-panel">
        <div class="asset-panel-heading">
          <div><h2>小模型库</h2><p>管理可放置到各楼层的设备与外观模型</p></div>
          <span class="asset-count">{{ store.assets.length }} 个资源</span>
        </div>

        <article class="asset-upload-card">
          <div class="asset-upload-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h.01M4 15l5-4 4 3 3-2 4 3"/></svg></div>
          <div class="asset-upload-copy"><strong>设备 / 小模型资源</strong><small>导入 GLB 模型，之后可在 2D 编辑器中选择并放置</small><span>GLB</span></div>
          <label class="asset-file-drop">
            <input ref="assetInput" type="file" accept=".glb,model/gltf-binary" @change="onAssetFile">
            <strong>选择模型　＋</strong><small>支持 GLB 文件</small>
          </label>
        </article>
        <p v-if="uploadMessage" class="asset-upload-message" role="status" aria-live="polite">{{ uploadMessage }}</p>

        <div v-if="store.assets.length" class="asset-list">
          <div v-for="asset in store.assets" :key="asset.id" class="list-item">
            <div><strong>{{ asset.name }}</strong><span>{{ asset.type }} · {{ asset.format?.toUpperCase() || '内置模型' }}</span></div>
            <div class="list-actions"><button type="button" class="danger ghost" @click="store.deleteAsset(asset.id)">删除</button></div>
          </div>
        </div>
        <div v-else class="asset-empty">暂无小模型资源</div>
      </article>
    </div>

    <div v-if="pendingFile" class="asset-modal-mask" @click.self="cancelAssetImport">
      <section class="asset-name-modal" role="dialog" aria-modal="true" aria-labelledby="asset-name-title">
        <header>
          <div><h3 id="asset-name-title">设置模型名称</h3><small>为导入的小模型设置一个便于识别的名称</small></div>
          <button type="button" class="ghost asset-modal-close" aria-label="关闭" :disabled="isImporting" @click="cancelAssetImport">×</button>
        </header>
        <label class="asset-name-field">模型名称
          <input v-model="newAssetName" autofocus maxlength="80" placeholder="请输入模型名称" @keydown.enter.prevent="confirmAssetImport">
        </label>
        <p class="asset-file-name">待导入文件：{{ pendingFile.name }}</p>
        <p v-if="uploadMessage" class="asset-modal-error" role="alert">{{ uploadMessage }}</p>
        <footer>
          <button type="button" class="ghost" :disabled="isImporting" @click="cancelAssetImport">取消</button>
          <button type="button" class="primary" :disabled="isImporting || !newAssetName.trim()" @click="confirmAssetImport">{{ isImporting ? '正在导入…' : '导入小模型' }}</button>
        </footer>
      </section>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { useModelingStore } from '../stores/modelingStore'

const store = useModelingStore()
const uploadMessage = ref('')
const pendingFile = ref(null)
const newAssetName = ref('')
const isImporting = ref(false)
const assetInput = ref(null)

function onAssetFile(event) {
  const input = event.target
  const file = input.files?.[0]
  if (!file) return
  uploadMessage.value = ''
  pendingFile.value = file
  newAssetName.value = file.name.replace(/\.[^.]+$/, '')
  input.value = ''
}

function cancelAssetImport() {
  if (isImporting.value) return
  pendingFile.value = null
  newAssetName.value = ''
  uploadMessage.value = ''
}

async function confirmAssetImport() {
  const file = pendingFile.value
  const name = newAssetName.value.trim()
  if (!file || !name || isImporting.value) return
  isImporting.value = true
  uploadMessage.value = ''
  try {
    await store.addUploadedAsset(file, name)
    uploadMessage.value = name + ' 已加入小模型库'
    pendingFile.value = null
    newAssetName.value = ''
  } catch (error) {
    uploadMessage.value = error instanceof Error ? error.message : '模型缓存失败'
  } finally {
    isImporting.value = false
  }
}
</script>

<style scoped>
.asset-library-panel { min-width: 0; }
.asset-panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 18px; }
.asset-panel-heading h2 { margin: 0 0 5px; }
.asset-panel-heading p { margin: 0; color: var(--muted); font-size: 12px; }
.asset-count { padding: 6px 9px; border-radius: 8px; color: #5572dc; background: #eff3ff; font-size: 11px; font-weight: 700; }
.asset-upload-card { display: grid; grid-template-columns: 42px minmax(0, 1fr) minmax(170px, 230px); align-items: center; gap: 13px; margin-bottom: 16px; padding: 13px; border: 1px solid var(--line); border-radius: 12px; background: #fff; }
.asset-upload-icon { width: 40px; height: 42px; display: grid; place-items: center; border-radius: 10px; color: #8768dc; background: #f2edff; }
.asset-upload-icon svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.8; }
.asset-upload-copy { min-width: 0; }
.asset-upload-copy strong { display: block; margin-bottom: 4px; font-size: 12px; }
.asset-upload-copy small { display: block; color: #94a1b5; font-size: 10px; }
.asset-upload-copy span { display: inline-block; margin-top: 7px; padding: 3px 6px; border-radius: 6px; color: #8492a8; background: #f2f5f9; font-size: 9px; }
.asset-file-drop { min-width: 0; display: grid; justify-items: center; gap: 4px; padding: 10px; border: 1px dashed #cad5e7; border-radius: 10px; background: #fbfcfe; text-align: center; cursor: pointer; }
.asset-file-drop:hover { border-color: #7890f4; background: #f6f8ff; }
.asset-file-drop input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.asset-file-drop strong { color: #4d6cea; font-size: 10px; }
.asset-file-drop small { color: #a1acbd; font-size: 9px; }
.asset-upload-message { margin: -7px 0 14px; color: #73829a; font-size: 11px; }
.asset-empty { padding: 24px; border: 1px dashed #dce4ef; border-radius: 11px; text-align: center; color: #99a6b9; font-size: 11px; }
.asset-modal-mask { position: fixed; inset: 0; z-index: 10050; display: grid; place-items: center; padding: 18px; background: rgba(22, 35, 58, .32); }
.asset-name-modal { width: min(460px, 100%); padding: 20px; border: 1px solid #e4eaf3; border-radius: 16px; background: #fff; box-shadow: 0 24px 70px rgba(20, 38, 70, .22); }
.asset-name-modal header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.asset-name-modal header h3 { margin: 0; font-size: 16px; }
.asset-name-modal header small { display: block; margin-top: 5px; color: #91a0b6; font-size: 11px; }
.asset-modal-close { width: 30px; height: 30px; padding: 0; font-size: 19px; }
.asset-name-field { display: grid; gap: 7px; color: #46536a; font-size: 12px; font-weight: 700; }
.asset-name-field input { width: 100%; min-height: 42px; padding: 9px 11px; border: 1px solid #dbe3ef; border-radius: 9px; color: #253248; background: #fbfcfe; font: inherit; font-weight: 400; }
.asset-name-field input:focus { outline: 0; border-color: #7890f4; box-shadow: 0 0 0 3px rgba(89, 117, 239, .13); }
.asset-file-name { margin: 10px 0 0; overflow-wrap: anywhere; color: #95a2b5; font-size: 10px; }
.asset-modal-error { margin: 10px 0 0; color: #b8414c; font-size: 11px; }
.asset-name-modal footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.asset-name-modal footer .primary { color: #fff; background: var(--brand); border-color: var(--brand); }
.asset-name-modal button:disabled { cursor: not-allowed; opacity: .55; }
@media (max-width: 640px) { .asset-upload-card { grid-template-columns: 38px minmax(0, 1fr); }.asset-file-drop { grid-column: 1 / -1; } }
</style>

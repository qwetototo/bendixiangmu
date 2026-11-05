<template>
  <section class="view active">
    <div class="history-heading">
      <div>
        <h2>历史模型</h2>
        <p>{{ store.historySnapshots.length }} 条记录</p>
      </div>
      <button class="primary" @click="saveCurrent">保存当前模型</button>
    </div>

    <article v-if="!store.historySnapshots.length" class="panel history-empty">
      <strong>暂无历史模型</strong>
      <span>保存当前模型后，可在这里恢复继续编辑或删除记录。</span>
    </article>

    <div v-else class="history-list">
      <article v-for="snapshot in store.historySnapshots" :key="snapshot.id" class="history-row">
        <div class="history-main">
          <strong>{{ snapshot.name }}</strong>
          <span>{{ formatDate(snapshot.createdAt) }}</span>
        </div>
        <div class="history-metrics">
          <span>{{ snapshot.floors?.length || 0 }} 层</span>
          <span>{{ countItems(snapshot, 'buildings') }} 栋建筑</span>
          <span>{{ countItems(snapshot, 'walls') }} 段框架</span>
          <span>{{ countItems(snapshot, 'doors') }} 个门</span>
          <span>{{ countItems(snapshot, 'assets') }} 个小模型</span>
        </div>
        <div class="list-actions">
          <button @click="restore(snapshot.id)">二次编辑</button>
          <button class="danger ghost" @click="remove(snapshot.id)">删除</button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { useModelingStore } from '../stores/modelingStore'

const emit = defineEmits(['edit'])
const store = useModelingStore()

function saveCurrent() {
  try {
    store.persistLocalDraft()
    store.saveHistorySnapshot()
    store.publishToTwinTrack()
  } catch (error) {
    window.alert(error.name === 'QuotaExceededError' ? '浏览器缓存空间不足，历史模型未保存。' : `保存失败：${error.message}`)
  }
}

function restore(snapshotId) {
  try {
    store.restoreHistorySnapshot(snapshotId)
    emit('edit')
  } catch (error) {
    window.alert(`恢复失败：${error.message}`)
  }
}

function remove(snapshotId) {
  try {
    store.deleteHistorySnapshot(snapshotId)
  } catch (error) {
    window.alert(`删除失败：${error.message}`)
  }
}

function countItems(snapshot, key) {
  return (snapshot.floors || []).reduce((total, floor) => total + (floor.plan?.[key]?.length || 0), 0)
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '时间未知' : date.toLocaleString('zh-CN')
}
</script>

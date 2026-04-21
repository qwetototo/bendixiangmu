<template>
  <PanelCard title="区域概览">
    <div class="placeholder-list">
      <div v-for="area in areas" :key="area.name" class="placeholder-row">
        <span>{{ area.name }}</span>
        <strong>{{ area.value }}</strong>
      </div>
    </div>
  </PanelCard>
</template>

<script setup lang="ts">
import PanelCard from './PanelCard.vue';

const areas = [
  { name: '办公区A', value: '34人' },
  { name: '会议室', value: '2场会议' },
  { name: '开放办公区', value: '58人' },
  { name: '储物间', value: '正常' },
];
</script>

<style scoped>
.placeholder-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.placeholder-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(8, 28, 46, 0.7);
  color: #dce6ef;
}

.placeholder-row strong {
  color: #7ed2ff;
  font-size: 14px;
}
</style>

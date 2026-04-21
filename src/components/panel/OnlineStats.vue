<template>
  <PanelCard title="在线统计">
    <div class="stats-grid">
      <div v-for="item in stats" :key="item.label" class="stats-item">
        <span class="stats-item__value">{{ item.value }}</span>
        <span class="stats-item__label">{{ item.label }}</span>
      </div>
    </div>
  </PanelCard>
</template>

<script setup lang="ts">
import PanelCard from './PanelCard.vue';

const stats = [
  { label: '在线人数', value: 128 },
  { label: '今日进出', value: 326 },
  { label: '告警数', value: 3 },
  { label: '设备在线率', value: '97%' },
];
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.stats-item {
  padding: 16px;
  border: 1px solid rgba(84, 173, 255, 0.18);
  border-radius: 14px;
  background: rgba(10, 34, 56, 0.75);
}

.stats-item__value {
  display: block;
  color: #8ee7ff;
  font-size: 24px;
  font-weight: 700;
}

.stats-item__label {
  display: block;
  margin-top: 6px;
  color: rgba(223, 236, 247, 0.72);
  font-size: 13px;
}
</style>

<template>
  <PanelCard title="事件公告">
    <div class="notice-list">
      <div v-for="item in notices" :key="item.title" class="notice-item">
        <p>{{ item.title }}</p>
        <span>{{ item.time }}</span>
      </div>
    </div>
  </PanelCard>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import PanelCard from './PanelCard.vue';

const notices = [
  { title: '北侧通道设备巡检中', time: dayjs().format('YYYY-MM-DD HH:mm') },
  { title: '会议室定位标签信号正常', time: dayjs().subtract(15, 'minute').format('YYYY-MM-DD HH:mm') },
  { title: '开放办公区今日客流稳定', time: dayjs().subtract(1, 'hour').format('YYYY-MM-DD HH:mm') },
];
</script>

<style scoped>
.notice-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notice-item {
  padding: 14px;
  border-left: 3px solid #29b6f6;
  border-radius: 10px;
  background: rgba(10, 31, 49, 0.72);
}

.notice-item p {
  margin: 0 0 8px;
  color: #ebf6ff;
  font-size: 14px;
}

.notice-item span {
  color: rgba(214, 228, 239, 0.64);
  font-size: 12px;
}
</style>

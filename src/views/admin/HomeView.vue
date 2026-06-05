<template>
  <section class="home-page">
    <section class="summary-grid">
      <article v-for="metric in summaryMetrics" :key="metric.label" class="metric-card">
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
        <small :class="metric.trendType">{{ metric.trend }}</small>
      </article>
    </section>

    <section class="overview-grid">
      <article class="intro-panel">
        <div>
          <h2>平台概览</h2>
          <p>面向企业园区、工厂与实验空间的人员轨迹管理平台，集中展示实时位置、历史轨迹、事件告警与设备状态。</p>
        </div>
        <div class="quick-actions">
          <button type="button" @click="$emit('navigate', 'track', 'live')">进入实时轨迹</button>
          <button type="button" @click="$emit('navigate', 'track', 'events')">查看事件中心</button>
        </div>
      </article>

      <article class="status-panel">
        <h3>今日运行状态</h3>
        <div class="status-list">
          <div v-for="item in statusItems" :key="item.label">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </article>
    </section>

    <section class="workbench-grid">
      <article v-for="item in guideItems" :key="item.title" class="info-card">
        <component :is="item.icon" />
        <h3>{{ item.title }}</h3>
        <p>{{ item.text }}</p>
      </article>

      <article class="activity-panel">
        <h3>实时事件</h3>
        <div class="activity-list">
          <div
            v-for="event in events"
            :key="event.time"
            :class="{ active: selectedEventTime === event.time }"
            @click="selectedEventTime = event.time"
          >
            <time>{{ event.time }}</time>
            <span>{{ event.content }}</span>
            <small :class="event.level">{{ event.levelText }}</small>
          </div>
        </div>
        <div class="activity-detail">
          <span>当前事件</span>
          <strong>{{ selectedEvent.content }}</strong>
        </div>
      </article>

      <article class="task-panel">
        <h3>待处理事项</h3>
        <div class="task-progress">
          <span>{{ completedTaskCount }} / {{ tasks.length }} 已完成</span>
          <div><i :style="{ width: `${taskProgress}%` }"></i></div>
        </div>
        <div class="task-list">
          <label v-for="task in tasks" :key="task">
            <input v-model="completedTasks" :value="task" type="checkbox" />
            <span>{{ task }}</span>
          </label>
        </div>
      </article>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { guideItems, type SectionKey } from '@/services/navigation';

defineEmits<{
  navigate: [sectionKey: SectionKey, submenuKey: string];
}>();

const summaryMetrics = [
  { label: '在线人员', value: '112', trend: '+8 较昨日', trendType: 'up' },
  { label: '绑定设备', value: '156', trend: '96% 可用', trendType: 'normal' },
  { label: '今日轨迹', value: '2,438', trend: '+12.4%', trendType: 'up' },
  { label: '未处理告警', value: '7', trend: '3 项高优先级', trendType: 'warn' },
];

const statusItems = [
  { label: 'MQTT 接入', value: '运行中' },
  { label: '轨迹归档', value: '正常' },
  { label: '定位延迟', value: '48ms' },
  { label: '数据保留', value: '30天' },
];

const events = [
  { time: '10:42:31', content: 'TAG-10086 进入办公区 A', level: 'info', levelText: '记录' },
  { time: '10:39:12', content: '会议室 2 出现人员聚集', level: 'warn', levelText: '关注' },
  { time: '10:31:08', content: 'TAG-10042 电量低于 20%', level: 'alarm', levelText: '告警' },
  { time: '10:28:44', content: '访客 A 离开授权区域', level: 'warn', levelText: '越界' },
];

const tasks = ['核对 3 个未绑定标签', '复查办公区电子围栏规则', '导出今日重点人员轨迹', '确认 MQTT 备用通道配置'];

const selectedEventTime = ref(events[0]?.time ?? '');
const completedTasks = ref<string[]>([]);

const selectedEvent = computed(() => {
  return events.find((event) => event.time === selectedEventTime.value) ?? events[0];
});

const completedTaskCount = computed(() => completedTasks.value.length);
const taskProgress = computed(() => Math.round((completedTaskCount.value / tasks.length) * 100));
</script>

<style scoped>
.home-page {
  display: grid;
  gap: 14px;
}

.summary-grid,
.workbench-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 14px;
}

.metric-card,
.intro-panel,
.status-panel,
.info-card,
.activity-panel,
.task-panel {
  border: 1px solid rgba(118, 148, 212, 0.2);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(25, 31, 45, 0.92), rgba(13, 17, 27, 0.88)),
    rgba(13, 17, 27, 0.88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 16px 34px rgba(0, 0, 0, 0.18);
}

.metric-card {
  position: relative;
  display: grid;
  gap: 8px;
  min-height: 112px;
  padding: 16px;
  overflow: hidden;
}

.metric-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #4d8dff, #7c68ff);
}

.metric-card span,
.status-list span {
  color: rgba(220, 232, 255, 0.66);
  font-size: 13px;
}

.metric-card strong {
  color: #fff;
  font-size: 32px;
  line-height: 1;
}

.metric-card small {
  font-size: 12px;
}

.metric-card small.up {
  color: #43e5a0;
}

.metric-card small.normal {
  color: #83a9ff;
}

.metric-card small.warn {
  color: #ffbd5b;
}

.intro-panel {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  min-height: 164px;
  padding: 22px;
  background:
    linear-gradient(135deg, rgba(37, 51, 78, 0.84), rgba(15, 19, 30, 0.92)),
    rgba(15, 19, 30, 0.9);
}

.intro-panel h2,
.status-panel h3,
.info-card h3,
.activity-panel h3,
.task-panel h3 {
  margin: 0 0 10px;
  color: #fff;
  font-size: 17px;
}

.intro-panel p,
.info-card p {
  max-width: 820px;
  margin: 0;
  color: rgba(224, 235, 255, 0.68);
  line-height: 1.7;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 150px;
}

.quick-actions button {
  height: 38px;
  padding: 0 16px;
  border: 1px solid rgba(94, 143, 255, 0.42);
  border-radius: 6px;
  background: rgba(49, 91, 194, 0.32);
  color: #fff;
  cursor: pointer;
  font-weight: 700;
  transition: background 160ms ease, border-color 160ms ease;
}

.quick-actions button:hover {
  border-color: rgba(123, 162, 255, 0.7);
  background: rgba(67, 107, 220, 0.44);
}

.status-panel,
.activity-panel,
.task-panel,
.info-card {
  padding: 18px;
}

.status-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.status-list div {
  padding: 12px;
  border: 1px solid rgba(118, 148, 212, 0.16);
  border-radius: 6px;
  background: rgba(6, 10, 18, 0.42);
}

.status-list strong {
  display: block;
  margin-top: 6px;
  color: #eaf3ff;
  font-size: 15px;
}

.info-card {
  min-height: 168px;
  transition: transform 160ms ease, border-color 160ms ease;
}

.info-card:hover {
  transform: translateY(-1px);
  border-color: rgba(116, 156, 255, 0.44);
}

.info-card > span {
  color: #7c8fff;
  font-size: 24px;
}

.activity-panel {
  grid-column: span 2;
}

.activity-list,
.task-list {
  display: grid;
  gap: 10px;
}

.activity-list div {
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr) 48px;
  align-items: center;
  gap: 10px;
  min-height: 34px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(118, 148, 212, 0.1);
  color: rgba(230, 240, 255, 0.78);
  font-size: 13px;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease;
}

.activity-list div.active,
.activity-list div:hover {
  margin-inline: -8px;
  padding-inline: 8px;
  border-radius: 6px;
  background: rgba(74, 111, 190, 0.12);
}

.activity-list div:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.activity-list time {
  color: rgba(220, 232, 255, 0.52);
}

.activity-list small {
  justify-self: end;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 12px;
}

.activity-list small.info {
  color: #8db8ff;
  background: rgba(87, 128, 255, 0.12);
}

.activity-list small.warn {
  color: #ffcf75;
  background: rgba(255, 189, 91, 0.12);
}

.activity-list small.alarm {
  color: #ff8585;
  background: rgba(255, 83, 83, 0.12);
}

.task-list label {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 30px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(6, 10, 18, 0.26);
  color: rgba(230, 240, 255, 0.75);
  font-size: 13px;
}

.task-list input {
  accent-color: #698dff;
}

.activity-detail,
.task-progress {
  display: grid;
  gap: 8px;
  margin-top: 12px;
  padding: 10px;
  border: 1px solid rgba(118, 148, 212, 0.14);
  border-radius: 6px;
  background: rgba(57, 95, 178, 0.12);
}

.activity-detail span,
.task-progress span {
  color: rgba(224, 235, 255, 0.62);
  font-size: 12px;
}

.activity-detail strong {
  color: #fff;
  font-size: 13px;
}

.task-progress div {
  height: 5px;
  border-radius: 999px;
  background: rgba(118, 148, 212, 0.16);
  overflow: hidden;
}

.task-progress i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #4d8dff, #46e39c);
}

@media (max-width: 1180px) {
  .summary-grid,
  .workbench-grid,
  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .activity-panel {
    grid-column: span 2;
  }
}

@media (max-width: 760px) {
  .summary-grid,
  .workbench-grid,
  .overview-grid {
    grid-template-columns: 1fr;
  }

  .intro-panel {
    flex-direction: column;
  }

  .activity-panel {
    grid-column: auto;
  }
}
</style>

<template>
  <section :class="['event-page', `event-page--${themeMode}`]">
    <section class="event-card-grid">
      <article v-for="item in eventStats" :key="item.label" class="event-stat">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small>{{ item.note }}</small>
      </article>
    </section>

    <section class="event-workspace">
      <section class="event-panel">
        <div class="event-panel-title">
          <div>
            <h3>告警事件列表</h3>
            <span>按时间、类型、等级和处理状态筛选告警事件。</span>
          </div>
          <button type="button" @click="toastMessage = `已导出 ${filteredEvents.length} 条事件`">导出事件</button>
        </div>

        <div class="event-filter">
          <label>
            <span>时间范围</span>
            <input v-model="filters.timeRange" />
          </label>
          <label>
            <span>事件类型</span>
            <select v-model="filters.type">
              <option value="all">全部类型</option>
              <option value="越界">越界</option>
              <option value="聚集">聚集</option>
              <option value="低电量">低电量</option>
              <option value="离线">离线</option>
            </select>
          </label>
          <label>
            <span>处理状态</span>
            <select v-model="filters.status">
              <option value="all">全部状态</option>
              <option value="待处理">待处理</option>
              <option value="处理中">处理中</option>
              <option value="已关闭">已关闭</option>
            </select>
          </label>
        </div>

        <div class="event-table">
          <div class="event-table-head">
            <span>事件</span>
            <span>时间</span>
            <span>类型</span>
            <span>等级</span>
            <span>状态</span>
            <span>操作</span>
          </div>

          <article
            v-for="event in filteredEvents"
            :key="event.id"
            :class="{ active: selectedEventId === event.id }"
            @click="selectedEventId = event.id"
          >
            <div>
              <strong>{{ event.title }}</strong>
              <small>{{ event.area }} / {{ event.device }}</small>
            </div>
            <span>{{ event.time }}</span>
            <span>{{ event.type }}</span>
            <small :class="['level-pill', event.level]">{{ event.levelText }}</small>
            <small :class="['status-pill', event.statusTone]">{{ event.status }}</small>
            <div class="row-actions">
              <button type="button" @click.stop="addRemark(event.id)">备注</button>
              <button type="button" @click.stop="selectedEventId = event.id">详情</button>
              <button type="button" @click.stop="processEvent(event.id)">处理</button>
            </div>
          </article>

          <div v-if="filteredEvents.length === 0" class="empty-state">暂无匹配的告警事件</div>
        </div>
      </section>

      <aside class="event-detail">
        <h3>事件详情</h3>
        <div v-for="item in detailItems" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
        <button type="button" @click="createTicket">创建处置工单</button>
        <small v-if="toastMessage" class="toast-line">{{ toastMessage }}</small>
      </aside>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

defineProps<{
  themeMode: 'dark' | 'light';
}>();

const filters = reactive({
  timeRange: '今日 00:00 - 23:59',
  type: 'all',
  status: 'all',
});

type EventStatusTone = 'open' | 'running' | 'done';

interface EventRow {
  id: string;
  title: string;
  area: string;
  device: string;
  time: string;
  type: string;
  level: string;
  levelText: string;
  status: string;
  statusTone: EventStatusTone;
  remark: string;
}

const events = reactive<EventRow[]>([
  { id: 'E-1028', title: '访客 A 离开授权区域', area: '会议区', device: 'TAG-10021', time: '10:48:12', type: '越界', level: 'alarm', levelText: '高', status: '待处理', statusTone: 'open', remark: '等待安保复核' },
  { id: 'E-1027', title: '会议室 2 出现人员聚集', area: '会议区', device: 'AREA-Meeting-02', time: '10:39:12', type: '聚集', level: 'warn', levelText: '中', status: '处理中', statusTone: 'running', remark: '已通知现场管理员' },
  { id: 'E-1026', title: 'TAG-10042 电量低于 20%', area: '办公区 A', device: 'TAG-10042', time: '10:31:08', type: '低电量', level: 'warn', levelText: '中', status: '待处理', statusTone: 'open', remark: '待更换标签电池' },
  { id: 'E-1025', title: 'TAG-10003 超过 3 分钟未上报', area: '实验区', device: 'TAG-10003', time: '10:18:44', type: '离线', level: 'normal', levelText: '低', status: '已关闭', statusTone: 'done', remark: '设备已恢复上报' },
]);

const selectedEventId = ref(events[0]?.id ?? '');
const toastMessage = ref('');

const eventStats = [
  { label: '今日事件', value: '42', note: '较昨日 +6' },
  { label: '待处理', value: '7', note: '高优先级 3 项' },
  { label: '处理中', value: '12', note: '平均 18 分钟' },
  { label: '已关闭', value: '23', note: '闭环率 84%' },
];

const filteredEvents = computed(() => events.filter((event) => {
  const typeMatched = filters.type === 'all' || event.type === filters.type;
  const statusMatched = filters.status === 'all' || event.status === filters.status;
  return typeMatched && statusMatched;
}));

const selectedEvent = computed(() => {
  return filteredEvents.value.find((event) => event.id === selectedEventId.value) ?? filteredEvents.value[0] ?? events[0];
});

const detailItems = computed(() => [
  { label: '事件编号', value: selectedEvent.value?.id ?? '-' },
  { label: '事件位置', value: selectedEvent.value?.area ?? '-' },
  { label: '关联设备', value: selectedEvent.value?.device ?? '-' },
  { label: '处理状态', value: selectedEvent.value?.status ?? '-' },
  { label: '备注', value: selectedEvent.value?.remark ?? '-' },
]);

function addRemark(eventId: string) {
  const event = events.find((item) => item.id === eventId);
  if (!event) {
    return;
  }

  selectedEventId.value = eventId;
  event.remark = event.remark === '已追加备注' ? '等待进一步复核' : '已追加备注';
  toastMessage.value = `${event.id} 备注已更新`;
}

function processEvent(eventId: string) {
  const event = events.find((item) => item.id === eventId);
  if (!event) {
    return;
  }

  selectedEventId.value = eventId;
  if (event.statusTone === 'open') {
    event.status = '处理中';
    event.statusTone = 'running';
  } else {
    event.status = '已关闭';
    event.statusTone = 'done';
  }
  toastMessage.value = `${event.id} 状态已更新为${event.status}`;
}

function createTicket() {
  if (!selectedEvent.value) {
    return;
  }

  toastMessage.value = `${selectedEvent.value.id} 已创建处置工单`;
}
</script>

<style scoped>
.event-page {
  display: grid;
  gap: 14px;
}

.event-card-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.event-stat,
.event-panel,
.event-detail {
  border: 1px solid rgba(118, 148, 212, 0.2);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(25, 31, 45, 0.92), rgba(13, 17, 27, 0.88));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 16px 34px rgba(0, 0, 0, 0.18);
}

.event-stat {
  display: grid;
  gap: 8px;
  min-height: 108px;
  padding: 16px;
}

.event-stat span,
.event-stat small,
.event-panel-title span,
.event-detail span,
.event-table span,
.event-table small,
.event-filter label {
  color: rgba(224, 235, 255, 0.66);
  font-size: 13px;
}

.event-stat strong,
.event-panel h3,
.event-detail h3,
.event-detail strong,
.event-table strong {
  color: #fff;
}

.event-stat strong {
  font-size: 30px;
  line-height: 1;
}

.event-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
}

.event-panel {
  min-width: 0;
  overflow: hidden;
}

.event-panel-title,
.event-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(118, 148, 212, 0.12);
}

.event-panel-title h3,
.event-detail h3 {
  margin: 0 0 6px;
}

.event-panel-title button,
.event-detail button,
.row-actions button {
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(95, 137, 215, 0.36);
  border-radius: 6px;
  background: rgba(57, 95, 178, 0.28);
  color: #fff;
  cursor: pointer;
  font-weight: 700;
}

.event-filter {
  justify-content: flex-start;
  background: rgba(5, 9, 16, 0.22);
}

.event-filter label {
  display: grid;
  gap: 6px;
  min-width: 180px;
}

.event-filter input,
.event-filter select {
  height: 36px;
  border: 1px solid rgba(118, 148, 212, 0.16);
  border-radius: 6px;
  background: rgba(6, 10, 18, 0.36);
  color: inherit;
  padding: 0 10px;
}

.event-table {
  min-width: 960px;
  padding: 0 12px 12px;
}

.event-table-head,
.event-table article {
  display: grid;
  grid-template-columns: minmax(260px, 1.4fr) 120px 86px 72px 86px 190px;
  align-items: center;
  gap: 14px;
}

.event-table-head {
  padding: 12px 6px;
  color: rgba(224, 235, 255, 0.46);
  font-size: 12px;
  font-weight: 800;
}

.event-table article {
  min-height: 78px;
  margin-bottom: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(118, 148, 212, 0.12);
  border-radius: 8px;
  background: rgba(9, 14, 24, 0.5);
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease;
}

.event-table article:hover,
.event-table article.active {
  border-color: rgba(100, 181, 246, 0.52);
  background: rgba(46, 112, 210, 0.18);
}

.event-table strong,
.event-table small {
  display: block;
}

.level-pill,
.status-pill {
  justify-self: start;
  padding: 5px 10px;
  border-radius: 999px;
  font-weight: 800;
}

.level-pill.alarm,
.status-pill.open {
  color: #ff9a9a;
  background: rgba(255, 103, 103, 0.12);
}

.level-pill.warn,
.status-pill.running {
  color: #ffcf75;
  background: rgba(255, 189, 91, 0.14);
}

.level-pill.normal,
.status-pill.done {
  color: #46e39c;
  background: rgba(39, 213, 125, 0.14);
}

.row-actions {
  display: flex;
  gap: 8px;
}

.event-detail {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 18px;
}

.event-detail div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(118, 148, 212, 0.12);
}

.empty-state,
.toast-line {
  color: rgba(224, 235, 255, 0.56);
  font-size: 13px;
}

.empty-state {
  padding: 28px 12px 34px;
  text-align: center;
}

.toast-line {
  display: block;
  padding: 10px;
  border-radius: 6px;
  background: rgba(57, 95, 178, 0.16);
}

.event-page--light .event-stat,
.event-page--light .event-panel,
.event-page--light .event-detail {
  border-color: rgba(78, 101, 140, 0.16);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 16px 36px rgba(38, 52, 82, 0.08);
}

.event-page--light .event-stat strong,
.event-page--light .event-panel h3,
.event-page--light .event-detail h3,
.event-page--light .event-detail strong,
.event-page--light .event-table strong {
  color: #172033;
}

.event-page--light .event-stat span,
.event-page--light .event-stat small,
.event-page--light .event-panel-title span,
.event-page--light .event-detail span,
.event-page--light .event-table span,
.event-page--light .event-table small,
.event-page--light .event-filter label {
  color: rgba(52, 65, 89, 0.68);
}

.event-page--light .event-filter {
  border-color: rgba(78, 101, 140, 0.1);
  background: #f8fafc;
}

.event-page--light .event-filter input,
.event-page--light .event-filter select,
.event-page--light .event-table article {
  border-color: rgba(78, 101, 140, 0.12);
  background: rgba(246, 249, 253, 0.78);
}

.event-page--light .event-filter input,
.event-page--light .event-filter select {
  color: #172033;
  background: #fff;
}

.event-page--light .event-filter input::placeholder {
  color: rgba(52, 65, 89, 0.44);
}

.event-page--light .event-filter input:focus,
.event-page--light .event-filter select:focus {
  outline: 2px solid rgba(37, 99, 235, 0.16);
  border-color: rgba(37, 99, 235, 0.38);
}

.event-page--light .event-table article:hover,
.event-page--light .event-table article.active {
  border-color: rgba(37, 99, 235, 0.34);
  background: rgba(37, 99, 235, 0.1);
}

.event-page--light .empty-state,
.event-page--light .toast-line {
  color: rgba(52, 65, 89, 0.6);
}

.event-page--light .toast-line {
  background: rgba(37, 99, 235, 0.08);
}

.event-page--light .event-panel-title button,
.event-page--light .event-detail button,
.event-page--light .row-actions button {
  border-color: rgba(62, 120, 255, 0.32);
  background: rgba(62, 120, 255, 0.1);
  color: #1d4ed8;
}

@media (max-width: 1180px) {
  .event-workspace {
    grid-template-columns: 1fr;
  }

  .event-panel {
    overflow-x: auto;
  }
}

@media (max-width: 860px) {
  .event-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .event-filter,
  .event-panel-title {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

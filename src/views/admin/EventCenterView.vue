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
            <h3>{{ t('events.title') }}</h3>
            <span>{{ t('events.desc') }}</span>
          </div>
          <button type="button" @click="toastMessage = t('events.exportDone', { count: filteredEvents.length })">{{ t('common.export') + t('events.event') }}</button>
        </div>

        <div class="event-filter">
          <label>
            <span>{{ t('events.timeRange') }}</span>
            <input v-model="filters.timeRange" />
          </label>
          <label>
            <span>{{ t('events.eventType') }}</span>
            <select v-model="filters.type">
              <option value="all">{{ t('events.allTypes') }}</option>
              <option value="越界">{{ t('events.typeCrossing') }}</option>
              <option value="聚集">{{ t('events.typeGather') }}</option>
              <option value="低电量">{{ t('events.typeLowBattery') }}</option>
              <option value="离线">{{ t('events.typeOffline') }}</option>
              <option value="SOS 紧急告警">SOS 紧急告警</option>
            </select>
          </label>
          <label>
            <span>{{ t('events.processStatus') }}</span>
            <select v-model="filters.status">
              <option value="all">{{ t('events.allStatus') }}</option>
              <option value="未解决">未解决</option>
              <option value="处理中">{{ t('events.statusProcessing') }}</option>
              <option value="已解决">已解决</option>
              <option value="已忽略">已忽略</option>
            </select>
          </label>
        </div>

        <div class="event-table">
          <div class="event-table-head">
            <span>{{ t('events.event') }}</span>
            <span>{{ t('events.time') }}</span>
            <span>{{ t('events.type') }}</span>
            <span>{{ t('events.level') }}</span>
            <span>{{ t('events.status') }}</span>
            <span>最后处理时间</span>
            <span>{{ t('events.action') }}</span>
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
            <span class="processed-time">{{ event.processedAt }}</span>
            <div class="row-actions">
              <button type="button" @click.stop="openProcessDialog(event.id)">{{ t('common.process') }}</button>
            </div>
          </article>

          <div v-if="filteredEvents.length === 0" class="empty-state">{{ t('events.emptyState') }}</div>
        </div>
      </section>

      <aside class="event-detail">
        <h3>{{ t('events.eventDetail') }}</h3>
        <div v-for="item in detailItems" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
        <small v-if="toastMessage" class="toast-line">{{ toastMessage }}</small>
      </aside>
    </section>

    <BaseModal :open="processingEventId !== ''" title="处理告警" eyebrow="更新处置结果" :theme-mode="themeMode" @close="closeProcessDialog">
      <div class="process-form">
        <label>处理状态
          <select v-model="processForm.status">
            <option value="pending">未解决</option>
            <option value="processing">处理中</option>
            <option value="closed">已解决</option>
            <option value="ignored">已忽略</option>
          </select>
        </label>
        <label>报警等级
          <select v-model="processForm.alertLevel">
            <option value="alarm">高</option>
            <option value="warn">中</option>
            <option value="normal">低</option>
          </select>
        </label>
        <label class="process-form__remark">处置备注
          <textarea v-model.trim="processForm.remark" maxlength="500" placeholder="填写处理过程、结果或交接说明" />
        </label>
      </div>
      <template #footer>
        <button type="button" :disabled="processingSaving" @click="closeProcessDialog">取消</button>
        <button class="primary" type="button" :disabled="processingSaving" @click="saveProcessDialog">
          {{ processingSaving ? '保存中…' : '保存处理结果' }}
        </button>
      </template>
    </BaseModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '@/components/BaseModal.vue';
import { fetchAlertEvents, updateAlertEvent, type AlertEventVO } from '@/services/adminApi';

const { t } = useI18n();

defineProps<{
  themeMode: 'dark' | 'light';
}>();

const filters = reactive({
  timeRange: '今日 00:00 - 23:59',
  type: 'all',
  status: 'all',
});

type EventStatusTone = 'open' | 'running' | 'done' | 'ignored';

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
  processedAt: string;
}

const eventTypeLabel: Record<AlertEventVO['eventType'], string> = {
  crossing: '越界',
  gather: '聚集',
  low_battery: '低电量',
  offline: '离线',
  sos: 'SOS 紧急告警',
};

const eventStatusLabel: Record<AlertEventVO['status'], string> = {
  pending: '未解决',
  processing: '处理中',
  closed: '已解决',
  ignored: '已忽略',
};

const eventStatusTone: Record<AlertEventVO['status'], EventStatusTone> = {
  pending: 'open',
  processing: 'running',
  closed: 'done',
  ignored: 'ignored',
};

const eventLevelLabel: Record<AlertEventVO['alertLevel'], string> = {
  alarm: '高',
  warn: '中',
  normal: '低',
};

const eventSource = ref<AlertEventVO[]>([]);
const events = computed<EventRow[]>(() => eventSource.value.map((event) => ({
  id: event.eventId,
  title: event.title,
  area: event.area || '--',
  device: event.deviceId || '--',
  time: formatEventTime(event.occurredAt),
  type: eventTypeLabel[event.eventType],
  level: event.alertLevel,
  levelText: eventLevelLabel[event.alertLevel],
  status: eventStatusLabel[event.status],
  statusTone: eventStatusTone[event.status],
  remark: event.remark || '--',
  processedAt: event.processedAt ? formatEventDateTime(event.processedAt) : '未处理',
})));

const selectedEventId = ref('');
const toastMessage = ref('');
const processingEventId = ref('');
const processingSaving = ref(false);
const processForm = reactive({
  status: 'pending' as AlertEventVO['status'],
  alertLevel: 'warn' as AlertEventVO['alertLevel'],
  remark: '',
});

const eventStats = computed(() => [
  { label: t('events.todayEvents'), value: String(events.value.length), note: '当前筛选结果' },
  { label: t('events.pending'), value: String(eventSource.value.filter((event) => event.status === 'pending').length), note: t('events.highPriority') },
  { label: t('events.processing'), value: String(eventSource.value.filter((event) => event.status === 'processing').length), note: t('events.avgMinutes', { min: 18 }) },
  { label: t('events.closed'), value: String(eventSource.value.filter((event) => event.status === 'closed').length), note: t('events.closureRate', { rate: 84 }) },
]);

const filteredEvents = computed(() => events.value.filter((event) => {
  const typeMatched = filters.type === 'all' || event.type === filters.type;
  const statusMatched = filters.status === 'all' || event.status === filters.status;
  return typeMatched && statusMatched;
}));

const selectedEvent = computed(() => {
  return filteredEvents.value.find((event) => event.id === selectedEventId.value) ?? filteredEvents.value[0] ?? events.value[0];
});

const detailItems = computed(() => [
  { label: t('events.eventId'), value: selectedEvent.value?.id ?? '-' },
  { label: t('events.eventLocation'), value: selectedEvent.value?.area ?? '-' },
  { label: t('events.associatedDevice'), value: selectedEvent.value?.device ?? '-' },
  { label: t('events.processStatus'), value: selectedEvent.value?.status ?? '-' },
  { label: '最后处理时间', value: selectedEvent.value?.processedAt ?? '-' },
  { label: t('common.remark'), value: selectedEvent.value?.remark ?? '-' },
]);

function openProcessDialog(eventId: string) {
  const event = eventSource.value.find((item) => item.eventId === eventId);
  if (!event) return;
  selectedEventId.value = eventId;
  processingEventId.value = eventId;
  processForm.status = event.status;
  processForm.alertLevel = event.alertLevel;
  processForm.remark = event.remark ?? '';
}

function closeProcessDialog() {
  if (!processingSaving.value) processingEventId.value = '';
}

async function saveProcessDialog() {
  if (!processingEventId.value) return;
  processingSaving.value = true;
  try {
    const updated = await updateAlertEvent(processingEventId.value, { ...processForm });
    replaceEvent(updated);
    toastMessage.value = `告警 ${updated.eventId} 已更新为${eventStatusLabel[updated.status]}`;
    processingEventId.value = '';
  } catch (error) {
    toastMessage.value = error instanceof Error ? error.message : '更新事件失败';
  } finally {
    processingSaving.value = false;
  }
}

function formatEventTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatEventDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function replaceEvent(updated: AlertEventVO) {
  const index = eventSource.value.findIndex((event) => event.eventId === updated.eventId);
  if (index >= 0) eventSource.value.splice(index, 1, updated);
}

onMounted(async () => {
  try {
    const page = await fetchAlertEvents({ page: 1, pageSize: 20 });
    eventSource.value = page.records;
    selectedEventId.value = page.records[0]?.eventId ?? '';
  } catch (error) {
    toastMessage.value = error instanceof Error ? error.message : '加载事件失败';
  }
});

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
  min-width: 1100px;
  padding: 0 12px 12px;
}

.event-table-head,
.event-table article {
  display: grid;
  grid-template-columns: minmax(240px, 1.35fr) 96px 82px 64px 78px 142px 76px;
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

.processed-time {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
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

.status-pill.ignored {
  color: #aeb9ce;
  background: rgba(174, 185, 206, 0.14);
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

.process-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.process-form label {
  display: grid;
  gap: 6px;
  color: #3d4a61;
  font-size: 13px;
  font-weight: 700;
}

.process-form select,
.process-form textarea {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: #fff;
  color: #172033;
  padding: 9px 10px;
  font: inherit;
}

.process-form textarea {
  min-height: 108px;
  resize: vertical;
}

.process-form select:focus-visible,
.process-form textarea:focus-visible {
  outline: 3px solid rgba(47, 111, 255, 0.2);
  border-color: #2f6fff;
}

.process-form__remark {
  grid-column: 1 / -1;
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

:global(.management-modal-mask--dark) .process-form label {
  color: #d5deec;
}

:global(.management-modal-mask--dark) .process-form select,
:global(.management-modal-mask--dark) .process-form textarea {
  border-color: #3b4a63;
  background: #111a29;
  color: #f2f6ff;
}

:global(.management-modal-mask--dark) .process-form select:focus-visible,
:global(.management-modal-mask--dark) .process-form textarea:focus-visible {
  outline-color: rgba(104, 161, 255, 0.28);
  border-color: #68a1ff;
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

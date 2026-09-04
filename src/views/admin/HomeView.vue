<template>
  <section class="home-page">
    <section class="summary-grid">
      <article
        v-for="metric in summaryMetrics"
        :key="metric.label"
        class="metric-card"
        :class="[`metric-card--${metric.kind}`, { 'is-clickable': metric.nav }]"
        @click="metric.nav && goTo(metric.nav.section, metric.nav.submenu)"
      >
        <span>{{ metric.label }}</span>

        <template v-if="metric.kind === 'system'">
          <div class="mini-metrics">
            <div v-for="item in systemItems" :key="item.key" class="mini-item">
              <span class="mini-head"><em>{{ item.label }}</em><b :class="item.level">{{ item.text }}</b></span>
            </div>
          </div>
        </template>

        <template v-else-if="metric.kind === 'alert'">
          <div ref="todayAlertChartEl" class="chart chart--donut" />
        </template>

        <template v-else>
          <strong>{{ metric.value }}</strong>
          <small :class="metric.trendType">{{ metric.trend }}</small>
        </template>
      </article>
    </section>

    <section class="overview-grid">
      <article class="intro-panel">
        <h2>{{ t('home.overview') }}</h2>
        <p>{{ t('home.overviewDesc') }}</p>
      </article>

      <article class="status-panel">
        <h3>{{ t('home.personnelDeviceStatusDist') }}</h3>
        <div ref="deviceDistChartEl" class="chart chart--donut chart--device" />
      </article>
    </section>

    <section class="workbench-grid">
      <article class="activity-panel is-clickable" @click="goTo('events', 'events')">
        <h3>{{ t('home.realtimeEvents') }}</h3>
        <div class="activity-list">
          <div
            v-for="event in events"
            :key="event.id"
            :class="{ active: selectedEventTime === event.id }"
            @click.stop="onEventClick(event.id)"
          >
            <time>{{ event.time }}</time>
            <span>{{ event.content }}</span>
            <small :class="event.level">{{ event.levelText }}</small>
          </div>
        </div>
        <div class="activity-detail">
          <span>{{ t('home.currentEvents') }}</span>
          <strong>{{ selectedEvent?.content || '--' }}</strong>
        </div>
      </article>

      <article class="dist-panel">
        <h3>{{ t('home.alertTypeDist') }}</h3>
        <div ref="alertTypeChartEl" class="chart chart--bar" />
      </article>

      <article class="dist-panel">
        <h3>{{ t('home.departmentDist') }}</h3>
        <div ref="deptChartEl" class="chart chart--hbar" />
      </article>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useNavigation, type SectionKey } from '@/services/navigation';
import * as echarts from 'echarts';
import type { ECharts, EChartsOption } from 'echarts';
import {
  fetchAlertEvents,
  fetchDashboardSummary,
  fetchDepartments,
  fetchSystemStatus,
  type DashboardSummaryVO,
  type DepartmentVO,
  type SystemStatusVO,
} from '@/services/adminApi';

const { t } = useI18n();
const { guideItems } = useNavigation();

const props = withDefaults(defineProps<{ themeMode?: 'dark' | 'light' }>(), { themeMode: 'dark' });
const isLightTheme = computed(() => props.themeMode === 'light');

const emit = defineEmits<{ navigate: [section: SectionKey, submenu: string] }>();

function goTo(section: SectionKey, submenu: string): void {
  emit('navigate', section, submenu);
}

const dashboard = ref<DashboardSummaryVO | null>(null);
const systemStatus = ref<SystemStatusVO | null>(null);
const departments = ref<DepartmentVO[]>([]);

type MetricKind = 'number' | 'system' | 'alert';

interface MetricNav {
  section: SectionKey;
  submenu: string;
}

type MetricItem = {
  kind: MetricKind;
  label: string;
  value: string;
  trend: string;
  trendType: 'up' | 'normal' | 'warn';
  nav?: MetricNav;
};

const summaryMetrics = computed<MetricItem[]>(() => [
  {
    kind: 'number',
    label: t('home.onlinePersonnel'),
    value: String(dashboard.value?.activePersonnel ?? '--'),
    trend: `${dashboard.value?.totalPersonnel ?? '--'} ${t('identity.totalPersonnel')}`,
    trendType: 'up',
    nav: { section: 'identity', submenu: 'personnel' },
  },
  {
    kind: 'number',
    label: t('home.boundDevices'),
    value: String(dashboard.value?.boundDeviceCount ?? '--'),
    trend: `${dashboard.value?.totalDeviceCount ?? '--'} ${t('home.totalDevices')}`,
    trendType: 'normal',
    nav: { section: 'identity', submenu: 'devices' },
  },
  { kind: 'system', label: t('home.runStatus'), value: '', trend: '', trendType: 'normal' },
  {
    kind: 'alert',
    label: t('home.todayAlerts'),
    value: '',
    trend: '',
    trendType: 'warn',
    nav: { section: 'events', submenu: 'events' },
  },
]);

/** 运行状态卡：CPU / 内存 / 磁盘负载（简单数值） */
const systemItems = computed(() => {
  const s = systemStatus.value;
  return [
    { key: 'cpu', label: t('home.cpu'), raw: s?.cpuUsage },
    { key: 'memory', label: t('home.memory'), raw: s?.memoryUsage },
    { key: 'disk', label: t('home.disk'), raw: s?.diskUsage },
  ].map((item) => {
    const v = typeof item.raw === 'number' ? item.raw : -1;
    const level = v < 0 ? 'muted' : v < 60 ? 'ok' : v < 85 ? 'warn' : 'danger';
    return {
      ...item,
      text: v < 0 ? '--' : `${Math.round(v)}%`,
      level,
    };
  });
});

/** 今日告警卡：各处理状态数量（环形图数据源） */
const todayAlertItems = computed(() => {
  const d = dashboard.value;
  return [
    { key: 'pending', label: t('events.pending'), value: d?.todayPendingAlertCount ?? 0, level: 'warn' },
    { key: 'processing', label: t('events.processing'), value: d?.todayProcessingAlertCount ?? 0, level: 'info' },
    { key: 'closed', label: t('events.closed'), value: d?.todayClosedAlertCount ?? 0, level: 'ok' },
    { key: 'ignored', label: t('events.ignored'), value: d?.todayIgnoredAlertCount ?? 0, level: 'muted' },
  ];
});

/** 人员设备状态分布面板：只统计已绑定人员的设备 */
const personnelDeviceStatusItems = computed(() => {
  const d = dashboard.value;
  return [
    { label: t('home.deviceOnline'), value: d?.onlineDevices ?? 0 },
    { label: t('home.deviceOffline'), value: d?.offlineDevices ?? 0 },
    { label: t('home.deviceSos'), value: d?.sosDevices ?? 0 },
  ];
});

/** 今日告警类型分布面板 */
const alertTypeItems = computed(() => {
  const d = dashboard.value;
  return [
    { key: 'crossing', label: t('events.typeCrossing'), value: d?.todayCrossingCount ?? 0 },
    { key: 'gather', label: t('events.typeGather'), value: d?.todayGatherCount ?? 0 },
    { key: 'low_battery', label: t('events.typeLowBattery'), value: d?.todayLowBatteryCount ?? 0 },
    { key: 'offline', label: t('events.typeOffline'), value: d?.todayOfflineCount ?? 0 },
    { key: 'sos', label: t('events.typeSos'), value: d?.todaySosCount ?? 0 },
  ];
});

/** 部门人员分布面板：按人数取前 5 */
const topDepartments = computed(() => departments.value.slice(0, 5));

/** 图表容器 */
const todayAlertChartEl = ref<HTMLDivElement | null>(null);
const deviceDistChartEl = ref<HTMLDivElement | null>(null);
const alertTypeChartEl = ref<HTMLDivElement | null>(null);
const deptChartEl = ref<HTMLDivElement | null>(null);

interface ChartManager {
  render(option: EChartsOption): void;
  resize(): void;
  dispose(): void;
}

function useChart(container: Ref<HTMLDivElement | null>): ChartManager {
  let chart: ECharts | null = null;
  // v-for 内的 ref 在 Vue 中可能被收集为数组，统一取最后一个元素
  const resolveEl = (): HTMLDivElement | null => {
    const value = container.value;
    return Array.isArray(value) ? (value[value.length - 1] ?? null) : value;
  };
  return {
    render(option) {
      const el = resolveEl();
      if (!el) return;
      chart ??= echarts.init(el, undefined, { renderer: 'canvas' });
      chart.setOption(option, { notMerge: false });
    },
    resize() {
      chart?.resize();
    },
    dispose() {
      chart?.dispose();
      chart = null;
    },
  };
}

const todayAlertChart = useChart(todayAlertChartEl);
const deviceDistChart = useChart(deviceDistChartEl);
const alertTypeChart = useChart(alertTypeChartEl);
const deptChart = useChart(deptChartEl);

const charts = [todayAlertChart, deviceDistChart, alertTypeChart, deptChart];

/** 图表随深浅主题切换配色 */
const chartColors = computed(() =>
  isLightTheme.value
    ? {
        text: 'rgba(23, 32, 51, 0.72)',
        muted: 'rgba(23, 32, 51, 0.45)',
        axis: 'rgba(23, 32, 51, 0.16)',
        split: 'rgba(23, 32, 51, 0.08)',
        tooltipBg: 'rgba(255, 255, 255, 0.96)',
        tooltipBorder: 'rgba(78, 101, 140, 0.18)',
        empty: 'rgba(23, 32, 51, 0.1)',
        accent: '#2563eb',
        accent2: '#7c5cff',
      }
    : {
        text: 'rgba(226, 239, 249, 0.74)',
        muted: 'rgba(226, 239, 249, 0.5)',
        axis: 'rgba(255, 255, 255, 0.14)',
        split: 'rgba(255, 255, 255, 0.06)',
        tooltipBg: 'rgba(5, 18, 33, 0.94)',
        tooltipBorder: 'rgba(105, 167, 232, 0.36)',
        empty: 'rgba(255, 255, 255, 0.07)',
        accent: '#4d8dff',
        accent2: '#7c68ff',
      },
);

function donutTooltip(c: typeof chartColors.value, formatValue?: (value: number) => string) {
  return {
    trigger: 'item' as const,
    confine: true,
    backgroundColor: c.tooltipBg,
    borderColor: c.tooltipBorder,
    textStyle: { color: c.text, fontSize: 12 },
    formatter: (params: unknown) => {
      const p = (Array.isArray(params) ? params[0] : params) as { name?: string; value?: number };
      const value = p.value ?? 0;
      return `${p.name ?? ''}<br/>${formatValue ? formatValue(value) : value}`;
    },
  };
}

/** 今日告警卡：处理状态分布环形图，中心为告警总数 */
function buildTodayAlertOption(): EChartsOption {
  const items = todayAlertItems.value;
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const hasData = total > 0;
  const c = chartColors.value;
  const levelColor: Record<string, string> = { warn: '#ffcf75', info: '#8db8ff', ok: '#43e5a0', muted: '#9aa7bd' };
  return {
    color: items.map((item) => levelColor[item.level] ?? c.empty),
    tooltip: donutTooltip(c),
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '40%',
        silent: true,
        style: { text: hasData ? String(total) : '--', fill: c.text, fontSize: 18, fontWeight: 800, align: 'center' },
      },
      {
        type: 'text',
        left: 'center',
        top: '64%',
        silent: true,
        style: { text: t('home.todayAlerts'), fill: c.muted, fontSize: 11, align: 'center' },
      },
    ],
    series: [
      {
        type: 'pie',
        radius: ['64%', '86%'],
        center: ['50%', '52%'],
        label: { show: false },
        labelLine: { show: false },
        emphasis: { disabled: true },
        animationDuration: 500,
        animationDurationUpdate: 150,
        animationEasingUpdate: 'linear',
        data: hasData
          ? items.map((item) => ({ name: item.label, value: item.value }))
          : [{ name: '', value: 1, itemStyle: { color: c.empty } }],
      },
    ],
  };
}

/** 人员设备状态分布面板：外圈为已绑定人员的设备状态，中心为人员总数 */
function buildDeviceDistOption(): EChartsOption {
  const items = personnelDeviceStatusItems.value;
  const total = dashboard.value?.totalPersonnel ?? 0;
  const hasSummary = dashboard.value !== null;
  const hasBoundDevice = items.some((item) => item.value > 0);
  const c = chartColors.value;
  const deviceDistColors = ['#43e5a0', '#9aa7bd', '#ff8585'];
  return {
    color: deviceDistColors,
    tooltip: donutTooltip(c, (value) => t('home.deviceStatusCount', { count: value })),
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '40%',
        silent: true,
        style: { text: hasSummary ? String(total) : '--', fill: c.text, fontSize: 26, fontWeight: 800, align: 'center' },
      },
      {
        type: 'text',
        left: 'center',
        top: '61%',
        silent: true,
        style: { text: t('identity.totalPersonnel'), fill: c.muted, fontSize: 12, align: 'center' },
      },
    ],
    series: [
      {
        type: 'pie',
        radius: ['58%', '80%'],
        center: ['50%', '52%'],
        label: { show: false },
        labelLine: { show: false },
        emphasis: { disabled: true },
        animationDuration: 500,
        animationDurationUpdate: 150,
        animationEasingUpdate: 'linear',
        data: hasBoundDevice
          ? items.map((item) => ({ name: item.label, value: item.value }))
          : [{ name: '', value: 1, itemStyle: { color: c.empty } }],
      },
    ],
  };
}

/** 今日告警类型分布面板：柱状图 */
function buildAlertTypeOption(): EChartsOption {
  const items = alertTypeItems.value;
  const hasData = items.some((item) => item.value > 0);
  const c = chartColors.value;
  return {
    grid: { left: 8, right: 8, top: 28, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', confine: true, backgroundColor: c.tooltipBg, borderColor: c.tooltipBorder, textStyle: { color: c.text, fontSize: 12 } },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: 'middle',
        silent: true,
        style: { text: hasData ? '' : t('dashboard.noData'), fill: c.muted, fontSize: 12, align: 'center' },
      },
    ],
    xAxis: {
      type: 'category',
      data: items.map((item) => item.label),
      axisLine: { lineStyle: { color: c.axis } },
      axisTick: { show: false },
      axisLabel: { color: c.text, fontSize: 11, interval: 0 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: c.split } },
      axisLabel: { color: c.text, fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        barWidth: '46%',
        data: items.map((item) => item.value),
        itemStyle: { color: c.accent, borderRadius: [3, 3, 0, 0] },
        label: { show: hasData, position: 'top', color: c.text, fontSize: 11 },
      },
    ],
  };
}

/** 部门人员分布面板：横向条形图 */
function buildDeptOption(): EChartsOption {
  const items = topDepartments.value;
  const hasData = items.length > 0;
  const c = chartColors.value;
  return {
    grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', confine: true, backgroundColor: c.tooltipBg, borderColor: c.tooltipBorder, textStyle: { color: c.text, fontSize: 12 } },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: 'middle',
        silent: true,
        style: { text: hasData ? '' : t('dashboard.noData'), fill: c.muted, fontSize: 12, align: 'center' },
      },
    ],
    xAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: c.split } },
      axisLabel: { color: c.text, fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: items.map((item) => item.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: c.text, fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        barWidth: '54%',
        data: items.map((item) => item.personnelCount),
        itemStyle: { color: c.accent2, borderRadius: [0, 3, 3, 0] },
        label: { show: hasData, position: 'right', color: c.text, fontSize: 11 },
      },
    ],
  };
}

function renderCharts(): void {
  todayAlertChart.render(buildTodayAlertOption());
  deviceDistChart.render(buildDeviceDistOption());
  alertTypeChart.render(buildAlertTypeOption());
  deptChart.render(buildDeptOption());
}

function resizeCharts(): void {
  charts.forEach((chart) => chart.resize());
}

interface ActivityEvent {
  id: string;
  time: string;
  content: string;
  level: 'info' | 'warn' | 'alarm';
  levelText: string;
}

const events = ref<ActivityEvent[]>([]);
const selectedEventTime = ref('');

const selectedEvent = computed(() => {
  return events.value.find((event) => event.id === selectedEventTime.value) ?? events.value[0];
});

function onEventClick(id: string): void {
  selectedEventTime.value = id;
  goTo('events', 'events');
}

async function refreshData(): Promise<void> {
  try {
    const [summary, page, system, deptPage] = await Promise.all([
      fetchDashboardSummary(),
      fetchAlertEvents({ page: 1, pageSize: 4 }),
      fetchSystemStatus(),
      fetchDepartments({ page: 1, pageSize: 100 }),
    ]);
    dashboard.value = summary;
    systemStatus.value = system;
    events.value = page.records.map((event) => ({
      id: event.eventId,
      time: formatEventTime(event.occurredAt),
      content: event.title,
      level: event.alertLevel === 'normal' ? 'info' : event.alertLevel,
      levelText:
        event.alertLevel === 'alarm'
          ? t('events.levelAlarm')
          : event.alertLevel === 'warn'
            ? t('events.levelWarn')
            : t('events.levelNormal'),
    }));
    selectedEventTime.value = events.value[0]?.id ?? '';
    departments.value = [...deptPage.records].sort((a, b) => b.personnelCount - a.personnelCount);
  } catch {
    // 首页其他模块不依赖接口数据；请求失败时保持空状态，避免展示过期模拟数据。
  }
}

let timer: ReturnType<typeof setInterval> | undefined;

watch([dashboard, departments, isLightTheme], () => renderCharts(), { flush: 'post' });

onMounted(() => {
  void refreshData();
  renderCharts();
  timer = setInterval(() => void refreshData(), 30_000);
  window.addEventListener('resize', resizeCharts);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  window.removeEventListener('resize', resizeCharts);
  charts.forEach((chart) => chart.dispose());
});

function formatEventTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
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
.dist-panel {
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

.metric-card--alert {
  min-height: 148px;
}

.metric-card.is-clickable,
.activity-panel.is-clickable {
  cursor: pointer;
}

.metric-card.is-clickable {
  transition: border-color 160ms ease, transform 160ms ease;
}

.metric-card.is-clickable:hover {
  border-color: rgba(116, 156, 255, 0.44);
  transform: translateY(-1px);
}

.activity-panel.is-clickable {
  transition: border-color 160ms ease;
}

.activity-panel.is-clickable:hover {
  border-color: rgba(116, 156, 255, 0.44);
}

.metric-card > span {
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
  line-height: 1.6;
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

.mini-metrics {
  display: grid;
  align-content: center;
  gap: 8px;
}

.mini-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
}

.mini-head {
  display: flex;
  justify-content: space-between;
  flex: 1;
  gap: 8px;
}

.mini-head em {
  font-style: normal;
  color: rgba(220, 232, 255, 0.66);
}

.mini-head b {
  font-weight: 700;
  font-size: 15px;
}

.mini-head b.ok {
  color: #43e5a0;
}

.mini-head b.warn {
  color: #ffcf75;
}

.mini-head b.danger {
  color: #ff8585;
}

.mini-head b.info {
  color: #8db8ff;
}

.mini-head b.muted {
  color: #9aa7bd;
}

.intro-panel {
  padding: 22px;
  background:
    linear-gradient(135deg, rgba(37, 51, 78, 0.84), rgba(15, 19, 30, 0.92)),
    rgba(15, 19, 30, 0.9);
}

.guide-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 20px;
}

.guide-grid .info-card {
  min-height: 0;
  padding: 14px;
}

.guide-grid .info-card h3 {
  margin: 0 0 6px;
  font-size: 15px;
}

.guide-grid .info-card p {
  max-width: none;
  font-size: 13px;
  line-height: 1.6;
}

.guide-grid .info-card > span {
  font-size: 20px;
}

.intro-panel h2,
.status-panel h3,
.info-card h3,
.activity-panel h3,
.dist-panel h3 {
  margin: 0 0 12px;
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

.status-panel,
.activity-panel,
.dist-panel,
.info-card {
  padding: 18px;
}

.chart {
  width: 100%;
  min-height: 0;
}

.chart--donut {
  height: 92px;
}

.chart--device {
  height: 150px;
}

.chart--bar,
.chart--hbar {
  height: 150px;
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

.activity-list {
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

.activity-detail {
  display: grid;
  gap: 8px;
  margin-top: 12px;
  padding: 10px;
  border: 1px solid rgba(118, 148, 212, 0.14);
  border-radius: 6px;
  background: rgba(57, 95, 178, 0.12);
}

.activity-detail span {
  color: rgba(224, 235, 255, 0.62);
  font-size: 12px;
}

.activity-detail strong {
  color: #fff;
  font-size: 13px;
}

@media (max-width: 1180px) {
  .summary-grid,
  .workbench-grid,
  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .guide-grid {
    grid-template-columns: 1fr;
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

  .activity-panel {
    grid-column: auto;
  }
}
</style>

<template>
  <section :class="['beacon-page', `beacon-page--${themeMode}`]">
    <section class="beacon-summary">
      <article v-for="item in summaryCards" :key="item.label">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small>{{ item.note }}</small>
      </article>
    </section>

    <section class="beacon-workspace">
      <section class="beacon-panel">
        <div class="beacon-panel-title">
          <div>
            <h3>信标设备台账</h3>
            <span>管理信标编号、部署区域、固件、电量和在线状态。</span>
          </div>
          <div class="beacon-actions">
            <button type="button" @click="addBeacon">新增信标</button>
            <button type="button" @click="feedbackMessage = '已进入批量导入流程'">批量导入</button>
          </div>
        </div>

        <div class="beacon-filter">
          <input v-model="keyword" placeholder="搜索信标编号、区域或协议" />
          <select v-model="statusFilter">
            <option value="all">全部状态</option>
            <option value="在线">在线</option>
            <option value="维护">维护</option>
            <option value="离线">离线</option>
          </select>
        </div>

        <div class="beacon-table">
          <div class="beacon-table-head">
            <span>信标</span>
            <span>部署区域</span>
            <span>协议</span>
            <span>电量</span>
            <span>状态</span>
            <span>操作</span>
          </div>

          <article
            v-for="beacon in filteredBeacons"
            :key="beacon.id"
            :class="{ active: selectedBeaconId === beacon.id }"
            @click="selectedBeaconId = beacon.id"
          >
            <div>
              <strong>{{ beacon.id }}</strong>
              <small>{{ beacon.model }} / {{ beacon.firmware }}</small>
            </div>
            <span>{{ beacon.area }}</span>
            <span>{{ beacon.protocol }}</span>
            <div class="battery-cell">
              <strong>{{ beacon.battery }}</strong>
              <div><span :style="{ width: beacon.battery }"></span></div>
            </div>
            <small :class="['status-pill', beacon.statusTone]">{{ beacon.status }}</small>
            <div class="row-actions">
              <button type="button" @click.stop="editBeacon(beacon.id)">编辑</button>
              <button type="button" @click.stop="calibrateBeacon(beacon.id)">校准</button>
              <button type="button" @click.stop="selectedBeaconId = beacon.id">详情</button>
            </div>
          </article>

          <div v-if="filteredBeacons.length === 0" class="empty-state">暂无匹配的信标设备</div>
        </div>
      </section>

      <aside class="beacon-detail">
        <h3>信标详情</h3>
        <div v-for="item in beaconDetailItems" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
        <button type="button" @click="feedbackMessage = `${selectedBeacon.id} 部署图已定位`">查看部署图</button>
        <small v-if="feedbackMessage" class="feedback-line">{{ feedbackMessage }}</small>
      </aside>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

defineProps<{
  themeMode: 'dark' | 'light';
}>();

const keyword = ref('');
const statusFilter = ref('all');

type BeaconStatusTone = 'online' | 'warn' | 'offline';

interface BeaconRow {
  id: string;
  model: string;
  firmware: string;
  area: string;
  protocol: string;
  battery: string;
  status: string;
  statusTone: BeaconStatusTone;
  lastCalibrated: string;
}

const beacons = reactive<BeaconRow[]>([
  { id: 'BCN-A-001', model: 'UWB Anchor X2', firmware: 'v3.2.1', area: '办公区 A', protocol: 'UWB', battery: '92%', status: '在线', statusTone: 'online', lastCalibrated: '10:12' },
  { id: 'BCN-M-012', model: 'BLE Beacon S1', firmware: 'v2.8.4', area: '会议区', protocol: 'BLE', battery: '78%', status: '在线', statusTone: 'online', lastCalibrated: '09:40' },
  { id: 'BCN-L-006', model: 'UWB Anchor X2', firmware: 'v3.1.9', area: '实验区', protocol: 'UWB', battery: '36%', status: '维护', statusTone: 'warn', lastCalibrated: '昨日 18:20' },
  { id: 'BCN-W-019', model: 'BLE Beacon S1', firmware: 'v2.7.6', area: '仓储区', protocol: 'BLE', battery: '14%', status: '离线', statusTone: 'offline', lastCalibrated: '待校准' },
]);

const selectedBeaconId = ref(beacons[0]?.id ?? '');
const feedbackMessage = ref('');

const summaryCards = [
  { label: '信标总数', value: '64', note: '覆盖 8 个区域' },
  { label: '在线信标', value: '58', note: '90.6% 在线率' },
  { label: '待维护', value: '4', note: '含低电量 2 台' },
  { label: '离线信标', value: '2', note: '需现场复核' },
];

const filteredBeacons = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();
  return beacons.filter((beacon) => {
    const statusMatched = statusFilter.value === 'all' || beacon.status === statusFilter.value;
    const keywordMatched = !normalizedKeyword
      || `${beacon.id} ${beacon.area} ${beacon.protocol}`.toLowerCase().includes(normalizedKeyword);
    return statusMatched && keywordMatched;
  });
});

const selectedBeacon = computed(() => {
  return filteredBeacons.value.find((beacon) => beacon.id === selectedBeaconId.value) ?? filteredBeacons.value[0] ?? beacons[0];
});

const beaconDetailItems = computed(() => [
  { label: '信标编号', value: selectedBeacon.value.id },
  { label: '设备型号', value: selectedBeacon.value.model },
  { label: '部署区域', value: selectedBeacon.value.area },
  { label: '协议固件', value: `${selectedBeacon.value.protocol} / ${selectedBeacon.value.firmware}` },
  { label: '最近校准', value: selectedBeacon.value.lastCalibrated },
  { label: '运行状态', value: selectedBeacon.value.status },
]);

function addBeacon() {
  const nextIndex = beacons.length + 1;
  const nextBeacon: BeaconRow = {
    id: `BCN-N-${String(nextIndex).padStart(3, '0')}`,
    model: 'BLE Beacon S1',
    firmware: 'v2.8.4',
    area: '待部署',
    protocol: 'BLE',
    battery: '100%',
    status: '维护',
    statusTone: 'warn',
    lastCalibrated: '待校准',
  };
  beacons.unshift(nextBeacon);
  selectedBeaconId.value = nextBeacon.id;
  feedbackMessage.value = `${nextBeacon.id} 已新增`;
}

function editBeacon(beaconId: string) {
  const beacon = beacons.find((item) => item.id === beaconId);
  if (!beacon) {
    return;
  }

  selectedBeaconId.value = beaconId;
  beacon.area = beacon.area === '待部署' ? '办公区 A' : '待部署';
  beacon.status = beacon.area === '待部署' ? '维护' : '在线';
  beacon.statusTone = beacon.area === '待部署' ? 'warn' : 'online';
  feedbackMessage.value = `${beacon.id} 部署区域已更新`;
}

function calibrateBeacon(beaconId: string) {
  const beacon = beacons.find((item) => item.id === beaconId);
  if (!beacon) {
    return;
  }

  selectedBeaconId.value = beaconId;
  beacon.lastCalibrated = '刚刚';
  if (beacon.statusTone === 'offline') {
    beacon.status = '维护';
    beacon.statusTone = 'warn';
  }
  feedbackMessage.value = `${beacon.id} 已完成校准`;
}
</script>

<style scoped>
.beacon-page {
  display: grid;
  gap: 14px;
}

.beacon-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.beacon-summary article,
.beacon-panel,
.beacon-detail {
  border: 1px solid rgba(118, 148, 212, 0.2);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(25, 31, 45, 0.92), rgba(13, 17, 27, 0.88));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 16px 34px rgba(0, 0, 0, 0.18);
}

.beacon-summary article {
  display: grid;
  gap: 8px;
  min-height: 108px;
  padding: 16px;
}

.beacon-summary span,
.beacon-summary small,
.beacon-panel-title span,
.beacon-table span,
.beacon-table small,
.beacon-detail span {
  color: rgba(224, 235, 255, 0.66);
  font-size: 13px;
}

.beacon-summary strong,
.beacon-panel h3,
.beacon-table strong,
.beacon-detail h3,
.beacon-detail strong {
  color: #fff;
}

.beacon-summary strong {
  font-size: 30px;
  line-height: 1;
}

.beacon-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 14px;
}

.beacon-panel {
  min-width: 0;
  overflow: hidden;
}

.beacon-panel-title,
.beacon-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(118, 148, 212, 0.12);
}

.beacon-panel-title h3,
.beacon-detail h3 {
  margin: 0 0 6px;
}

.beacon-actions,
.row-actions {
  display: flex;
  gap: 8px;
}

.beacon-actions button,
.row-actions button,
.beacon-detail button {
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(95, 137, 215, 0.36);
  border-radius: 6px;
  background: rgba(57, 95, 178, 0.28);
  color: #fff;
  cursor: pointer;
  font-weight: 700;
}

.beacon-filter {
  justify-content: flex-start;
  background: rgba(5, 9, 16, 0.22);
}

.beacon-filter input,
.beacon-filter select {
  height: 36px;
  border: 1px solid rgba(118, 148, 212, 0.16);
  border-radius: 6px;
  background: rgba(6, 10, 18, 0.36);
  color: inherit;
  padding: 0 10px;
}

.beacon-filter input {
  min-width: 260px;
}

.beacon-table {
  min-width: 900px;
  padding: 0 12px 12px;
}

.beacon-table-head,
.beacon-table article {
  display: grid;
  grid-template-columns: minmax(220px, 1.2fr) minmax(120px, 0.8fr) 80px 110px 82px 190px;
  align-items: center;
  gap: 14px;
}

.beacon-table-head {
  padding: 12px 6px;
  color: rgba(224, 235, 255, 0.46);
  font-size: 12px;
  font-weight: 800;
}

.beacon-table article {
  min-height: 78px;
  margin-bottom: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(118, 148, 212, 0.12);
  border-radius: 8px;
  background: rgba(9, 14, 24, 0.5);
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease;
}

.beacon-table article:hover,
.beacon-table article.active {
  border-color: rgba(100, 181, 246, 0.52);
  background: rgba(46, 112, 210, 0.18);
}

.battery-cell {
  display: grid;
  gap: 7px;
}

.battery-cell div {
  width: 86px;
  height: 5px;
  border-radius: 999px;
  background: rgba(118, 148, 212, 0.16);
  overflow: hidden;
}

.battery-cell span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #ffcf75, #46e39c);
}

.status-pill {
  justify-self: start;
  padding: 5px 10px;
  border-radius: 999px;
  font-weight: 800;
}

.status-pill.online {
  color: #46e39c;
  background: rgba(39, 213, 125, 0.14);
}

.status-pill.warn {
  color: #ffcf75;
  background: rgba(255, 189, 91, 0.14);
}

.status-pill.offline {
  color: #ff9a9a;
  background: rgba(255, 103, 103, 0.12);
}

.beacon-detail {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 18px;
}

.beacon-detail div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(118, 148, 212, 0.12);
}

.empty-state,
.feedback-line {
  color: rgba(224, 235, 255, 0.56);
  font-size: 13px;
}

.empty-state {
  padding: 28px 12px 34px;
  text-align: center;
}

.feedback-line {
  display: block;
  padding: 10px;
  border-radius: 6px;
  background: rgba(57, 95, 178, 0.16);
}

.beacon-page--light .beacon-summary article,
.beacon-page--light .beacon-panel,
.beacon-page--light .beacon-detail {
  border-color: rgba(78, 101, 140, 0.16);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 16px 36px rgba(38, 52, 82, 0.08);
}

.beacon-page--light .beacon-summary strong,
.beacon-page--light .beacon-panel h3,
.beacon-page--light .beacon-table strong,
.beacon-page--light .beacon-detail h3,
.beacon-page--light .beacon-detail strong {
  color: #172033;
}

.beacon-page--light .beacon-summary span,
.beacon-page--light .beacon-summary small,
.beacon-page--light .beacon-panel-title span,
.beacon-page--light .beacon-table span,
.beacon-page--light .beacon-table small,
.beacon-page--light .beacon-detail span {
  color: rgba(52, 65, 89, 0.68);
}

.beacon-page--light .beacon-filter {
  border-color: rgba(78, 101, 140, 0.1);
  background: #f8fafc;
}

.beacon-page--light .beacon-filter input,
.beacon-page--light .beacon-filter select,
.beacon-page--light .beacon-table article {
  border-color: rgba(78, 101, 140, 0.12);
  background: rgba(246, 249, 253, 0.78);
}

.beacon-page--light .beacon-filter input,
.beacon-page--light .beacon-filter select {
  color: #172033;
  background: #fff;
}

.beacon-page--light .beacon-filter input::placeholder {
  color: rgba(52, 65, 89, 0.44);
}

.beacon-page--light .beacon-filter input:focus,
.beacon-page--light .beacon-filter select:focus {
  outline: 2px solid rgba(37, 99, 235, 0.16);
  border-color: rgba(37, 99, 235, 0.38);
}

.beacon-page--light .beacon-table article:hover,
.beacon-page--light .beacon-table article.active {
  border-color: rgba(37, 99, 235, 0.34);
  background: rgba(37, 99, 235, 0.1);
}

.beacon-page--light .empty-state,
.beacon-page--light .feedback-line {
  color: rgba(52, 65, 89, 0.6);
}

.beacon-page--light .feedback-line {
  background: rgba(37, 99, 235, 0.08);
}

.beacon-page--light .beacon-actions button,
.beacon-page--light .row-actions button,
.beacon-page--light .beacon-detail button {
  border-color: rgba(62, 120, 255, 0.32);
  background: rgba(62, 120, 255, 0.1);
  color: #1d4ed8;
}

@media (max-width: 1180px) {
  .beacon-workspace {
    grid-template-columns: 1fr;
  }

  .beacon-panel {
    overflow-x: auto;
  }
}

@media (max-width: 860px) {
  .beacon-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .beacon-panel-title,
  .beacon-filter {
    flex-direction: column;
    align-items: stretch;
  }

  .beacon-filter input {
    min-width: 0;
  }
}
</style>

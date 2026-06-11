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
            <h3>{{ t('beacon.title') }}</h3>
            <span>{{ t('beacon.desc') }}</span>
          </div>
          <div class="beacon-actions">
            <button type="button" @click="addBeacon">{{ t('beacon.addBeacon') }}</button>
            <button type="button" @click="feedbackMessage = t('beacon.importPrompt')">{{ t('common.import') }}</button>
          </div>
        </div>

        <div class="beacon-filter">
          <input v-model="keyword" :placeholder="t('beacon.searchPlaceholder')" />
          <select v-model="statusFilter">
            <option value="all">{{ t('beacon.allStatus') }}</option>
            <option value="online">{{ t('beacon.online') }}</option>
            <option value="maintenance">{{ t('beacon.maintenance') }}</option>
            <option value="offline">{{ t('beacon.offline') }}</option>
          </select>
        </div>

        <div class="beacon-table">
          <div class="beacon-table-head">
            <span>{{ t('beacon.beacon') }}</span>
            <span>{{ t('beacon.deploymentArea') }}</span>
            <span>{{ t('beacon.protocol') }}</span>
            <span>{{ t('beacon.battery') }}</span>
            <span>{{ t('beacon.status') }}</span>
            <span>{{ t('beacon.action') }}</span>
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
              <button type="button" @click.stop="editBeacon(beacon.id)">{{ t('common.edit') }}</button>
              <button type="button" @click.stop="calibrateBeacon(beacon.id)">{{ t('beacon.calibrate') }}</button>
              <button type="button" @click.stop="selectedBeaconId = beacon.id">{{ t('common.detail') }}</button>
            </div>
          </article>

          <div v-if="filteredBeacons.length === 0" class="empty-state">{{ t('beacon.noMatch') }}</div>
        </div>
      </section>

      <aside class="beacon-detail">
        <h3>{{ t('beacon.beaconDetail') }}</h3>
        <div v-for="item in beaconDetailItems" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
        <button type="button" @click="feedbackMessage = t('beacon.deployMapLocated', { id: selectedBeacon.id })">{{ t('beacon.viewDeployMap') }}</button>
        <small v-if="feedbackMessage" class="feedback-line">{{ feedbackMessage }}</small>
      </aside>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineProps<{
  themeMode: 'dark' | 'light';
}>();

const keyword = ref('');
const statusFilter = ref('all');

type BeaconStatusTone = 'online' | 'warn' | 'offline';
type BeaconStatusKey = 'online' | 'maintenance' | 'offline';

interface RawBeacon {
  id: string;
  model: string;
  firmware: string;
  areaKey: string;
  protocol: string;
  battery: string;
  statusKey: BeaconStatusKey;
  statusTone: BeaconStatusTone;
  lastCalibratedKey: string;
}

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

const statusDisplayMap: Record<BeaconStatusKey, string> = {
  online: 'beacon.online',
  maintenance: 'beacon.maintenance',
  offline: 'beacon.offline',
};

const areaDisplayMap: Record<string, string> = {
  areaOffice: 'identity.areaOffice',
  areaMeeting: 'identity.areaMeeting',
  areaLab: 'identity.areaLab',
  areaWarehouse: '仓储区',
  pendingDeploy: 'beacon.pendingDeploy',
};

function translateArea(key: string): string {
  if (key === 'areaWarehouse') return '仓储区';
  if (key === 'pendingDeploy') return t('beacon.pendingDeploy');
  return t(areaDisplayMap[key] ?? key);
}

const rawBeacons = ref<RawBeacon[]>([
  { id: 'BCN-A-001', model: 'UWB Anchor X2', firmware: 'v3.2.1', areaKey: 'areaOffice', protocol: 'UWB', battery: '92%', statusKey: 'online', statusTone: 'online', lastCalibratedKey: '10:12' },
  { id: 'BCN-M-012', model: 'BLE Beacon S1', firmware: 'v2.8.4', areaKey: 'areaMeeting', protocol: 'BLE', battery: '78%', statusKey: 'online', statusTone: 'online', lastCalibratedKey: '09:40' },
  { id: 'BCN-L-006', model: 'UWB Anchor X2', firmware: 'v3.1.9', areaKey: 'areaLab', protocol: 'UWB', battery: '36%', statusKey: 'maintenance', statusTone: 'warn', lastCalibratedKey: 'yesterday' },
  { id: 'BCN-W-019', model: 'BLE Beacon S1', firmware: 'v2.7.6', areaKey: 'areaWarehouse', protocol: 'BLE', battery: '14%', statusKey: 'offline', statusTone: 'offline', lastCalibratedKey: 'pending' },
]);

const lastCalibratedDisplayMap: Record<string, string> = {
  '10:12': '10:12',
  '09:40': '09:40',
  yesterday: '昨日 18:20',
  pending: '待校准',
};

const beacons = computed<BeaconRow[]>(() =>
  rawBeacons.value.map((raw) => ({
    id: raw.id,
    model: raw.model,
    firmware: raw.firmware,
    area: translateArea(raw.areaKey),
    protocol: raw.protocol,
    battery: raw.battery,
    status: t(statusDisplayMap[raw.statusKey]),
    statusTone: raw.statusTone,
    lastCalibrated: raw.lastCalibratedKey === 'justNow' ? t('beacon.justNow') : (lastCalibratedDisplayMap[raw.lastCalibratedKey] ?? raw.lastCalibratedKey),
  })),
);

const selectedBeaconId = ref(rawBeacons.value[0]?.id ?? '');
const feedbackMessage = ref('');

const summaryCards = computed(() => [
  { label: t('beacon.totalBeacons'), value: '64', note: t('beacon.coverageAreas', { n: 8 }) },
  { label: t('beacon.onlineBeacons'), value: '58', note: t('beacon.onlineRate', { rate: '90.6' }) },
  { label: t('beacon.pendingMaintenance'), value: '4', note: t('beacon.includesLowBattery', { n: 2 }) },
  { label: t('beacon.offlineBeacons'), value: '2', note: t('beacon.needsOnsiteCheck') },
]);

const filteredBeacons = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();
  return beacons.value.filter((beacon) => {
    const statusMatched = statusFilter.value === 'all' || rawBeacons.value.find((r) => r.id === beacon.id)?.statusKey === statusFilter.value;
    const keywordMatched = !normalizedKeyword
      || `${beacon.id} ${beacon.area} ${beacon.protocol}`.toLowerCase().includes(normalizedKeyword);
    return statusMatched && keywordMatched;
  });
});

const selectedBeacon = computed(() => {
  return filteredBeacons.value.find((beacon) => beacon.id === selectedBeaconId.value) ?? filteredBeacons.value[0] ?? beacons.value[0];
});

const beaconDetailItems = computed(() => [
  { label: t('beacon.beaconId'), value: selectedBeacon.value.id },
  { label: t('beacon.deviceModel'), value: selectedBeacon.value.model },
  { label: t('beacon.deploymentArea'), value: selectedBeacon.value.area },
  { label: t('beacon.protocolFirmware'), value: `${selectedBeacon.value.protocol} / ${selectedBeacon.value.firmware}` },
  { label: t('beacon.lastCalibrated'), value: selectedBeacon.value.lastCalibrated },
  { label: t('beacon.runStatus'), value: selectedBeacon.value.status },
]);

function addBeacon() {
  const nextIndex = rawBeacons.value.length + 1;
  const nextRaw: RawBeacon = {
    id: `BCN-N-${String(nextIndex).padStart(3, '0')}`,
    model: 'BLE Beacon S1',
    firmware: 'v2.8.4',
    areaKey: 'pendingDeploy',
    protocol: 'BLE',
    battery: '100%',
    statusKey: 'maintenance',
    statusTone: 'warn',
    lastCalibratedKey: 'pending',
  };
  rawBeacons.value.unshift(nextRaw);
  selectedBeaconId.value = nextRaw.id;
  feedbackMessage.value = t('beacon.beaconAdded', { id: nextRaw.id });
}

function editBeacon(beaconId: string) {
  const raw = rawBeacons.value.find((item) => item.id === beaconId);
  if (!raw) {
    return;
  }

  selectedBeaconId.value = beaconId;
  raw.areaKey = raw.areaKey === 'pendingDeploy' ? 'areaOffice' : 'pendingDeploy';
  raw.statusKey = raw.areaKey === 'pendingDeploy' ? 'maintenance' : 'online';
  raw.statusTone = raw.areaKey === 'pendingDeploy' ? 'warn' : 'online';
  feedbackMessage.value = t('beacon.deployAreaUpdated', { id: raw.id });
}

function calibrateBeacon(beaconId: string) {
  const raw = rawBeacons.value.find((item) => item.id === beaconId);
  if (!raw) {
    return;
  }

  selectedBeaconId.value = beaconId;
  raw.lastCalibratedKey = 'justNow';
  if (raw.statusTone === 'offline') {
    raw.statusKey = 'maintenance';
    raw.statusTone = 'warn';
  }
  feedbackMessage.value = t('beacon.calibrationDone', { id: raw.id });
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

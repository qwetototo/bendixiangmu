<template>
  <section :class="['management-page', `management-page--${themeMode}`]">
    <header class="management-toolbar">
      <div>
        <h2>{{ t('nav.deviceMgmt') }}</h2>
        <p>{{ t('nav.deviceMgmtDesc') }}</p>
      </div>
      <div class="management-actions">
        <button class="primary" type="button" @click="openEditor()">{{ t('common.add') }}</button>
        <button type="button" @click="openImport">{{ t('common.import') }}</button>
        <button type="button" @click="exportOpen = true">{{ t('common.batchExport') }}</button>
      </div>
    </header>

    <section class="management-panel">
      <div class="management-panel-title">
        <div>
          <h3>{{ t('management.deviceList') }}</h3>
          <p>{{ t('management.records', { count: total }) }}</p>
        </div>
      </div>
      <div class="management-filters">
        <input v-model="keyword" class="search-input" :placeholder="t('management.searchDevice')" @keyup.enter="load" />
        <select v-model="statusFilter" @change="load">
          <option value="">{{ t('management.allStatus') }}</option>
          <option value="online">{{ t('management.online') }}</option>
          <option value="offline">{{ t('management.offline') }}</option>
          <option value="SOS">SOS</option>
        </select>
        <select v-model="bindingFilter" @change="load">
          <option value="">{{ t('management.allBinding') }}</option>
          <option value="bound">{{ t('management.bound') }}</option>
          <option value="unbound">{{ t('management.unbound') }}</option>
        </select>
        <button type="button" @click="load">{{ t('common.search') }}</button>
        <button type="button" @click="resetFilters">{{ t('common.reset') }}</button>
      </div>
      <div class="management-table-wrap">
        <table class="management-table">
          <thead>
            <tr><th>{{ t('management.deviceId') }}</th><th>{{ t('management.boundPersonId') }}</th><th>{{ t('management.battery') }}</th><th>{{ t('management.status') }}</th><th>{{ t('management.action') }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="device in devices" :key="device.deviceId">
              <td>{{ device.deviceId }}</td>
              <td>{{ device.boundPersonId || t('management.unbound') }}</td>
              <td>
                <div class="battery-value">
                  <span>{{ device.battery }}%</span>
                  <div class="battery-bar"><i :style="{ width: `${device.battery}%` }"></i></div>
                </div>
              </td>
              <td><span :class="['status-chip', device.status.toLowerCase()]">{{ statusLabel(device.status) }}</span></td>
              <td>
                <div class="row-actions">
                  <button type="button" @click="openEditor(device)">{{ t('common.edit') }}</button>
                  <button class="danger" type="button" @click="confirmDelete(device)">{{ t('common.delete') }}</button>
                </div>
              </td>
            </tr>
            <tr v-if="!loading && devices.length === 0"><td class="empty-row" colspan="5">{{ t('management.noDevices') }}</td></tr>
            <tr v-if="loading"><td class="empty-row" colspan="5">{{ t('management.loading') }}</td></tr>
          </tbody>
        </table>
      </div>
      <div v-if="feedback" class="management-feedback">{{ feedback }}</div>
    </section>

    <BaseModal :open="editorOpen" :title="editingId ? t('management.editDevice') : t('management.addDevice')" :eyebrow="t('management.deviceInfo')" :theme-mode="themeMode" @close="closeEditor">
      <div class="form-grid">
        <label>{{ t('management.deviceId') }}
          <input v-model.trim="form.deviceId" maxlength="64" :placeholder="t('management.deviceIdExample')" />
        </label>
        <label>{{ t('management.batteryPercent') }}<input v-model.number="form.battery" type="number" min="0" max="100" /></label>
        <label>{{ t('management.boundPerson') }}
          <button class="picker-button" type="button" @click="openPersonPicker">
            <span>{{ form.boundPersonId || t('management.unbound') }}</span><span>{{ t('management.select') }}</span>
          </button>
        </label>
        <label>{{ t('management.status') }}
          <select v-model="form.status">
            <option value="online">{{ t('management.online') }}</option><option value="offline">{{ t('management.offline') }}</option><option value="SOS">SOS</option>
          </select>
        </label>
      </div>
      <p v-if="formError" class="form-error">{{ formError }}</p>
      <template #footer>
        <div class="modal-actions">
          <button type="button" :disabled="saving" @click="closeEditor">{{ t('common.cancel') }}</button>
          <button class="primary" type="button" :disabled="saving" @click="save">{{ saving ? t('common.saving') : t('common.save') }}</button>
        </div>
      </template>
    </BaseModal>

    <BaseModal :open="personPickerOpen" :title="t('management.selectBoundPerson')" :eyebrow="t('management.supportSearch')" :theme-mode="themeMode" @close="personPickerOpen = false">
      <input v-model="personKeyword" class="search-input" :placeholder="t('management.searchPersonPicker')" />
      <div class="picker-list">
        <button type="button" @click="choosePerson(null)"><span>{{ t('management.unbound') }}</span><small>{{ t('management.clearPersonBinding') }}</small></button>
        <button v-for="person in filteredPeople" :key="person.personId" type="button" @click="choosePerson(person)">
          <span>{{ person.personName || person.name }} · {{ person.personId }}</span>
          <small>{{ person.departmentName || t('management.noDepartment') }}</small>
        </button>
      </div>
    </BaseModal>

    <BaseModal :open="deleteTarget !== null" :title="t('management.confirmDelete')" :eyebrow="t('management.dangerousAction')" :theme-mode="themeMode" @close="deleteTarget = null">
      <p>{{ t('management.confirmDeleteDevice', { id: deleteTarget?.deviceId }) }}</p>
      <template #footer>
        <button type="button" @click="deleteTarget = null">{{ t('common.cancel') }}</button>
        <button class="danger" type="button" :disabled="saving" @click="remove">{{ t('management.confirmDeleteAction') }}</button>
      </template>
    </BaseModal>

    <BaseModal :open="importOpen" :title="t('management.importDevices')" :eyebrow="t('management.csvFile')" :theme-mode="themeMode" @close="importOpen = false">
      <p class="import-hint">{{ t('management.deviceImportHint') }}</p>
      <input ref="fileInput" type="file" accept=".csv,text/csv" @change="importCsv" />
      <p v-if="formError" class="form-error">{{ formError }}</p>
    </BaseModal>

    <BaseModal :open="exportOpen" :title="t('management.exportDevices')" :eyebrow="t('management.csvFile')" :theme-mode="themeMode" @close="exportOpen = false">
      <div class="export-options">
        <label><input v-model="exportAll" type="radio" :value="true" /> {{ t('management.exportAll') }}</label>
        <label><input v-model="exportAll" type="radio" :value="false" /> {{ t('management.exportFirst') }} <input v-model.number="exportCount" type="number" min="1" :max="total || 1" /> {{ t('management.recordsUnit') }}</label>
      </div>
      <template #footer>
        <button type="button" @click="exportOpen = false">{{ t('common.cancel') }}</button>
        <button class="primary" type="button" @click="exportCsv">{{ t('common.batchExport') }}</button>
      </template>
    </BaseModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '@/components/BaseModal.vue';
import {
  createDevice, deleteDevice, fetchDevices, fetchPersonnel, updateDevice,
  type DeviceStatus, type DeviceVO, type PersonnelVO,
} from '@/services/adminApi';
import { assertBattery, downloadCsv, parseCsv, readCsvValue } from '@/services/csvTransfer';
import '@/styles/management.css';

defineProps<{ themeMode: 'dark' | 'light' }>();
const { t } = useI18n();

const devices = ref<DeviceVO[]>([]);
const people = ref<PersonnelVO[]>([]);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const feedback = ref('');
const keyword = ref('');
const statusFilter = ref('');
const bindingFilter = ref('');
const editorOpen = ref(false);
const personPickerOpen = ref(false);
const personKeyword = ref('');
const editingId = ref('');
const deleteTarget = ref<DeviceVO | null>(null);
const importOpen = ref(false);
const exportOpen = ref(false);
const exportAll = ref(true);
const exportCount = ref(10);
const fileInput = ref<HTMLInputElement>();
const formError = ref('');
const form = reactive({ deviceId: '', boundPersonId: null as string | null, battery: 80, status: 'offline' as DeviceStatus });

const filteredPeople = computed(() => {
  const value = personKeyword.value.trim().toLowerCase();
  return people.value.filter((person) => !value || `${person.personId} ${person.personName || person.name}`.toLowerCase().includes(value));
});

function statusLabel(status: DeviceStatus) {
  return status === 'online' ? t('management.online') : status === 'offline' ? t('management.offline') : 'SOS';
}

async function load() {
  loading.value = true;
  try {
    const page = await fetchDevices({
      page: 1, pageSize: 100, keyword: keyword.value || undefined,
      status: statusFilter.value || undefined, bindingStatus: bindingFilter.value || undefined,
    });
    devices.value = page.records;
    total.value = page.total;
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : t('management.loadDevicesFailed');
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  keyword.value = ''; statusFilter.value = ''; bindingFilter.value = ''; void load();
}

function openEditor(device?: DeviceVO) {
  editingId.value = device?.deviceId ?? '';
  form.deviceId = device?.deviceId ?? '';
  form.boundPersonId = device?.boundPersonId ?? null;
  form.battery = device?.battery ?? 80;
  form.status = device?.status ?? 'offline';
  formError.value = '';
  editorOpen.value = true;
}

function closeEditor() {
  if (!saving.value) editorOpen.value = false;
}

async function openPersonPicker() {
  personKeyword.value = '';
  personPickerOpen.value = true;
  try {
    const page = await fetchPersonnel({ page: 1, pageSize: 1000, bindingStatus: 'unbound' });
    people.value = page.records.filter((person) => person.bindingStatus === 'unbound');
  } catch (error) {
    people.value = [];
    formError.value = error instanceof Error ? error.message : t('management.loadPeopleFailed');
  }
}

function choosePerson(person: PersonnelVO | null) {
  form.boundPersonId = person?.personId ?? null;
  personPickerOpen.value = false;
}

async function save() {
  formError.value = '';
  try {
    if (!form.deviceId) throw new Error(t('management.deviceIdRequired'));
    if (!editingId.value && devices.value.some((item) => item.deviceId.toLowerCase() === form.deviceId.toLowerCase())) {
      throw new Error(t('management.deviceIdExists'));
    }
    const payload = { ...form, battery: assertBattery(form.battery, t('management.batteryInvalid')) };
    saving.value = true;
    const previousStatus = devices.value.find((item) => item.deviceId === editingId.value)?.status;
    const result = editingId.value ? await updateDevice(editingId.value, payload) : await createDevice(payload);
    window.dispatchEvent(new CustomEvent('twintrack:device-status', {
      detail: { device: result, previousStatus },
    }));
    editorOpen.value = false;
    feedback.value = editingId.value ? t('management.deviceUpdated') : t('management.deviceAdded');
    // 新增成功后清空筛选，保证新设备在完整列表中立即可见
    if (!editingId.value) { keyword.value = ''; statusFilter.value = ''; bindingFilter.value = ''; }
    await load();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : t('management.saveFailed');
  } finally {
    saving.value = false;
  }
}

function confirmDelete(device: DeviceVO) {
  deleteTarget.value = device;
}

async function remove() {
  if (!deleteTarget.value) return;
  saving.value = true;
  try {
    await deleteDevice(deleteTarget.value.deviceId);
    feedback.value = t('management.deviceDeleted');
    deleteTarget.value = null;
    await load();
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : t('management.deleteFailed');
  } finally {
    saving.value = false;
  }
}

function openImport() {
  formError.value = '';
  importOpen.value = true;
  if (fileInput.value) fileInput.value.value = '';
}

function parseStatus(value: string): DeviceStatus {
  const normalized = value.trim().toLowerCase();
  if (normalized === '在线' || normalized === 'online') return 'online';
  if (normalized === '离线' || normalized === 'offline' || !normalized) return 'offline';
  if (normalized === 'sos') return 'SOS';
  throw new Error(t('management.unsupportedDeviceStatus', { status: value }));
}

async function importCsv(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  formError.value = '';
  try {
    const rows = parseCsv(await file.text());
    if (!rows.length) throw new Error(t('management.emptyCsv'));
    const seen = new Set<string>();
    const payloads = rows.map((row, index) => {
      const deviceId = readCsvValue(row, '设备编号', '定位设备编号', 'Device ID', 'deviceId', 'MAC地址', 'MAC Address', 'mac');
      if (!deviceId) throw new Error(t('management.rowDeviceIdRequired', { row: index + 2 }));
      const key = deviceId.toLowerCase();
      if (seen.has(key)) throw new Error(t('management.rowDeviceDuplicate', { row: index + 2 }));
      seen.add(key);
      return {
        deviceId,
        boundPersonId: readCsvValue(row, '绑定人编号', 'Bound Person ID', 'personId', 'boundPersonId') || null,
        battery: assertBattery(readCsvValue(row, '电量', 'Battery', 'battery') || 80, t('management.batteryInvalid')),
        status: parseStatus(readCsvValue(row, '状态', 'Status', 'status')),
      };
    });
    await Promise.all(payloads.map(createDevice));
    importOpen.value = false;
    feedback.value = t('management.importedDevices', { count: payloads.length });
    // 批量导入成功后清空筛选，保证导入的新设备立即可见
    keyword.value = ''; statusFilter.value = ''; bindingFilter.value = '';
    await load();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : t('management.importFailed');
  }
}

async function exportCsv() {
  try {
    const limit = exportAll.value ? Math.max(total.value, 1) : Math.max(1, exportCount.value);
    const page = await fetchDevices({ page: 1, pageSize: limit });
    const rows = exportAll.value ? page.records : page.records.slice(0, limit);
    downloadCsv(t('management.deviceCsvFilename'), [t('management.deviceId'), t('management.boundPersonId'), t('management.battery'), t('management.status')], rows.map((item) => [
      item.deviceId, item.boundPersonId ?? '', item.battery, item.status,
    ]));
    exportOpen.value = false;
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : t('management.exportFailed');
  }
}

onMounted(load);
</script>

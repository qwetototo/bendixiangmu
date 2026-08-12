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

    <BaseModal :open="editorOpen" :title="editingId ? '编辑定位设备' : '新增定位设备'" eyebrow="设备信息" @close="closeEditor">
      <div class="form-grid">
        <label>设备编号
          <input v-model.trim="form.deviceId" maxlength="64" placeholder="例如 860000000000022" />
        </label>
        <label>电量（%）<input v-model.number="form.battery" type="number" min="0" max="100" /></label>
        <label>绑定人编号
          <button class="picker-button" type="button" @click="openPersonPicker">
            <span>{{ form.boundPersonId || '未绑定' }}</span><span>选择 ›</span>
          </button>
        </label>
        <label>状态
          <select v-model="form.status">
            <option value="online">在线</option><option value="offline">离线</option><option value="SOS">SOS</option>
          </select>
        </label>
      </div>
      <p v-if="formError" class="form-error">{{ formError }}</p>
      <template #footer>
        <div class="modal-actions">
          <button type="button" :disabled="saving" @click="closeEditor">取消</button>
          <button class="primary" type="button" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </template>
    </BaseModal>

    <BaseModal :open="personPickerOpen" title="选择绑定人员" eyebrow="支持搜索" @close="personPickerOpen = false">
      <input v-model="personKeyword" class="search-input" placeholder="搜索编号或姓名" />
      <div class="picker-list">
        <button type="button" @click="choosePerson(null)"><span>未绑定</span><small>清空人员绑定</small></button>
        <button v-for="person in filteredPeople" :key="person.personId" type="button" @click="choosePerson(person)">
          <span>{{ person.personName || person.name }} · {{ person.personId }}</span>
          <small>{{ person.departmentName || '无部门' }}</small>
        </button>
      </div>
    </BaseModal>

    <BaseModal :open="deleteTarget !== null" title="确认删除" eyebrow="危险操作" @close="deleteTarget = null">
      <p>确认删除定位设备“{{ deleteTarget?.deviceId }}”吗？删除后无法恢复。</p>
      <template #footer>
        <button type="button" @click="deleteTarget = null">取消</button>
        <button class="danger" type="button" :disabled="saving" @click="remove">确认删除</button>
      </template>
    </BaseModal>

    <BaseModal :open="importOpen" title="批量导入设备" eyebrow="CSV 文件" @close="importOpen = false">
      <p class="import-hint">表头支持：设备编号、绑定人编号、电量、状态。设备编号只要求唯一，可使用 MAC、IMEI、序列号或自定义编号；旧“MAC地址”表头仍兼容。</p>
      <input ref="fileInput" type="file" accept=".csv,text/csv" @change="importCsv" />
      <p v-if="formError" class="form-error">{{ formError }}</p>
    </BaseModal>

    <BaseModal :open="exportOpen" title="导出设备" eyebrow="CSV 文件" @close="exportOpen = false">
      <div class="export-options">
        <label><input v-model="exportAll" type="radio" :value="true" /> 导出所有数据</label>
        <label><input v-model="exportAll" type="radio" :value="false" /> 导出前 <input v-model.number="exportCount" type="number" min="1" :max="total || 1" /> 条</label>
      </div>
      <template #footer>
        <button type="button" @click="exportOpen = false">取消</button>
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
  return status === 'online' ? '在线' : status === 'offline' ? '离线' : 'SOS';
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
    feedback.value = error instanceof Error ? error.message : '加载设备失败';
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
    formError.value = error instanceof Error ? error.message : '加载人员失败';
  }
}

function choosePerson(person: PersonnelVO | null) {
  form.boundPersonId = person?.personId ?? null;
  personPickerOpen.value = false;
}

async function save() {
  formError.value = '';
  try {
    if (!form.deviceId) throw new Error('设备编号不能为空');
    if (!editingId.value && devices.value.some((item) => item.deviceId.toLowerCase() === form.deviceId.toLowerCase())) {
      throw new Error('设备编号已存在');
    }
    const payload = { ...form, battery: assertBattery(form.battery) };
    saving.value = true;
    const previousStatus = devices.value.find((item) => item.deviceId === editingId.value)?.status;
    const result = editingId.value ? await updateDevice(editingId.value, payload) : await createDevice(payload);
    window.dispatchEvent(new CustomEvent('twintrack:device-status', {
      detail: { device: result, previousStatus },
    }));
    editorOpen.value = false;
    feedback.value = editingId.value ? '设备已更新' : '设备已新增';
    // 新增成功后清空筛选，保证新设备在完整列表中立即可见
    if (!editingId.value) { keyword.value = ''; statusFilter.value = ''; bindingFilter.value = ''; }
    await load();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '保存失败';
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
    feedback.value = '设备已删除';
    deleteTarget.value = null;
    await load();
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : '删除失败';
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
  throw new Error(`不支持的设备状态：${value}`);
}

async function importCsv(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  formError.value = '';
  try {
    const rows = parseCsv(await file.text());
    if (!rows.length) throw new Error('CSV 文件没有可导入的数据');
    const seen = new Set<string>();
    const payloads = rows.map((row, index) => {
      const deviceId = readCsvValue(row, '设备编号', '定位设备编号', 'deviceId', 'MAC地址', 'mac');
      if (!deviceId) throw new Error(`第 ${index + 2} 行设备编号不能为空`);
      const key = deviceId.toLowerCase();
      if (seen.has(key)) throw new Error(`第 ${index + 2} 行设备编号重复`);
      seen.add(key);
      return {
        deviceId,
        boundPersonId: readCsvValue(row, '绑定人编号', 'personId', 'boundPersonId') || null,
        battery: assertBattery(readCsvValue(row, '电量', 'battery') || 80),
        status: parseStatus(readCsvValue(row, '状态', 'status')),
      };
    });
    await Promise.all(payloads.map(createDevice));
    importOpen.value = false;
    feedback.value = `成功导入 ${payloads.length} 条设备记录`;
    // 批量导入成功后清空筛选，保证导入的新设备立即可见
    keyword.value = ''; statusFilter.value = ''; bindingFilter.value = '';
    await load();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '导入失败';
  }
}

async function exportCsv() {
  try {
    const limit = exportAll.value ? Math.max(total.value, 1) : Math.max(1, exportCount.value);
    const page = await fetchDevices({ page: 1, pageSize: limit });
    const rows = exportAll.value ? page.records : page.records.slice(0, limit);
    downloadCsv('定位设备.csv', ['设备编号', '绑定人编号', '电量', '状态'], rows.map((item) => [
      item.deviceId, item.boundPersonId ?? '', item.battery, item.status,
    ]));
    exportOpen.value = false;
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : '导出失败';
  }
}

onMounted(load);
</script>

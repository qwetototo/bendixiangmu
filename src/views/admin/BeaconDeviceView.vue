<template>
  <section :class="['management-page', `management-page--${themeMode}`]">
    <header class="management-toolbar">
      <div>
        <h2>{{ t('nav.beaconMgmt') }}</h2>
        <p>{{ t('nav.beaconMgmtDesc') }}</p>
      </div>
      <div class="management-actions">
        <button class="primary" type="button" @click="openEditor()">{{ t('common.add') }}</button>
        <button type="button" @click="openImport">{{ t('common.import') }}</button>
        <button type="button" @click="exportOpen = true">{{ t('common.batchExport') }}</button>
      </div>
    </header>

    <section class="management-panel">
      <div class="management-panel-title"><div><h3>{{ t('management.beaconList') }}</h3><p>{{ t('management.records', { count: total }) }}</p></div></div>
      <div class="management-filters">
        <input v-model="keyword" class="search-input" :placeholder="t('management.searchBeacon')" @keyup.enter="load" />
        <input v-model="statusFilter" :placeholder="t('management.filterStatus')" @keyup.enter="load" />
        <button type="button" @click="load">{{ t('common.search') }}</button>
        <button type="button" @click="resetFilters">{{ t('common.reset') }}</button>
      </div>
      <div class="management-table-wrap">
        <table class="management-table">
          <thead><tr><th>{{ t('management.beaconId') }}</th><th>{{ t('management.coordinate') }}</th><th>{{ t('management.battery') }}</th><th>{{ t('management.status') }}</th><th>{{ t('management.action') }}</th></tr></thead>
          <tbody>
            <tr v-for="beacon in beacons" :key="beacon.beaconId">
              <td>{{ beacon.beaconId }}</td>
              <td>{{ formatCoordinate(beacon) }}</td>
              <td>
                <div class="battery-value">
                  <span>{{ beacon.battery }}%</span>
                  <div class="battery-bar"><i :style="{ width: `${beacon.battery}%` }"></i></div>
                </div>
              </td>
              <td>{{ beacon.status || t('management.notSet') }}</td>
              <td><div class="row-actions">
                <button type="button" @click="openEditor(beacon)">{{ t('common.edit') }}</button>
                <button class="danger" type="button" @click="deleteTarget = beacon">{{ t('common.delete') }}</button>
              </div></td>
            </tr>
            <tr v-if="!loading && beacons.length === 0"><td class="empty-row" colspan="5">{{ t('management.noBeacons') }}</td></tr>
            <tr v-if="loading"><td class="empty-row" colspan="5">{{ t('management.loading') }}</td></tr>
          </tbody>
        </table>
      </div>
      <div v-if="feedback" class="management-feedback">{{ feedback }}</div>
    </section>

    <BaseModal :open="editorOpen" :title="editingId ? '编辑信标' : '新增信标'" eyebrow="信标信息" @close="closeEditor">
      <div class="form-grid">
        <label>信标编号<input v-model.trim="form.beaconId" maxlength="64" placeholder="例如 BEACON-001" /></label>
        <label>状态<input v-model.trim="form.status" maxlength="10" placeholder="最多 10 个字符" /></label>
        <label>X 坐标<input v-model.number="form.x" type="number" step="any" /></label>
        <label>Y 坐标<input v-model.number="form.y" type="number" step="any" /></label>
        <label>Z 坐标<input v-model.number="form.z" type="number" step="any" /></label>
        <label>电量（%）<input v-model.number="form.battery" type="number" min="0" max="100" /></label>
      </div>
      <p v-if="formError" class="form-error">{{ formError }}</p>
      <template #footer>
        <button type="button" :disabled="saving" @click="closeEditor">取消</button>
        <button class="primary" type="button" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
      </template>
    </BaseModal>

    <BaseModal :open="deleteTarget !== null" title="确认删除" eyebrow="危险操作" @close="deleteTarget = null">
      <p>确认删除信标“{{ deleteTarget?.beaconId }}”吗？删除后无法恢复。</p>
      <template #footer>
        <button type="button" @click="deleteTarget = null">取消</button>
        <button class="danger" type="button" :disabled="saving" @click="remove">确认删除</button>
      </template>
    </BaseModal>

    <BaseModal :open="importOpen" title="批量导入信标" eyebrow="CSV 文件" @close="importOpen = false">
      <p class="import-hint">表头支持：信标编号、X坐标、Y坐标、Z坐标、电量、状态。编号只要求唯一且不限定格式；旧“MAC地址”表头仍兼容。</p>
      <input ref="fileInput" type="file" accept=".csv,text/csv" @change="importCsv" />
      <p v-if="formError" class="form-error">{{ formError }}</p>
    </BaseModal>

    <BaseModal :open="exportOpen" title="导出信标" eyebrow="CSV 文件" @close="exportOpen = false">
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
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '@/components/BaseModal.vue';
import { createBeacon, deleteBeacon, fetchBeacons, updateBeacon, type BeaconVO } from '@/services/adminApi';
import { assertBattery, assertFiniteNumber, downloadCsv, parseCsv, readCsvValue } from '@/services/csvTransfer';
import '@/styles/management.css';

defineProps<{ themeMode: 'dark' | 'light' }>();
const { t } = useI18n();

const beacons = ref<BeaconVO[]>([]);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const feedback = ref('');
const keyword = ref('');
const statusFilter = ref('');
const editorOpen = ref(false);
const editingId = ref('');
const deleteTarget = ref<BeaconVO | null>(null);
const importOpen = ref(false);
const exportOpen = ref(false);
const exportAll = ref(true);
const exportCount = ref(10);
const fileInput = ref<HTMLInputElement>();
const formError = ref('');
const form = reactive({ beaconId: '', x: 0, y: 0, z: 0, battery: 80, status: 'offline' });

function formatCoordinate(beacon: BeaconVO) {
  return `(${beacon.x}, ${beacon.y}, ${beacon.z})`;
}

async function load() {
  loading.value = true;
  try {
    const page = await fetchBeacons({ page: 1, pageSize: 100, keyword: keyword.value || undefined, status: statusFilter.value || undefined });
    beacons.value = page.records;
    total.value = page.total;
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : '加载信标失败';
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  keyword.value = ''; statusFilter.value = ''; void load();
}

function openEditor(beacon?: BeaconVO) {
  editingId.value = beacon?.beaconId ?? '';
  form.beaconId = beacon?.beaconId ?? '';
  form.x = beacon?.x ?? 0;
  form.y = beacon?.y ?? 0;
  form.z = beacon?.z ?? 0;
  form.battery = beacon?.battery ?? 80;
  form.status = beacon?.status ?? 'offline';
  formError.value = '';
  editorOpen.value = true;
}

function closeEditor() {
  if (!saving.value) editorOpen.value = false;
}

function getPayload() {
  if (!form.beaconId) throw new Error('信标编号不能为空');
  if (form.status.length > 10) throw new Error('状态最多允许 10 个字符');
  return {
    beaconId: form.beaconId,
    x: assertFiniteNumber(form.x, 'X 坐标'),
    y: assertFiniteNumber(form.y, 'Y 坐标'),
    z: assertFiniteNumber(form.z, 'Z 坐标'),
    battery: assertBattery(form.battery),
    status: form.status || 'offline',
  };
}

async function save() {
  formError.value = '';
  try {
    const payload = getPayload();
    if (!editingId.value && beacons.value.some((item) => item.beaconId.toLowerCase() === payload.beaconId.toLowerCase())) {
      throw new Error('信标编号已存在');
    }
    saving.value = true;
    if (editingId.value) await updateBeacon(editingId.value, payload);
    else await createBeacon(payload);
    editorOpen.value = false;
    feedback.value = editingId.value ? '信标已更新' : '信标已新增';
    await load();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '保存失败';
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!deleteTarget.value) return;
  saving.value = true;
  try {
    await deleteBeacon(deleteTarget.value.beaconId);
    deleteTarget.value = null;
    feedback.value = '信标已删除';
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

async function importCsv(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  formError.value = '';
  try {
    const rows = parseCsv(await file.text());
    if (!rows.length) throw new Error('CSV 文件没有可导入的数据');
    const seen = new Set<string>();
    const payloads = rows.map((row, index) => {
      const beaconId = readCsvValue(row, '信标编号', '设备编号', 'beaconId', 'MAC地址', 'mac');
      if (!beaconId) throw new Error(`第 ${index + 2} 行信标编号不能为空`);
      if (seen.has(beaconId.toLowerCase())) throw new Error(`第 ${index + 2} 行信标编号重复`);
      seen.add(beaconId.toLowerCase());
      const status = readCsvValue(row, '状态', 'status') || 'offline';
      if (status.length > 10) throw new Error(`第 ${index + 2} 行状态超过 10 个字符`);
      return {
        beaconId,
        x: assertFiniteNumber(readCsvValue(row, 'X坐标', 'x') || 0, 'X 坐标'),
        y: assertFiniteNumber(readCsvValue(row, 'Y坐标', 'y') || 0, 'Y 坐标'),
        z: assertFiniteNumber(readCsvValue(row, 'Z坐标', 'z') || 0, 'Z 坐标'),
        battery: assertBattery(readCsvValue(row, '电量', 'battery') || 80),
        status,
      };
    });
    await Promise.all(payloads.map(createBeacon));
    importOpen.value = false;
    feedback.value = `成功导入 ${payloads.length} 条信标记录`;
    await load();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '导入失败';
  }
}

async function exportCsv() {
  try {
    const limit = exportAll.value ? Math.max(total.value, 1) : Math.max(1, exportCount.value);
    const rows = (await fetchBeacons({ page: 1, pageSize: limit })).records.slice(0, limit);
    downloadCsv('信标设备.csv', ['信标编号', 'X坐标', 'Y坐标', 'Z坐标', '电量', '状态'], rows.map((item) => [
      item.beaconId, item.x, item.y, item.z, item.battery, item.status,
    ]));
    exportOpen.value = false;
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : '导出失败';
  }
}

onMounted(load);
</script>

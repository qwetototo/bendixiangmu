<template>
  <section :class="['management-page', `management-page--${themeMode}`]">
    <header class="management-toolbar">
      <div>
        <h2>{{ t('nav.personnelMgmt') }}</h2>
        <p>{{ t('nav.personnelMgmtDesc') }}</p>
      </div>
      <div class="management-actions">
        <button class="primary" type="button" @click="openEditor()">{{ activeView === 'people' ? t('management.addPerson') : t('management.addDepartment') }}</button>
        <button type="button" @click="openImport">{{ t('common.import') }}</button>
        <button type="button" @click="exportOpen = true">{{ t('common.batchExport') }}</button>
      </div>
    </header>

    <section class="management-panel">
      <div class="management-panel-title">
        <div class="view-switch">
          <button type="button" :class="{ active: activeView === 'people' }" @click="switchView('people')">{{ t('management.personnelTable') }}</button>
          <button type="button" :class="{ active: activeView === 'departments' }" @click="switchView('departments')">{{ t('management.departmentTable') }}</button>
        </div>
        <span>{{ t('management.records', { count: total }) }}</span>
      </div>
      <div class="management-filters">
        <input v-model="keyword" class="search-input" :placeholder="activeView === 'people' ? t('management.searchPeople') : t('management.searchDepartment')" @keyup.enter="load" />
        <select v-if="activeView === 'people'" v-model="bindingFilter" @change="load">
          <option value="">{{ t('management.allStatus') }}</option>
          <option value="bound">{{ t('management.boundDevice') }}</option>
          <option value="unbound">{{ t('management.unbound') }}</option>
        </select>
        <button type="button" @click="load">{{ t('common.search') }}</button>
        <button type="button" @click="resetFilters">{{ t('common.reset') }}</button>
      </div>
      <div class="management-table-wrap">
        <table v-if="activeView === 'people'" class="management-table">
          <thead><tr><th>{{ t('management.personId') }}</th><th>{{ t('management.name') }}</th><th>{{ t('management.department') }}</th><th>{{ t('management.status') }}</th><th>{{ t('management.action') }}</th></tr></thead>
          <tbody>
            <tr v-for="person in people" :key="person.personId">
              <td>{{ person.personId }}</td>
              <td>{{ person.personName || person.name }}</td>
              <td>{{ person.departmentName || t('management.noDepartment') }}</td>
              <td><span :class="['status-chip', person.bindingStatus]">{{ person.bindingStatus === 'bound' ? t('management.boundDevice') : t('management.unbound') }}</span></td>
              <td><div class="row-actions">
                <button type="button" @click="openEditor(person)">{{ t('common.edit') }}</button>
                <button class="danger" type="button" @click="deleteTarget = person">{{ t('common.delete') }}</button>
              </div></td>
            </tr>
            <tr v-if="!loading && people.length === 0"><td class="empty-row" colspan="5">{{ t('management.noPeople') }}</td></tr>
            <tr v-if="loading"><td class="empty-row" colspan="5">{{ t('management.loading') }}</td></tr>
          </tbody>
        </table>
        <table v-else class="management-table">
          <thead><tr><th>{{ t('management.departmentId') }}</th><th>{{ t('management.departmentName') }}</th><th>{{ t('management.personnelCount') }}</th><th>{{ t('management.action') }}</th></tr></thead>
          <tbody>
            <tr v-for="department in departments" :key="department.code">
              <td>{{ department.code }}</td><td>{{ department.name }}</td><td>{{ department.personnelCount }}</td>
              <td><div class="row-actions">
                <button type="button" @click="openEditor(department)">{{ t('common.edit') }}</button>
                <button class="danger" type="button" @click="deleteTarget = department">{{ t('common.delete') }}</button>
              </div></td>
            </tr>
            <tr v-if="!loading && departments.length === 0"><td class="empty-row" colspan="4">{{ t('management.noDepartments') }}</td></tr>
            <tr v-if="loading"><td class="empty-row" colspan="4">{{ t('management.loading') }}</td></tr>
          </tbody>
        </table>
      </div>
      <div v-if="feedback" class="management-feedback">{{ feedback }}</div>
    </section>

    <BaseModal :open="editorOpen" :title="editorTitle" :eyebrow="activeView === 'people' ? t('management.personnelInfo') : t('management.departmentInfo')" :theme-mode="themeMode" @close="closeEditor">
      <div v-if="activeView === 'people'" class="form-grid">
        <label>{{ t('management.personId') }}<input v-model.trim="personForm.personId" maxlength="20" :placeholder="t('management.personIdExample')" /></label>
        <label>{{ t('management.name') }}<input v-model.trim="personForm.name" maxlength="50" :placeholder="t('management.namePlaceholder')" /></label>
        <label>{{ t('management.department') }}
          <button class="picker-button" type="button" @click="openDepartmentPicker">
            <span>{{ selectedDepartmentName }}</span><span>{{ t('management.select') }}</span>
          </button>
        </label>
        <label>{{ t('management.status') }}
          <input :value="editingPerson?.bindingStatus === 'bound' ? t('management.boundDevice') : t('management.unbound')" disabled />
        </label>
      </div>
      <div v-else class="form-grid">
        <label>{{ t('management.departmentId') }}<input v-model.trim="departmentForm.code" maxlength="20" :placeholder="t('management.departmentIdExample')" /></label>
        <label>{{ t('management.departmentName') }}<input v-model.trim="departmentForm.name" maxlength="50" :placeholder="t('management.departmentNameExample')" /></label>
        <label v-if="editingDepartment">{{ t('management.personnelCount') }}<input :value="editingDepartment.personnelCount" disabled /></label>
      </div>
      <p v-if="formError" class="form-error">{{ formError }}</p>
      <template #footer>
        <button type="button" :disabled="saving" @click="closeEditor">{{ t('common.cancel') }}</button>
        <button class="primary" type="button" :disabled="saving" @click="save">{{ saving ? t('common.saving') : t('common.save') }}</button>
      </template>
    </BaseModal>

    <BaseModal :open="departmentPickerOpen" :title="t('management.selectDepartment')" :eyebrow="t('management.supportSearch')" :theme-mode="themeMode" @close="departmentPickerOpen = false">
      <input v-model="departmentKeyword" class="search-input" :placeholder="t('management.searchDepartmentPicker')" />
      <div class="picker-list">
        <button type="button" @click="chooseDepartment(null)"><span>{{ t('management.noDepartment') }}</span><small>{{ t('management.noDepartmentSetting') }}</small></button>
        <button v-for="department in filteredDepartments" :key="department.code" type="button" @click="chooseDepartment(department)">
          <span>{{ department.name }}</span><small>{{ department.code }} · {{ department.personnelCount }} {{ t('management.peopleUnit') }}</small>
        </button>
      </div>
    </BaseModal>

    <BaseModal :open="deleteTarget !== null" :title="t('management.confirmDelete')" :eyebrow="t('management.dangerousAction')" :theme-mode="themeMode" @close="deleteTarget = null">
      <p>{{ t('management.confirmDeleteRecord', { label: deleteTargetLabel }) }}</p>
      <p v-if="activeView === 'departments'" class="import-hint">{{ t('management.deleteDepartmentHint') }}</p>
      <template #footer>
        <button type="button" @click="deleteTarget = null">{{ t('common.cancel') }}</button>
        <button class="danger" type="button" :disabled="saving" @click="remove">{{ t('management.confirmDeleteAction') }}</button>
      </template>
    </BaseModal>

    <BaseModal :open="importOpen" :title="activeView === 'people' ? t('management.importPeople') : t('management.importDepartments')" :eyebrow="t('management.csvFile')" :theme-mode="themeMode" @close="importOpen = false">
      <p class="import-hint">{{ importHint }}</p>
      <input ref="fileInput" type="file" accept=".csv,text/csv" @change="importCsv" />
      <p v-if="formError" class="form-error">{{ formError }}</p>
    </BaseModal>

    <BaseModal :open="exportOpen" :title="activeView === 'people' ? t('management.exportPeople') : t('management.exportDepartments')" :eyebrow="t('management.csvFile')" :theme-mode="themeMode" @close="exportOpen = false">
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
  createDepartment, createPersonnel, deleteDepartment, deletePersonnel, fetchDepartments, fetchPersonnel,
  updateDepartment, updatePersonnel, type DepartmentVO, type PersonnelVO,
} from '@/services/adminApi';
import { downloadCsv, parseCsv, readCsvValue } from '@/services/csvTransfer';
import '@/styles/management.css';

defineProps<{ themeMode: 'dark' | 'light' }>();
const { t } = useI18n();

type ViewMode = 'people' | 'departments';
type DeleteTarget = PersonnelVO | DepartmentVO;

const activeView = ref<ViewMode>('people');
const people = ref<PersonnelVO[]>([]);
const departments = ref<DepartmentVO[]>([]);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const keyword = ref('');
const bindingFilter = ref('');
const feedback = ref('');
const editorOpen = ref(false);
const departmentPickerOpen = ref(false);
const departmentKeyword = ref('');
const editingPerson = ref<PersonnelVO | null>(null);
const editingDepartment = ref<DepartmentVO | null>(null);
const deleteTarget = ref<DeleteTarget | null>(null);
const importOpen = ref(false);
const exportOpen = ref(false);
const exportAll = ref(true);
const exportCount = ref(10);
const fileInput = ref<HTMLInputElement>();
const formError = ref('');
const personForm = reactive({ personId: '', name: '', departmentCode: null as string | null });
const departmentForm = reactive({ code: '', name: '' });

const editorTitle = computed(() => {
  if (activeView.value === 'people') return editingPerson.value ? t('management.editPerson') : t('management.addPerson');
  return editingDepartment.value ? t('management.editDepartment') : t('management.addDepartment');
});
const selectedDepartmentName = computed(() => departments.value.find((item) => item.code === personForm.departmentCode)?.name ?? t('management.noDepartment'));
const filteredDepartments = computed(() => {
  const value = departmentKeyword.value.trim().toLowerCase();
  return departments.value.filter((item) => !value || `${item.code} ${item.name}`.toLowerCase().includes(value));
});
const deleteTargetLabel = computed(() => {
  const target = deleteTarget.value;
  if (!target) return '';
  return 'personId' in target ? `${target.personName || target.name}（${target.personId}）` : `${target.name}（${target.code}）`;
});
const importHint = computed(() => activeView.value === 'people'
  ? t('management.peopleImportHint')
  : t('management.departmentImportHint'));

async function load() {
  loading.value = true;
  try {
    if (activeView.value === 'people') {
      const page = await fetchPersonnel({ page: 1, pageSize: 100, keyword: keyword.value || undefined, bindingStatus: bindingFilter.value || undefined });
      people.value = page.records;
      total.value = page.total;
    } else {
      const page = await fetchDepartments({ page: 1, pageSize: 100, keyword: keyword.value || undefined });
      departments.value = page.records;
      total.value = page.total;
    }
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : t('management.loadDataFailed');
  } finally {
    loading.value = false;
  }
}

function switchView(view: ViewMode) {
  activeView.value = view;
  keyword.value = '';
  bindingFilter.value = '';
  feedback.value = '';
  void load();
}

function resetFilters() {
  keyword.value = ''; bindingFilter.value = ''; void load();
}

async function ensureDepartments() {
  if (departments.value.length) return;
  departments.value = (await fetchDepartments({ page: 1, pageSize: 1000 })).records;
}

function openEditor(target?: DeleteTarget) {
  formError.value = '';
  if (activeView.value === 'people') {
    const person = target as PersonnelVO | undefined;
    editingPerson.value = person ?? null;
    personForm.personId = person?.personId ?? '';
    personForm.name = person?.personName || person?.name || '';
    personForm.departmentCode = person?.departmentCode ?? null;
    void ensureDepartments().catch((error) => { formError.value = error instanceof Error ? error.message : t('management.loadDepartmentsFailed'); });
  } else {
    const department = target as DepartmentVO | undefined;
    editingDepartment.value = department ?? null;
    departmentForm.code = department?.code ?? '';
    departmentForm.name = department?.name ?? '';
  }
  editorOpen.value = true;
}

function closeEditor() {
  if (!saving.value) editorOpen.value = false;
}

async function openDepartmentPicker() {
  departmentKeyword.value = '';
  departmentPickerOpen.value = true;
  try {
    await ensureDepartments();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : t('management.loadDepartmentsFailed');
  }
}

function chooseDepartment(department: DepartmentVO | null) {
  personForm.departmentCode = department?.code ?? null;
  departmentPickerOpen.value = false;
}

async function save() {
  formError.value = '';
  saving.value = true;
  try {
    if (activeView.value === 'people') {
      if (!personForm.personId || !personForm.name) throw new Error(t('management.personRequired'));
      if (!editingPerson.value && people.value.some((item) => item.personId.toLowerCase() === personForm.personId.toLowerCase())) {
        throw new Error(t('management.personIdExists'));
      }
      const payload = { ...personForm };
      if (editingPerson.value) await updatePersonnel(editingPerson.value.personId, payload);
      else await createPersonnel(payload);
      feedback.value = editingPerson.value ? t('management.personUpdated') : t('management.personAdded');
    } else {
      if (!departmentForm.code || !departmentForm.name) throw new Error(t('management.departmentRequired'));
      if (!editingDepartment.value && departments.value.some((item) => item.code.toLowerCase() === departmentForm.code.toLowerCase())) {
        throw new Error(t('management.departmentIdExists'));
      }
      const payload = { ...departmentForm };
      if (editingDepartment.value) await updateDepartment(editingDepartment.value.code, payload);
      else await createDepartment(payload);
      feedback.value = editingDepartment.value ? t('management.departmentUpdated') : t('management.departmentAdded');
    }
    editorOpen.value = false;
    // 新增成功后清空筛选，保证新人员/新部门在完整列表中立即可见
    const creating = activeView.value === 'people' ? !editingPerson.value : !editingDepartment.value;
    if (creating) { keyword.value = ''; bindingFilter.value = ''; }
    await load();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : t('management.saveFailed');
  } finally {
    saving.value = false;
  }
}

async function remove() {
  const target = deleteTarget.value;
  if (!target) return;
  saving.value = true;
  try {
    if ('personId' in target) await deletePersonnel(target.personId);
    else await deleteDepartment(target.code);
    deleteTarget.value = null;
    feedback.value = t('management.recordDeleted');
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

async function importCsv(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  formError.value = '';
  try {
    const rows = parseCsv(await file.text());
    if (!rows.length) throw new Error(t('management.emptyCsv'));
    const seen = new Set<string>();
    if (activeView.value === 'people') {
      const payloads = rows.map((row, index) => {
        const personId = readCsvValue(row, '编号', '人员编号', 'ID', 'Person ID', 'personId');
        const name = readCsvValue(row, '姓名', 'Name', 'name');
        if (!personId || !name) throw new Error(t('management.rowPersonRequired', { row: index + 2 }));
        if (seen.has(personId.toLowerCase())) throw new Error(t('management.rowPersonDuplicate', { row: index + 2 }));
        seen.add(personId.toLowerCase());
        return { personId, name, departmentCode: readCsvValue(row, '部门编号', '部门', 'Department ID', 'Department', 'departmentCode') || null };
      });
      await Promise.all(payloads.map(createPersonnel));
      feedback.value = t('management.importedPeople', { count: payloads.length });
    } else {
      const payloads = rows.map((row, index) => {
        const code = readCsvValue(row, '部门编号', '部门编号/ID', '部门编号 / ID', 'Department ID', 'code');
        const name = readCsvValue(row, '部门名称', 'Department Name', 'name');
        if (!code || !name) throw new Error(t('management.rowDepartmentRequired', { row: index + 2 }));
        if (seen.has(code.toLowerCase())) throw new Error(t('management.rowDepartmentDuplicate', { row: index + 2 }));
        seen.add(code.toLowerCase());
        return { code, name };
      });
      await Promise.all(payloads.map(createDepartment));
      feedback.value = t('management.importedDepartments', { count: payloads.length });
    }
    importOpen.value = false;
    // 批量导入成功后清空筛选，保证导入的新记录立即可见
    keyword.value = ''; bindingFilter.value = '';
    await load();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : t('management.importFailed');
  }
}

async function exportCsv() {
  try {
    const limit = exportAll.value ? Math.max(total.value, 1) : Math.max(1, exportCount.value);
    if (activeView.value === 'people') {
      const rows = (await fetchPersonnel({ page: 1, pageSize: limit })).records.slice(0, limit);
      downloadCsv(t('management.peopleCsvFilename'), [t('management.personId'), t('management.name'), t('management.departmentId'), t('management.departmentName'), t('management.status')], rows.map((item) => [
        item.personId, item.personName || item.name, item.departmentCode ?? '', item.departmentName ?? '',
        item.bindingStatus === 'bound' ? t('management.boundDevice') : t('management.unbound'),
      ]));
    } else {
      const rows = (await fetchDepartments({ page: 1, pageSize: limit })).records.slice(0, limit);
      downloadCsv(t('management.departmentCsvFilename'), [t('management.departmentId'), t('management.departmentName'), t('management.personnelCount')], rows.map((item) => [item.code, item.name, item.personnelCount]));
    }
    exportOpen.value = false;
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : t('management.exportFailed');
  }
}

onMounted(load);
</script>

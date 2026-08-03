<template>
  <section :class="['management-page', `management-page--${themeMode}`]">
    <header class="management-toolbar">
      <div>
        <h2>人员信息管理</h2>
        <p>统一维护人员档案与部门组织信息</p>
      </div>
      <div class="management-actions">
        <button class="primary" type="button" @click="openEditor()">新增{{ activeView === 'people' ? '人员' : '部门' }}</button>
        <button type="button" @click="openImport">批量导入</button>
        <button type="button" @click="exportOpen = true">批量导出</button>
      </div>
    </header>

    <section class="management-panel">
      <div class="management-panel-title">
        <div class="view-switch">
          <button type="button" :class="{ active: activeView === 'people' }" @click="switchView('people')">人员信息表</button>
          <button type="button" :class="{ active: activeView === 'departments' }" @click="switchView('departments')">部门信息表</button>
        </div>
        <span>共 {{ total }} 条记录</span>
      </div>
      <div class="management-filters">
        <input v-model="keyword" class="search-input" :placeholder="activeView === 'people' ? '搜索编号、姓名或部门' : '搜索部门编号或名称'" @keyup.enter="load" />
        <select v-if="activeView === 'people'" v-model="bindingFilter" @change="load">
          <option value="">全部状态</option>
          <option value="bound">已绑定设备</option>
          <option value="unbound">未绑定</option>
        </select>
        <button type="button" @click="load">查询</button>
        <button type="button" @click="resetFilters">重置</button>
      </div>
      <div class="management-table-wrap">
        <table v-if="activeView === 'people'" class="management-table">
          <thead><tr><th>编号</th><th>姓名</th><th>部门</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="person in people" :key="person.personId">
              <td>{{ person.personId }}</td>
              <td>{{ person.personName || person.name }}</td>
              <td>{{ person.departmentName || '无' }}</td>
              <td><span :class="['status-chip', person.bindingStatus]">{{ person.bindingStatus === 'bound' ? '已绑定设备' : '未绑定' }}</span></td>
              <td><div class="row-actions">
                <button type="button" @click="openEditor(person)">编辑</button>
                <button class="danger" type="button" @click="deleteTarget = person">删除</button>
              </div></td>
            </tr>
            <tr v-if="!loading && people.length === 0"><td class="empty-row" colspan="5">暂无符合条件的人员</td></tr>
            <tr v-if="loading"><td class="empty-row" colspan="5">正在加载…</td></tr>
          </tbody>
        </table>
        <table v-else class="management-table">
          <thead><tr><th>部门编号 / ID</th><th>部门名称</th><th>部门人数</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="department in departments" :key="department.code">
              <td>{{ department.code }}</td><td>{{ department.name }}</td><td>{{ department.personnelCount }}</td>
              <td><div class="row-actions">
                <button type="button" @click="openEditor(department)">编辑</button>
                <button class="danger" type="button" @click="deleteTarget = department">删除</button>
              </div></td>
            </tr>
            <tr v-if="!loading && departments.length === 0"><td class="empty-row" colspan="4">暂无符合条件的部门</td></tr>
            <tr v-if="loading"><td class="empty-row" colspan="4">正在加载…</td></tr>
          </tbody>
        </table>
      </div>
      <div v-if="feedback" class="management-feedback">{{ feedback }}</div>
    </section>

    <BaseModal :open="editorOpen" :title="editorTitle" :eyebrow="activeView === 'people' ? '人员信息' : '部门信息'" @close="closeEditor">
      <div v-if="activeView === 'people'" class="form-grid">
        <label>人员编号<input v-model.trim="personForm.personId" maxlength="20" placeholder="例如 P-001" /></label>
        <label>姓名<input v-model.trim="personForm.name" maxlength="50" placeholder="请输入姓名" /></label>
        <label>部门
          <button class="picker-button" type="button" @click="openDepartmentPicker">
            <span>{{ selectedDepartmentName }}</span><span>选择 ›</span>
          </button>
        </label>
        <label>状态
          <input :value="editingPerson?.bindingStatus === 'bound' ? '已绑定设备' : '未绑定'" disabled />
        </label>
      </div>
      <div v-else class="form-grid">
        <label>部门编号 / ID<input v-model.trim="departmentForm.code" maxlength="20" placeholder="例如 deptRD" /></label>
        <label>部门名称<input v-model.trim="departmentForm.name" maxlength="50" placeholder="例如 研发部" /></label>
        <label v-if="editingDepartment">部门人数<input :value="editingDepartment.personnelCount" disabled /></label>
      </div>
      <p v-if="formError" class="form-error">{{ formError }}</p>
      <template #footer>
        <button type="button" :disabled="saving" @click="closeEditor">取消</button>
        <button class="primary" type="button" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
      </template>
    </BaseModal>

    <BaseModal :open="departmentPickerOpen" title="选择部门" eyebrow="支持搜索" @close="departmentPickerOpen = false">
      <input v-model="departmentKeyword" class="search-input" placeholder="搜索部门编号或名称" />
      <div class="picker-list">
        <button type="button" @click="chooseDepartment(null)"><span>无</span><small>不设置部门</small></button>
        <button v-for="department in filteredDepartments" :key="department.code" type="button" @click="chooseDepartment(department)">
          <span>{{ department.name }}</span><small>{{ department.code }} · {{ department.personnelCount }} 人</small>
        </button>
      </div>
    </BaseModal>

    <BaseModal :open="deleteTarget !== null" title="确认删除" eyebrow="危险操作" @close="deleteTarget = null">
      <p>确认删除“{{ deleteTargetLabel }}”吗？删除后无法恢复。</p>
      <p v-if="activeView === 'departments'" class="import-hint">删除部门后，该部门下人员的部门字段将变为“无”。</p>
      <template #footer>
        <button type="button" @click="deleteTarget = null">取消</button>
        <button class="danger" type="button" :disabled="saving" @click="remove">确认删除</button>
      </template>
    </BaseModal>

    <BaseModal :open="importOpen" :title="`批量导入${activeView === 'people' ? '人员' : '部门'}`" eyebrow="CSV 文件" @close="importOpen = false">
      <p class="import-hint">{{ importHint }}</p>
      <input ref="fileInput" type="file" accept=".csv,text/csv" @change="importCsv" />
      <p v-if="formError" class="form-error">{{ formError }}</p>
    </BaseModal>

    <BaseModal :open="exportOpen" :title="`导出${activeView === 'people' ? '人员' : '部门'}`" eyebrow="CSV 文件" @close="exportOpen = false">
      <div class="export-options">
        <label><input v-model="exportAll" type="radio" :value="true" /> 导出所有数据</label>
        <label><input v-model="exportAll" type="radio" :value="false" /> 导出前 <input v-model.number="exportCount" type="number" min="1" :max="total || 1" /> 条</label>
      </div>
      <template #footer>
        <button type="button" @click="exportOpen = false">取消</button>
        <button class="primary" type="button" @click="exportCsv">导出</button>
      </template>
    </BaseModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import BaseModal from '@/components/BaseModal.vue';
import {
  createDepartment, createPersonnel, deleteDepartment, deletePersonnel, fetchDepartments, fetchPersonnel,
  updateDepartment, updatePersonnel, type DepartmentVO, type PersonnelVO,
} from '@/services/adminApi';
import { downloadCsv, parseCsv, readCsvValue } from '@/services/csvTransfer';
import '@/styles/management.css';

defineProps<{ themeMode: 'dark' | 'light' }>();

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
  if (activeView.value === 'people') return editingPerson.value ? '编辑人员' : '新增人员';
  return editingDepartment.value ? '编辑部门' : '新增部门';
});
const selectedDepartmentName = computed(() => departments.value.find((item) => item.code === personForm.departmentCode)?.name ?? '无');
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
  ? '表头支持：编号、姓名、部门编号。部门编号允许留空，状态由设备绑定关系自动计算，无需导入。'
  : '表头支持：部门编号、部门名称。部门人数由人员关系自动统计，无需导入。');

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
    feedback.value = error instanceof Error ? error.message : '加载数据失败';
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
    void ensureDepartments().catch((error) => { formError.value = error instanceof Error ? error.message : '加载部门失败'; });
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
    formError.value = error instanceof Error ? error.message : '加载部门失败';
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
      if (!personForm.personId || !personForm.name) throw new Error('人员编号和姓名不能为空');
      if (!editingPerson.value && people.value.some((item) => item.personId.toLowerCase() === personForm.personId.toLowerCase())) {
        throw new Error('人员编号已存在');
      }
      const payload = { ...personForm };
      if (editingPerson.value) await updatePersonnel(editingPerson.value.personId, payload);
      else await createPersonnel(payload);
      feedback.value = editingPerson.value ? '人员信息已更新' : '人员已新增';
    } else {
      if (!departmentForm.code || !departmentForm.name) throw new Error('部门编号和部门名称不能为空');
      if (!editingDepartment.value && departments.value.some((item) => item.code.toLowerCase() === departmentForm.code.toLowerCase())) {
        throw new Error('部门编号已存在');
      }
      const payload = { ...departmentForm };
      if (editingDepartment.value) await updateDepartment(editingDepartment.value.code, payload);
      else await createDepartment(payload);
      feedback.value = editingDepartment.value ? '部门信息已更新' : '部门已新增';
    }
    editorOpen.value = false;
    await load();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '保存失败';
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
    feedback.value = '记录已删除';
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
    if (activeView.value === 'people') {
      const payloads = rows.map((row, index) => {
        const personId = readCsvValue(row, '编号', '人员编号', 'personId');
        const name = readCsvValue(row, '姓名', 'name');
        if (!personId || !name) throw new Error(`第 ${index + 2} 行编号和姓名不能为空`);
        if (seen.has(personId.toLowerCase())) throw new Error(`第 ${index + 2} 行人员编号重复`);
        seen.add(personId.toLowerCase());
        return { personId, name, departmentCode: readCsvValue(row, '部门编号', '部门', 'departmentCode') || null };
      });
      await Promise.all(payloads.map(createPersonnel));
      feedback.value = `成功导入 ${payloads.length} 条人员记录`;
    } else {
      const payloads = rows.map((row, index) => {
        const code = readCsvValue(row, '部门编号', '部门编号/ID', 'code');
        const name = readCsvValue(row, '部门名称', 'name');
        if (!code || !name) throw new Error(`第 ${index + 2} 行部门编号和名称不能为空`);
        if (seen.has(code.toLowerCase())) throw new Error(`第 ${index + 2} 行部门编号重复`);
        seen.add(code.toLowerCase());
        return { code, name };
      });
      await Promise.all(payloads.map(createDepartment));
      feedback.value = `成功导入 ${payloads.length} 条部门记录`;
    }
    importOpen.value = false;
    await load();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '导入失败';
  }
}

async function exportCsv() {
  try {
    const limit = exportAll.value ? Math.max(total.value, 1) : Math.max(1, exportCount.value);
    if (activeView.value === 'people') {
      const rows = (await fetchPersonnel({ page: 1, pageSize: limit })).records.slice(0, limit);
      downloadCsv('人员信息.csv', ['编号', '姓名', '部门编号', '部门名称', '状态'], rows.map((item) => [
        item.personId, item.personName || item.name, item.departmentCode ?? '', item.departmentName ?? '',
        item.bindingStatus === 'bound' ? '已绑定设备' : '未绑定',
      ]));
    } else {
      const rows = (await fetchDepartments({ page: 1, pageSize: limit })).records.slice(0, limit);
      downloadCsv('部门信息.csv', ['部门编号', '部门名称', '部门人数'], rows.map((item) => [item.code, item.name, item.personnelCount]));
    }
    exportOpen.value = false;
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : '导出失败';
  }
}

onMounted(load);
</script>

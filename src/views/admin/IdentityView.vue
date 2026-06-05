<template>
  <section :class="['identity-page', `identity-page--${themeMode}`]">
    <section class="identity-command">
      <div class="command-copy">
        <span class="eyebrow">人员设备中心</span>
        <h2>人员-设备绑定</h2>
        <div class="command-actions">
          <button type="button">新增绑定</button>
          <button class="secondary" type="button">批量导入</button>
        </div>
      </div>

      <div class="command-side">
        <div class="sync-card">
          <span>最近同步</span>
          <strong>10:45:18</strong>
        </div>
        
      </div>
    </section>

    <section class="summary-grid">
      <article v-for="item in summaryCards" :key="item.label" :class="['summary-card', item.tone]">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small>{{ item.note }}</small>
      </article>
    </section>

    <section class="identity-workspace">
      <section class="binding-board">
        <div class="board-header">
          <div>
            <h3>{{ panelTitle }}</h3>
            <span>{{ panelSubtitle }}</span>
          </div>
          <div class="board-actions">
            <button type="button" :class="{ active: abnormalOnly }" @click="abnormalOnly = !abnormalOnly">仅看异常</button>
            <button type="button">导出</button>
          </div>
        </div>

        <div class="filter-strip">
          <input v-model="keyword" class="search-box" placeholder="搜索姓名、设备编号、部门或区域" />
          <div class="segment-tabs">
            <button
              v-for="tab in bindingTabs"
              :key="tab.key"
              type="button"
              :class="{ active: activeFilter === tab.key }"
              @click="activeFilter = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>

        <div class="binding-table">
          <div class="table-head">
            <span>人员信息</span>
            <span>设备信息</span>
            <span>权限区域</span>
            <span>状态</span>
            <span>操作</span>
          </div>

          <article
            v-for="row in visibleBindings"
            :key="row.personId"
            :class="['binding-row', { active: selectedBindingId === row.personId }]"
            @click="selectBinding(row.personId)"
          >
            <div class="person-cell">
              <span class="avatar">{{ row.personName.slice(0, 1) }}</span>
              <div>
                <strong>{{ row.personName }}</strong>
                <small>{{ row.personId }} / {{ row.department }} / {{ row.role }}</small>
              </div>
            </div>

            <div class="device-cell">
              <strong>{{ row.deviceId || '待分配设备' }}</strong>
              <small>{{ row.deviceType }} · {{ row.protocol }} · {{ row.firmware }}</small>
              <div class="battery-track">
                <span :style="{ width: row.battery === '-' ? '0%' : row.battery }"></span>
              </div>
            </div>

            <div class="area-cell">
              <strong>{{ row.area }}</strong>
              <small>{{ row.permission }}</small>
            </div>

            <small :class="['status-pill', row.status]">{{ row.statusText }}</small>
            <button type="button" @click.stop="toggleBinding(row.personId)">{{ row.deviceId ? '换绑' : '绑定' }}</button>
          </article>

          <div v-if="visibleBindings.length === 0" class="empty-state">暂无匹配的绑定关系</div>
        </div>
      </section>

      <aside class="insight-panel">
        <div class="selected-card">
          <span class="eyebrow">当前选中</span>
          <h3>{{ featuredBinding.personName }}</h3>
          <p>{{ featuredBinding.personId }} / {{ featuredBinding.department }} / {{ featuredBinding.role }}</p>
          <div class="link-line">
            <span>人员</span>
            <strong>{{ featuredBinding.deviceId || '未绑定' }}</strong>
            <span>设备</span>
          </div>
        </div>

        <div class="field-card">
          <h4>人员表字段</h4>
          <div v-for="item in personFields" :key="item.label">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>

        <div class="field-card device-card">
          <h4>设备表字段</h4>
          <div v-for="item in deviceFields" :key="item.label">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>

        <div class="rule-card">
          <h4>绑定规则</h4>
          <ul>
            <li>人员编号只能出现在一条绑定关系中</li>
            <li>设备换绑后自动释放旧库存</li>
            <li>低电量设备进入异常筛选列表</li>
          </ul>
        </div>
      </aside>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

const props = defineProps<{
  themeMode: 'dark' | 'light';
}>();

type BindingStatus = 'online' | 'idle' | 'warn' | 'offline';
type BindingFilter = 'all' | 'bound' | 'pending';

interface BindingRow {
  personId: string;
  personName: string;
  department: string;
  role: string;
  deviceId: string;
  deviceType: string;
  protocol: string;
  battery: string;
  firmware: string;
  area: string;
  permission: string;
  status: BindingStatus;
  statusText: string;
}

const bindings = reactive<BindingRow[]>([
  {
    personId: 'P-001',
    personName: '张工',
    department: '研发部',
    role: '管理员',
    deviceId: 'TAG-10086',
    deviceType: '定位标签',
    protocol: 'UWB',
    battery: '86%',
    firmware: 'v2.4.1',
    area: '办公区 A',
    permission: '全域通行',
    status: 'online',
    statusText: '在线',
  },
  {
    personId: 'P-002',
    personName: '李工',
    department: '运维部',
    role: '操作员',
    deviceId: 'TAG-10015',
    deviceType: '腕带',
    protocol: 'UWB',
    battery: '18%',
    firmware: 'v2.3.8',
    area: '设备间',
    permission: '值班权限',
    status: 'warn',
    statusText: '低电量',
  },
  {
    personId: 'P-003',
    personName: '王工',
    department: '安全部',
    role: '审计员',
    deviceId: 'TAG-10003',
    deviceType: '定位标签',
    protocol: 'BLE',
    battery: '72%',
    firmware: 'v2.4.0',
    area: '实验区',
    permission: '重点区域',
    status: 'online',
    statusText: '在线',
  },
  {
    personId: 'P-004',
    personName: '访客 A',
    department: '临时访客',
    role: '访客',
    deviceId: 'TAG-10021',
    deviceType: '定位标签',
    protocol: 'UWB',
    battery: '61%',
    firmware: 'v2.4.1',
    area: '会议区',
    permission: '18:00 过期',
    status: 'idle',
    statusText: '临时',
  },
  {
    personId: 'P-005',
    personName: '赵工',
    department: '生产部',
    role: '普通用户',
    deviceId: '',
    deviceType: '待分配',
    protocol: '-',
    battery: '-',
    firmware: '-',
    area: '生产区',
    permission: '待授权',
    status: 'offline',
    statusText: '未绑定',
  },
]);

const bindingTabs: { key: BindingFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'bound', label: '已绑定' },
  { key: 'pending', label: '待处理' },
];

const keyword = ref('');
const activeFilter = ref<BindingFilter>('all');
const abnormalOnly = ref(false);
const selectedBindingId = ref(bindings[0]?.personId ?? '');

const summaryCards = [
  { label: '人员总数', value: '248', note: '统一入口维护', tone: 'blue' },
  { label: '已绑定', value: '214', note: '86% 覆盖率', tone: 'green' },
  { label: '待绑定', value: '34', note: '需分配设备', tone: 'amber' },
  { label: '库存设备', value: '18', note: '可立即绑定', tone: 'violet' },
];

const panelTitle = computed(() => {
  return '绑定关系台账';
});

const panelSubtitle = computed(() => {
  return '把人员与设备合并成一张前端操作表，减少重复维护。';
});

const visibleBindings = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();
  return bindings.filter((row) => {
    const keywordMatched = !normalizedKeyword
      || `${row.personId} ${row.personName} ${row.department} ${row.role} ${row.deviceId} ${row.area}`.toLowerCase().includes(normalizedKeyword);
    const tabMatched = activeFilter.value === 'all'
      || (activeFilter.value === 'bound' && Boolean(row.deviceId))
      || (activeFilter.value === 'pending' && !row.deviceId);
    const abnormalMatched = !abnormalOnly.value || row.status === 'warn' || row.status === 'offline';
    return keywordMatched && tabMatched && abnormalMatched;
  });
});

const featuredBinding = computed(() => {
  return visibleBindings.value.find((row) => row.personId === selectedBindingId.value) ?? visibleBindings.value[0] ?? bindings[0];
});

function selectBinding(personId: string) {
  selectedBindingId.value = personId;
}

function toggleBinding(personId: string) {
  const row = bindings.find((item) => item.personId === personId);
  if (!row) {
    return;
  }

  selectedBindingId.value = personId;
  if (row.deviceId) {
    row.deviceId = '';
    row.deviceType = '待分配';
    row.protocol = '-';
    row.battery = '-';
    row.firmware = '-';
    row.status = 'offline';
    row.statusText = '未绑定';
    return;
  }

  row.deviceId = `TAG-${Math.floor(10000 + Math.random() * 89999)}`;
  row.deviceType = '定位标签';
  row.protocol = 'UWB';
  row.battery = '100%';
  row.firmware = 'v2.4.1';
  row.status = 'online';
  row.statusText = '在线';
}

const personFields = computed(() => [
  { label: '人员编号', value: featuredBinding.value.personId },
  { label: '部门角色', value: `${featuredBinding.value.department} / ${featuredBinding.value.role}` },
  { label: '授权范围', value: featuredBinding.value.permission },
  { label: '常驻区域', value: featuredBinding.value.area },
]);

const deviceFields = computed(() => [
  { label: '设备编号', value: featuredBinding.value.deviceId || '未绑定' },
  { label: '类型协议', value: `${featuredBinding.value.deviceType} / ${featuredBinding.value.protocol}` },
  { label: '电量', value: featuredBinding.value.battery },
  { label: '固件版本', value: featuredBinding.value.firmware },
]);
</script>

<style scoped>
.identity-page {
  display: grid;
  gap: 16px;
}

.identity-command,
.summary-card,
.binding-board,
.insight-panel {
  border: 1px solid rgba(118, 148, 212, 0.18);
  border-radius: 8px;
  background: rgba(14, 18, 29, 0.9);
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.identity-command {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 24px;
  background:
    linear-gradient(135deg, rgba(29, 45, 68, 0.96), rgba(14, 18, 29, 0.94)),
    rgba(14, 18, 29, 0.9);
}

.command-copy {
  min-width: 0;
}

.eyebrow,
.identity-command p,
.sync-card span,
.sync-card small,
.summary-card span,
.summary-card small,
.board-header span,
.search-box,
.binding-row small,
.area-cell small,
.selected-card p,
.field-card span,
.rule-card li {
  color: rgba(224, 235, 255, 0.64);
  font-size: 13px;
}

.eyebrow {
  color: #91b8ff;
  font-weight: 800;
}

.identity-command h2,
.sync-card strong,
.summary-card strong,
.board-header h3,
.binding-row strong,
.selected-card h3,
.link-line strong,
.field-card h4,
.field-card strong,
.rule-card h4 {
  color: #fff;
}

.identity-command h2 {
  margin: 6px 0 0;
  font-size: 28px;
  letter-spacing: 0;
}

.identity-command p {
  max-width: 780px;
  margin: 9px 0 0;
  line-height: 1.75;
}

.command-side {
  display: grid;
  justify-items: end;
  gap: 12px;
  min-width: 260px;
}

.sync-card {
  display: grid;
  gap: 5px;
  width: 100%;
  padding: 13px 14px;
  border: 1px solid rgba(118, 148, 212, 0.16);
  border-radius: 8px;
  background: rgba(5, 9, 16, 0.34);
}

.sync-card strong {
  font-size: 20px;
}

.command-actions,
.board-actions,
.segment-tabs {
  display: flex;
  align-items: center;
  gap: 10px;
}

.command-actions button,
.board-actions button,
.segment-tabs button,
.binding-row button {
  height: 34px;
  padding: 0 14px;
  border: 1px solid rgba(95, 137, 215, 0.36);
  border-radius: 6px;
  background: rgba(57, 95, 178, 0.28);
  color: #fff;
  cursor: pointer;
  font-weight: 700;
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
}

.command-actions button:hover,
.board-actions button:hover,
.segment-tabs button:hover,
.binding-row button:hover {
  border-color: rgba(134, 170, 255, 0.64);
  background: rgba(70, 111, 205, 0.38);
  transform: translateY(-1px);
}

.command-actions button.secondary,
.board-actions button,
.segment-tabs button {
  background: rgba(6, 10, 18, 0.34);
  color: rgba(226, 237, 255, 0.84);
}

.segment-tabs button.active {
  border-color: rgba(100, 181, 246, 0.5);
  background: rgba(46, 112, 210, 0.34);
  color: #fff;
}

.board-actions button.active {
  border-color: rgba(100, 181, 246, 0.5);
  background: rgba(46, 112, 210, 0.34);
  color: #fff;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.summary-card {
  position: relative;
  display: grid;
  gap: 8px;
  min-height: 118px;
  padding: 16px;
  overflow: hidden;
}

.summary-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--accent);
}

.summary-card.blue {
  --accent: #70a5ff;
}

.summary-card.green {
  --accent: #46e39c;
}

.summary-card.amber {
  --accent: #ffcf75;
}

.summary-card.violet {
  --accent: #b7a4ff;
}

.summary-card strong {
  font-size: 31px;
  line-height: 1;
}

.identity-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
}

.binding-board {
  min-width: 0;
  overflow: hidden;
}

.board-header,
.filter-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
}

.board-header {
  border-bottom: 1px solid rgba(118, 148, 212, 0.12);
}

.board-header h3 {
  margin: 0 0 5px;
  font-size: 18px;
}

.filter-strip {
  border-bottom: 1px solid rgba(118, 148, 212, 0.1);
  background: rgba(5, 9, 16, 0.2);
}

.search-box {
  flex: 1;
  min-width: 220px;
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border: 1px solid rgba(118, 148, 212, 0.16);
  border-radius: 6px;
  background: rgba(6, 10, 18, 0.36);
  color: rgba(224, 235, 255, 0.84);
}

.search-box::placeholder {
  color: rgba(224, 235, 255, 0.46);
}

.binding-table {
  min-width: 820px;
  padding: 0 12px 12px;
}

.table-head,
.binding-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.2fr) minmax(210px, 1fr) minmax(150px, 0.8fr) 92px 76px;
  align-items: center;
  gap: 14px;
}

.table-head {
  padding: 12px 6px;
  color: rgba(224, 235, 255, 0.46);
  font-size: 12px;
  font-weight: 800;
}

.binding-row {
  min-height: 82px;
  margin-bottom: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(118, 148, 212, 0.12);
  border-radius: 8px;
  background: rgba(9, 14, 24, 0.5);
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
}

.binding-row:hover {
  border-color: rgba(115, 151, 235, 0.34);
  background: rgba(28, 42, 68, 0.52);
  transform: translateY(-1px);
}

.binding-row.active {
  border-color: rgba(100, 181, 246, 0.62);
  background: rgba(46, 112, 210, 0.2);
}

.empty-state {
  padding: 28px 12px 34px;
  color: rgba(224, 235, 255, 0.56);
  font-size: 13px;
  text-align: center;
}

.person-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.avatar {
  display: inline-flex;
  flex: 0 0 38px;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(74, 119, 220, 0.38), rgba(39, 213, 125, 0.16));
  color: #f5f9ff;
  font-weight: 900;
}

.person-cell strong,
.device-cell strong,
.area-cell strong {
  display: block;
  margin-bottom: 5px;
  font-size: 15px;
}

.battery-track {
  width: 108px;
  height: 5px;
  margin-top: 8px;
  border-radius: 999px;
  background: rgba(118, 148, 212, 0.16);
  overflow: hidden;
}

.battery-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #ffcf75, #46e39c);
}

.status-pill {
  justify-self: start;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
}

.status-pill.online {
  color: #46e39c;
  background: rgba(39, 213, 125, 0.14);
}

.status-pill.idle {
  color: #c4d0e4;
  background: rgba(113, 128, 160, 0.18);
}

.status-pill.warn {
  color: #ffcf75;
  background: rgba(255, 189, 91, 0.14);
}

.status-pill.offline {
  color: #ff9a9a;
  background: rgba(255, 103, 103, 0.12);
}

.insight-panel {
  display: grid;
  align-content: start;
  gap: 14px;
  padding: 16px;
}

.selected-card,
.field-card,
.rule-card {
  border: 1px solid rgba(118, 148, 212, 0.14);
  border-radius: 8px;
  background: rgba(5, 9, 16, 0.3);
}

.selected-card {
  display: grid;
  gap: 9px;
  padding: 16px;
  background:
    linear-gradient(180deg, rgba(39, 64, 102, 0.58), rgba(5, 9, 16, 0.34)),
    rgba(5, 9, 16, 0.3);
}

.selected-card h3 {
  margin: 0;
  font-size: 24px;
}

.selected-card p {
  margin: 0;
}

.link-line {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 9px 10px;
  border-radius: 6px;
  background: rgba(6, 10, 18, 0.42);
  color: rgba(224, 235, 255, 0.6);
  font-size: 12px;
  text-align: center;
}

.field-card,
.rule-card {
  display: grid;
  gap: 10px;
  padding: 14px;
}

.field-card h4,
.rule-card h4 {
  margin: 0;
  font-size: 15px;
}

.field-card div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(118, 148, 212, 0.1);
}

.field-card div:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.field-card strong {
  font-size: 13px;
  text-align: right;
}

.device-card {
  border-color: rgba(74, 119, 220, 0.26);
}

.rule-card ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rule-card li {
  position: relative;
  padding-left: 14px;
  line-height: 1.5;
}

.rule-card li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: #70a5ff;
}

.identity-page--light .identity-command,
.identity-page--light .summary-card,
.identity-page--light .binding-board,
.identity-page--light .insight-panel {
  border-color: rgba(78, 101, 140, 0.16);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 16px 36px rgba(38, 52, 82, 0.08);
}

.identity-page--light .identity-command {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(239, 244, 252, 0.94));
}

.identity-page--light .identity-command h2,
.identity-page--light .sync-card strong,
.identity-page--light .summary-card strong,
.identity-page--light .board-header h3,
.identity-page--light .binding-row strong,
.identity-page--light .selected-card h3,
.identity-page--light .link-line strong,
.identity-page--light .field-card h4,
.identity-page--light .field-card strong,
.identity-page--light .rule-card h4 {
  color: #172033;
}

.identity-page--light .identity-command p,
.identity-page--light .sync-card span,
.identity-page--light .sync-card small,
.identity-page--light .summary-card span,
.identity-page--light .summary-card small,
.identity-page--light .board-header span,
.identity-page--light .search-box,
.identity-page--light .binding-row small,
.identity-page--light .area-cell small,
.identity-page--light .selected-card p,
.identity-page--light .field-card span,
.identity-page--light .rule-card li {
  color: rgba(52, 65, 89, 0.68);
}

.identity-page--light .sync-card,
.identity-page--light .filter-strip,
.identity-page--light .search-box,
.identity-page--light .selected-card,
.identity-page--light .field-card,
.identity-page--light .rule-card,
.identity-page--light .link-line {
  border-color: rgba(78, 101, 140, 0.12);
  background: rgba(246, 249, 253, 0.8);
}

.identity-page--light .table-head {
  color: rgba(52, 65, 89, 0.58);
}

.identity-page--light .binding-row {
  border-color: rgba(78, 101, 140, 0.12);
  background: rgba(255, 255, 255, 0.76);
}

.identity-page--light .binding-row:hover {
  background: rgba(62, 120, 255, 0.07);
}

.identity-page--light .binding-row.active {
  border-color: rgba(37, 99, 235, 0.36);
  background: rgba(37, 99, 235, 0.1);
}

.identity-page--light .empty-state {
  color: rgba(52, 65, 89, 0.56);
}

.identity-page--light .field-card div {
  border-color: rgba(78, 101, 140, 0.1);
}

.identity-page--light .avatar {
  background: linear-gradient(135deg, rgba(62, 120, 255, 0.14), rgba(16, 185, 129, 0.12));
  color: #1d4ed8;
}

.identity-page--light .command-actions button,
.identity-page--light .board-actions button,
.identity-page--light .segment-tabs button,
.identity-page--light .binding-row button {
  border-color: rgba(62, 120, 255, 0.32);
  background: rgba(62, 120, 255, 0.1);
  color: #1d4ed8;
}

.identity-page--light .segment-tabs button.active {
  background: rgba(37, 99, 235, 0.14);
}

.identity-page--light .search-box {
  color: #172033;
}

.identity-page--light .search-box::placeholder {
  color: rgba(52, 65, 89, 0.44);
}

.identity-page--light .board-actions button.active {
  background: rgba(37, 99, 235, 0.14);
}

@media (max-width: 1240px) {
  .identity-workspace {
    grid-template-columns: 1fr;
  }

  .binding-board {
    overflow-x: auto;
  }
}

@media (max-width: 980px) {
  .identity-command,
  .filter-strip,
  .board-header {
    flex-direction: column;
    align-items: stretch;
  }

  .command-side {
    justify-items: stretch;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>

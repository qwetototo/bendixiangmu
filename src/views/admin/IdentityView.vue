<template>
  <section class="identity-page">
    <aside class="side-panel">
      <article v-for="item in summaryCards" :key="item.label" class="summary-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small>{{ item.note }}</small>
      </article>
    </aside>

    <section class="list-panel">
      <div class="panel-toolbar">
        <div class="search-box">搜索 {{ isDeviceView ? '设备编号、绑定人员' : '姓名、部门、角色' }}</div>
        <button type="button">{{ isDeviceView ? '新增设备' : '新增用户' }}</button>
      </div>

      <div class="table-head">
        <span>{{ isDeviceView ? '设备' : '人员' }}</span>
        <span>归属信息</span>
        <span>状态</span>
        <span>操作</span>
      </div>
      <article v-for="row in managementRows" :key="row.name" class="data-row">
        <div>
          <strong>{{ row.name }}</strong>
          <small>{{ row.sub }}</small>
        </div>
        <span>{{ row.meta }}</span>
        <small :class="row.status">{{ row.statusText }}</small>
        <button type="button">查看</button>
      </article>
    </section>

    <aside class="detail-panel">
      <h3>{{ isDeviceView ? '设备详情' : '用户详情' }}</h3>
      <div class="detail-main">
        <strong>{{ featuredItem.name }}</strong>
        <span>{{ featuredItem.meta }}</span>
      </div>
      <div class="detail-list">
        <div v-for="item in detailItems" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
      <button type="button">打开详情页</button>
    </aside>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  activeSubmenu: string;
}>();

const isDeviceView = computed(() => props.activeSubmenu === 'devices');

const summaryCards = computed(() => {
  if (isDeviceView.value) {
    return [
      { label: '设备总数', value: '156', note: '132 台在线' },
      { label: '低电量', value: '9', note: '需本日处理' },
      { label: '未绑定', value: '18', note: '库存可分配' },
      { label: '离线设备', value: '15', note: '平均离线 42 分钟' },
    ];
  }

  return [
    { label: '用户总数', value: '248', note: '今日活跃 112' },
    { label: '访客', value: '21', note: '8 人即将过期' },
    { label: '管理员', value: '12', note: '含 3 个审计账号' },
    { label: '未绑定', value: '34', note: '待分配标签' },
  ];
});

const managementRows = computed(() => {
  if (isDeviceView.value) {
    return [
      { name: 'TAG-10086', sub: '定位标签 / UWB', meta: '绑定：张工 / 办公区 / 电量 86%', status: 'online', statusText: '在线' },
      { name: 'TAG-10021', sub: '定位标签 / UWB', meta: '绑定：访客 A / 会议区 / 电量 61%', status: 'online', statusText: '在线' },
      { name: 'TAG-10042', sub: '定位标签 / BLE', meta: '未绑定 / 库存 / 电量 42%', status: 'idle', statusText: '闲置' },
      { name: 'TAG-10015', sub: '腕带 / UWB', meta: '绑定：李工 / 研发部 / 电量 18%', status: 'warn', statusText: '低电量' },
      { name: 'ANCHOR-03', sub: '基站 / PoE', meta: '三楼东侧 / 固件 1.8.2', status: 'online', statusText: '在线' },
    ];
  }

  return [
    { name: '张工', sub: '研发部 / 管理员', meta: '已绑定 TAG-10086 / 常驻办公区', status: 'online', statusText: '在线' },
    { name: '李工', sub: '运维部 / 操作员', meta: '已绑定 TAG-10015 / 值班中', status: 'warn', statusText: '低电量' },
    { name: '王工', sub: '安全部 / 审计员', meta: '已绑定 TAG-10003 / 重点区域权限', status: 'online', statusText: '在线' },
    { name: '访客 A', sub: '临时权限', meta: '已绑定 TAG-10021 / 今日 18:00 过期', status: 'idle', statusText: '临时' },
    { name: '赵工', sub: '生产部 / 普通用户', meta: '未绑定标签 / 待分配', status: 'idle', statusText: '未绑定' },
  ];
});

const featuredItem = computed(() => managementRows.value[0]);

const detailItems = computed(() => {
  if (isDeviceView.value) {
    return [
      { label: '最近上报', value: '10:42:31' },
      { label: '所属区域', value: '办公区 A' },
      { label: '固件版本', value: 'v2.4.1' },
      { label: '轨迹记录', value: '328 条' },
    ];
  }

  return [
    { label: '当前位置', value: '办公区 A' },
    { label: '今日轨迹', value: '46 条' },
    { label: '授权区域', value: '4 个' },
    { label: '最近登录', value: '09:18:06' },
  ];
});
</script>

<style scoped>
.identity-page {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 280px;
  gap: 14px;
}

.side-panel,
.list-panel,
.detail-panel {
  border: 1px solid rgba(118, 148, 212, 0.2);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(25, 31, 45, 0.92), rgba(13, 17, 27, 0.88)),
    rgba(13, 17, 27, 0.88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 16px 34px rgba(0, 0, 0, 0.18);
}

.side-panel {
  display: grid;
  gap: 10px;
  align-content: start;
  padding: 12px;
}

.summary-card {
  position: relative;
  display: grid;
  gap: 7px;
  padding: 14px;
  border: 1px solid rgba(118, 148, 212, 0.16);
  border-radius: 6px;
  background: rgba(6, 10, 18, 0.42);
  overflow: hidden;
}

.summary-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 999px;
  background: #5a8dff;
}

.summary-card span,
.summary-card small,
.data-row span,
.data-row div small,
.detail-main span,
.detail-list span {
  color: rgba(224, 235, 255, 0.62);
  font-size: 13px;
}

.summary-card strong {
  color: #fff;
  font-size: 26px;
  line-height: 1;
}

.list-panel {
  min-width: 0;
  overflow: hidden;
}

.panel-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid rgba(118, 148, 212, 0.14);
}

.search-box {
  flex: 1;
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border: 1px solid rgba(100, 130, 190, 0.2);
  border-radius: 6px;
  background: rgba(5, 9, 16, 0.5);
  color: rgba(224, 235, 255, 0.46);
  font-size: 13px;
}

.panel-toolbar button,
.data-row button,
.detail-panel button {
  height: 36px;
  border: 1px solid rgba(94, 143, 255, 0.42);
  border-radius: 6px;
  background: rgba(49, 91, 194, 0.32);
  color: #fff;
  cursor: pointer;
  font-weight: 700;
  transition: background 160ms ease, border-color 160ms ease;
}

.panel-toolbar button:hover,
.data-row button:hover,
.detail-panel button:hover {
  border-color: rgba(123, 162, 255, 0.7);
  background: rgba(67, 107, 220, 0.44);
}

.panel-toolbar button {
  padding: 0 14px;
}

.table-head,
.data-row {
  display: grid;
  grid-template-columns: minmax(130px, 1.1fr) minmax(220px, 1.6fr) 82px 72px;
  align-items: center;
  gap: 14px;
}

.table-head {
  padding: 10px 16px;
  color: rgba(224, 235, 255, 0.46);
  font-size: 12px;
  font-weight: 700;
  background: rgba(5, 9, 16, 0.34);
}

.data-row {
  min-height: 70px;
  padding: 14px 16px;
  border-top: 1px solid rgba(118, 148, 212, 0.1);
  transition: background 160ms ease;
}

.data-row:hover {
  background: rgba(74, 111, 190, 0.12);
}

.data-row strong {
  display: block;
  margin-bottom: 5px;
  color: #fff;
  font-size: 15px;
}

.data-row > small {
  justify-self: start;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 12px;
}

.data-row > small.online {
  background: rgba(39, 213, 125, 0.14);
  color: #46e39c;
}

.data-row > small.idle {
  background: rgba(113, 128, 160, 0.18);
  color: #c4d0e4;
}

.data-row > small.warn {
  background: rgba(255, 189, 91, 0.14);
  color: #ffcf75;
}

.detail-panel {
  display: grid;
  align-content: start;
  gap: 14px;
  padding: 18px;
  background:
    linear-gradient(180deg, rgba(34, 41, 61, 0.92), rgba(13, 17, 27, 0.9)),
    rgba(13, 17, 27, 0.88);
}

.detail-panel h3 {
  margin: 0;
  color: #fff;
}

.detail-main {
  display: grid;
  gap: 6px;
  padding: 14px;
  border: 1px solid rgba(118, 148, 212, 0.18);
  border-radius: 6px;
  background: rgba(6, 10, 18, 0.42);
}

.detail-main strong {
  color: #fff;
  font-size: 20px;
}

.detail-list {
  display: grid;
  gap: 10px;
}

.detail-list div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  min-height: 30px;
  padding-bottom: 9px;
  border-bottom: 1px solid rgba(118, 148, 212, 0.1);
}

.detail-list div:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.detail-list strong {
  color: rgba(238, 245, 255, 0.9);
  font-size: 13px;
  text-align: right;
}

@media (max-width: 1180px) {
  .identity-page {
    grid-template-columns: 1fr;
  }

  .side-panel {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .side-panel,
  .table-head,
  .data-row {
    grid-template-columns: 1fr;
  }
}
</style>

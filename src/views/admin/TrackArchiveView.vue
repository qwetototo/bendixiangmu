<template>
  <section class="archive-page">
    <section class="archive-hero">
      <div>
        <span>轨迹归档</span>
        <h2>历史轨迹保存与检索</h2>
        <p>按人员、设备、区域和时间范围管理归档任务，前端先补齐页面流程，后续可直接对接历史轨迹接口。</p>
      </div>
      <button type="button">新建归档任务</button>
    </section>

    <section class="archive-grid">
      <article v-for="item in archiveStats" :key="item.label" class="stat-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small>{{ item.note }}</small>
      </article>
    </section>

    <section class="archive-layout">
      <article class="job-panel">
        <div class="panel-title">
          <h3>归档任务</h3>
          <div class="filter-row">
            <button type="button">今日</button>
            <button type="button">本周</button>
            <button type="button">全部</button>
          </div>
        </div>
        <div class="job-head">
          <span>任务</span>
          <span>范围</span>
          <span>状态</span>
          <span>操作</span>
        </div>
        <div v-for="job in archiveJobs" :key="job.name" class="job-row">
          <div>
            <strong>{{ job.name }}</strong>
            <small>{{ job.time }}</small>
          </div>
          <span>{{ job.scope }}</span>
          <small :class="job.status">{{ job.statusText }}</small>
          <button type="button">{{ job.action }}</button>
        </div>
      </article>

      <aside class="query-panel">
        <h3>快速检索</h3>
        <label v-for="field in queryFields" :key="field.label">
          <span>{{ field.label }}</span>
          <input :placeholder="field.placeholder" />
        </label>
        <button type="button">检索轨迹</button>
      </aside>
    </section>
  </section>
</template>

<script setup lang="ts">
const archiveStats = [
  { label: '今日归档', value: '38', note: '自动任务 32 个' },
  { label: '可检索轨迹', value: '12,604', note: '保留 30 天' },
  { label: '异常任务', value: '2', note: '等待重试' },
  { label: '存储占用', value: '48GB', note: '本周 +6.2GB' },
];

const archiveJobs = [
  { name: '研发部全天轨迹', time: '10:45 创建', scope: '研发部 / 24 小时', status: 'done', statusText: '完成', action: '查看' },
  { name: '访客临时轨迹', time: '10:20 创建', scope: '访客 / 今日', status: 'running', statusText: '运行中', action: '进度' },
  { name: '实验区越界复核', time: '09:40 创建', scope: '实验区 / 告警人员', status: 'warn', statusText: '待重试', action: '重试' },
  { name: '低电量设备轨迹', time: '09:05 创建', scope: '设备状态 / 低电量', status: 'done', statusText: '完成', action: '导出' },
];

const queryFields = [
  { label: '人员或设备', placeholder: '姓名 / TAG 编号' },
  { label: '时间范围', placeholder: '2026-05-21 00:00 - 23:59' },
  { label: '区域', placeholder: '办公区、会议区、实验区' },
];
</script>

<style scoped>
.archive-page {
  display: grid;
  gap: 14px;
}

.archive-hero,
.stat-card,
.job-panel,
.query-panel {
  border: 1px solid rgba(118, 148, 212, 0.2);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(25, 31, 45, 0.92), rgba(13, 17, 27, 0.88)),
    rgba(13, 17, 27, 0.88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 16px 34px rgba(0, 0, 0, 0.18);
}

.archive-hero {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 22px;
  background:
    linear-gradient(135deg, rgba(93, 60, 32, 0.58), rgba(17, 24, 39, 0.92)),
    rgba(13, 17, 27, 0.9);
}

.archive-hero span,
.stat-card span,
.stat-card small,
.job-row span,
.job-row small,
.query-panel span {
  color: rgba(224, 235, 255, 0.64);
  font-size: 13px;
}

.archive-hero h2,
.job-panel h3,
.query-panel h3 {
  margin: 0;
  color: #fff;
}

.archive-hero h2 {
  margin-top: 6px;
  font-size: 24px;
}

.archive-hero p {
  max-width: 760px;
  margin: 8px 0 0;
  color: rgba(224, 235, 255, 0.72);
  line-height: 1.7;
}

.archive-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.stat-card {
  display: grid;
  gap: 8px;
  min-height: 108px;
  padding: 16px;
}

.stat-card strong {
  color: #fff;
  font-size: 30px;
  line-height: 1;
}

.archive-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
}

.job-panel,
.query-panel {
  padding: 18px;
}

.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}

.filter-row {
  display: flex;
  gap: 8px;
}

.archive-hero button,
.filter-row button,
.job-row button,
.query-panel button {
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(248, 172, 89, 0.4);
  border-radius: 6px;
  background: rgba(151, 93, 32, 0.28);
  color: #fff;
  cursor: pointer;
  font-weight: 700;
}

.archive-hero button {
  align-self: start;
}

.job-head,
.job-row {
  display: grid;
  grid-template-columns: minmax(150px, 1.1fr) minmax(160px, 1fr) 82px 72px;
  align-items: center;
  gap: 14px;
}

.job-head {
  padding: 10px 0;
  color: rgba(224, 235, 255, 0.48);
  font-size: 12px;
  font-weight: 700;
}

.job-row {
  min-height: 68px;
  border-top: 1px solid rgba(118, 148, 212, 0.1);
}

.job-row strong {
  display: block;
  margin-bottom: 5px;
  color: #fff;
}

.job-row > small {
  justify-self: start;
  padding: 4px 9px;
  border-radius: 999px;
}

.job-row > small.done {
  color: #46e39c;
  background: rgba(39, 213, 125, 0.14);
}

.job-row > small.running {
  color: #8db8ff;
  background: rgba(87, 128, 255, 0.12);
}

.job-row > small.warn {
  color: #ffcf75;
  background: rgba(255, 189, 91, 0.14);
}

.query-panel {
  display: grid;
  align-content: start;
  gap: 14px;
}

.query-panel label {
  display: grid;
  gap: 7px;
}

.query-panel input {
  height: 36px;
  padding: 0 10px;
  border: 1px solid rgba(118, 148, 212, 0.2);
  border-radius: 6px;
  background: rgba(6, 10, 18, 0.42);
  color: #fff;
}

@media (max-width: 1180px) {
  .archive-grid,
  .archive-layout {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .archive-hero,
  .panel-title {
    flex-direction: column;
    align-items: stretch;
  }

  .archive-grid,
  .archive-layout,
  .job-head,
  .job-row {
    grid-template-columns: 1fr;
  }
}
</style>

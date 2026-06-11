<template>
  <section class="archive-page">
    <section class="archive-hero">
      <div>
        <span>{{ t('archive.title') }}</span>
        <h2>{{ t('archive.desc') }}</h2>
        <p>{{ t('archive.subDesc') }}</p>
      </div>
      <button type="button">{{ t('archive.createTask') }}</button>
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
          <h3>{{ t('archive.archiveTasks') }}</h3>
          <div class="filter-row">
            <button type="button">{{ t('common.today') }}</button>
            <button type="button">{{ t('common.week') }}</button>
            <button type="button">{{ t('common.all') }}</button>
          </div>
        </div>
        <div class="job-head">
          <span>{{ t('archive.task') }}</span>
          <span>{{ t('archive.scope') }}</span>
          <span>{{ t('archive.status') }}</span>
          <span>{{ t('archive.operation') }}</span>
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
        <h3>{{ t('archive.quickSearch') }}</h3>
        <label v-for="field in queryFields" :key="field.label">
          <span>{{ field.label }}</span>
          <input :placeholder="field.placeholder" />
        </label>
        <button type="button">{{ t('archive.searchTrajectory') }}</button>
      </aside>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const archiveStats = computed(() => [
  { label: t('archive.todayArchive'), value: '38', note: t('archive.autoTaskNote', { count: 32 }) },
  { label: t('archive.searchableTrajectories'), value: '12,604', note: t('archive.retainDays', { days: 30 }) },
  { label: t('archive.abnormalTasks'), value: '2', note: t('archive.waitRetry') },
  { label: t('archive.storageUsage'), value: '48GB', note: t('archive.weeklyIncrease', { size: '6.2GB' }) },
]);

const archiveJobs = computed(() => [
  { name: '研发部全天轨迹', time: '10:45 创建', scope: '研发部 / 24 小时', status: 'done', statusText: t('archive.done'), action: t('common.view') },
  { name: '访客临时轨迹', time: '10:20 创建', scope: '访客 / 今日', status: 'running', statusText: t('archive.running'), action: t('common.progress') },
  { name: '实验区越界复核', time: '09:40 创建', scope: '实验区 / 告警人员', status: 'warn', statusText: t('archive.pendingRetry'), action: t('common.retry') },
  { name: '低电量设备轨迹', time: '09:05 创建', scope: '设备状态 / 低电量', status: 'done', statusText: t('archive.done'), action: t('common.export') },
]);

const queryFields = computed(() => [
  { label: t('archive.personOrDevice'), placeholder: t('archive.searchPersonPlaceholder') },
  { label: t('archive.timeRange'), placeholder: t('archive.timeRangePlaceholder') },
  { label: t('archive.area'), placeholder: t('archive.areaPlaceholder') },
]);
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

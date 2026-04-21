<template>
  <aside class="sidebar">
    <div class="sidebar__brand">
      <p class="sidebar__eyebrow">TwinTrack Platform</p>
      <h1>人员实时定位 3D 孪生平台</h1>
    </div>
    <div class="sidebar__content">
      <OnlineStats />
      <AreaOverview />
      <EventNotice />
      <PersonSearch />
    </div>
  </aside>
</template>

<script setup lang="ts">
import AreaOverview from './AreaOverview.vue';
import EventNotice from './EventNotice.vue';
import OnlineStats from './OnlineStats.vue';
import PersonSearch from './PersonSearch.vue';
</script>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: 400px;
  min-width: 380px;
  max-width: 420px;
  height: 100%;
  padding: 24px 18px 24px 24px;
  backdrop-filter: blur(18px);
}

.sidebar__brand {
  padding: 20px 20px 18px;
  border: 1px solid rgba(97, 166, 255, 0.2);
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(8, 24, 39, 0.94), rgba(7, 16, 29, 0.84));
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.24);
}

.sidebar__eyebrow {
  margin: 0 0 10px;
  color: #55d7ff;
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.sidebar__brand h1 {
  margin: 0;
  color: #f2f8ff;
  font-size: 28px;
  line-height: 1.2;
}

.sidebar__content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-top: 18px;
  overflow: auto;
  padding-right: 4px;
}

.sidebar__content::-webkit-scrollbar {
  width: 6px;
}

.sidebar__content::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(95, 162, 235, 0.35);
}

@media (max-width: 1200px) {
  .sidebar {
    width: 360px;
    min-width: 360px;
  }

  .sidebar__brand h1 {
    font-size: 24px;
  }
}
</style>

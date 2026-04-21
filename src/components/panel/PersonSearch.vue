<template>
  <PanelCard title="人员搜索">
    <div class="search-box">
      <input type="text" placeholder="搜索姓名 / 工号 / 标签ID" />
      <button type="button">查询</button>
    </div>
    <div class="search-placeholder">
      <span>占位区域：后续接入人员实时检索与定位联动</span>
    </div>
  </PanelCard>
</template>

<script setup lang="ts">
import PanelCard from './PanelCard.vue';
</script>

<style scoped>
.search-box {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.search-box input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(86, 157, 255, 0.2);
  border-radius: 12px;
  background: rgba(4, 18, 30, 0.85);
  color: #eaf7ff;
  outline: none;
}

.search-box input::placeholder {
  color: rgba(213, 230, 242, 0.4);
}

.search-box button {
  padding: 0 18px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #117eff, #0fd1c7);
  color: white;
  cursor: pointer;
}

.search-placeholder {
  margin-top: 14px;
  padding: 16px 14px;
  border-radius: 12px;
  background: rgba(8, 28, 46, 0.7);
  color: rgba(220, 230, 239, 0.7);
  font-size: 13px;
}
</style>

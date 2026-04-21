<template>
  <section class="panel-card">
    <header class="panel-card__header">
      <span class="panel-card__title">{{ title }}</span>
      <span class="panel-card__line" />
    </header>
    <div class="panel-card__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>

<style scoped>
.panel-card {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(98, 164, 255, 0.18);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(10, 27, 45, 0.92), rgba(7, 15, 28, 0.82));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 16px 40px rgba(0, 0, 0, 0.28);
}

.panel-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(41, 182, 246, 0.08), transparent 42%);
  pointer-events: none;
}

.panel-card__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px 0;
}

.panel-card__title {
  color: #f2fbff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.panel-card__line {
  height: 1px;
  flex: 1;
  background: linear-gradient(90deg, rgba(75, 196, 255, 0.9), rgba(75, 196, 255, 0));
}

.panel-card__body {
  position: relative;
  z-index: 1;
  padding: 16px 18px 18px;
}
</style>

<template>
  <div class="modeling-workbench">
    <LegacyWorkbenchApp @back-to-list="emit('back-to-list')" />
  </div>
</template>

<script setup lang="ts">
import LegacyWorkbenchApp from '@/modeling-workbench/legacy/App.vue';

const emit = defineEmits<{
  (event: 'back-to-list'): void;
}>();
</script>

<style src="./workbench.css"></style>

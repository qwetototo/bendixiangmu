<template>
  <Teleport to="body">
    <div v-if="open" :class="['management-modal-mask', `management-modal-mask--${themeMode}`]" @click.self="$emit('close')">
      <section class="management-modal" role="dialog" aria-modal="true" :aria-labelledby="titleId">
        <header>
          <div>
            <small v-if="eyebrow">{{ eyebrow }}</small>
            <h3 :id="titleId">{{ title }}</h3>
          </div>
          <button class="modal-close" type="button" aria-label="关闭" @click="$emit('close')">×</button>
        </header>
        <div class="modal-body"><slot /></div>
        <footer v-if="$slots.footer"><slot name="footer" /></footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  open: boolean;
  title: string;
  eyebrow?: string;
  themeMode?: 'dark' | 'light';
}>(), {
  themeMode: 'light',
});

defineEmits<{ close: [] }>();

const titleId = computed(() => `modal-${props.title.replace(/\s+/g, '-')}`);
</script>

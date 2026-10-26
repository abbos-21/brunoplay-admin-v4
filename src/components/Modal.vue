<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

defineProps<{ title: string; wide?: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const onKey = (e: KeyboardEvent) => e.key === 'Escape' && emit('close')
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="overlay" @mousedown.self="emit('close')">
    <div class="modal" :class="{ wide }" role="dialog" aria-modal="true" :aria-label="title">
      <h2>{{ title }}</h2>
      <slot />
    </div>
  </div>
</template>

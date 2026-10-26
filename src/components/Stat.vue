<script setup lang="ts">
defineProps<{ label: string; value: string | number; hint?: string; tone?: 'warn' | 'bad' }>()
</script>

<template>
  <div class="card stat" :class="tone">
    <div class="label">{{ label }}</div>
    <div class="value">{{ value }}</div>
    <div v-if="hint" class="hint">{{ hint }}</div>
  </div>
</template>

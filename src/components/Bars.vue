<script setup lang="ts">
import { computed } from 'vue'

/** a tiny bar chart: one bar per entry, labelled with the day */
const props = defineProps<{ items: { label: string; value: number }[]; unit?: string }>()
const max = computed(() => Math.max(1, ...props.items.map((i) => i.value)))
</script>

<template>
  <div class="bars" role="img">
    <div v-for="i in items" :key="i.label" class="bar" :title="`${i.label}: ${i.value.toLocaleString('en-US')}${unit ? ' ' + unit : ''}`">
      <i :style="{ height: `${(i.value / max) * 100}%`, opacity: i.value ? 1 : 0.25 }" />
      <span>{{ i.label.slice(8) }}</span>
    </div>
  </div>
</template>

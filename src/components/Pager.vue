<script setup lang="ts">
defineProps<{ page: number; totalPages: number; total?: number }>()
const emit = defineEmits<{ (e: 'change', page: number): void }>()
</script>

<template>
  <div class="pager">
    <span v-if="total !== undefined">{{ total.toLocaleString('en-US') }} total</span>
    <span class="grow" />
    <button class="sm" :disabled="page <= 1" @click="emit('change', page - 1)">‹ Prev</button>
    <span>Page {{ page }} of {{ totalPages }}</span>
    <button class="sm" :disabled="page >= totalPages" @click="emit('change', page + 1)">Next ›</button>
  </div>
</template>

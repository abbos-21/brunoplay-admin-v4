<script setup lang="ts">
import { ref } from 'vue'
import Modal from './Modal.vue'

/** A confirmation that asks for a reason (it ends up in the audit log). */
const props = defineProps<{
  title: string
  text?: string
  confirmText?: string
  danger?: boolean
  label?: string
  /** minimum number of characters, 0 = optional */
  minLength?: number
  busy?: boolean
}>()
const emit = defineEmits<{ (e: 'confirm', reason: string): void; (e: 'close'): void }>()

const reason = ref('')
const min = props.minLength ?? 3
</script>

<template>
  <Modal :title="title" @close="emit('close')">
    <p v-if="text" class="muted" style="margin-top: 0">{{ text }}</p>
    <label class="field">
      {{ label ?? 'Reason' }}
      <textarea v-model="reason" autofocus />
    </label>
    <div class="actions">
      <button @click="emit('close')">Cancel</button>
      <button :class="danger ? 'danger' : 'primary'" :disabled="busy || reason.trim().length < min" @click="emit('confirm', reason.trim())">
        {{ confirmText ?? 'Confirm' }}
      </button>
    </div>
  </Modal>
</template>

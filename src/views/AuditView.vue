<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { api } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { dateTime } from '@/composables/format'
import { useToast } from '@/composables/useToast'

interface Row {
  id: number
  adminId: number | null
  adminEmail: string
  action: string
  targetType: string
  targetId: string
  before: unknown
  after: unknown
  ip: string
  createdAt: string
}

const auth = useAuth()
const toast = useToast()
const action = ref('')
const rows = ref<Row[]>([])
const loading = ref(false)
const more = ref(false)
const open = ref<number | null>(null)
const PAGE = 50

async function load(append = false) {
  loading.value = true
  try {
    const before = append && rows.value.length ? rows.value[rows.value.length - 1].id : 0
    const r = await api.get<{ audit: Row[] | null }>('/admin/audit', { action: action.value.trim(), before, limit: PAGE })
    const l = r.audit ?? []
    rows.value = append ? [...rows.value, ...l] : l
    more.value = l.length === PAGE
  } catch (e) {
    toast.error(e)
  } finally {
    loading.value = false
  }
}
let t: ReturnType<typeof setTimeout>
watch(action, () => {
  clearTimeout(t)
  t = setTimeout(() => load(), 300)
})
onMounted(() => load())

const json = (v: unknown) => (v === null || v === undefined ? '—' : JSON.stringify(v, null, 2))
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Audit log</h1>
      <span class="grow" />
      <input v-model="action" placeholder="Filter by action, e.g. settings.set" style="width: 280px" />
      <button @click="load()">Refresh</button>
    </div>
    <p class="hint">
      Every change made in this panel is recorded here and cannot be edited.
      <template v-if="!auth.can('audit.read')">You see your own actions only.</template>
    </p>

    <div class="card flush">
      <div class="table-wrap">
        <table>
          <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>From</th><th /></tr></thead>
          <tbody>
            <template v-for="r in rows" :key="r.id">
              <tr class="click" @click="open = open === r.id ? null : r.id">
                <td class="nowrap">{{ dateTime(r.createdAt) }}</td>
                <td>{{ r.adminEmail || '—' }}</td>
                <td><code>{{ r.action }}</code></td>
                <td>{{ r.targetType }} <b>{{ r.targetId }}</b></td>
                <td><code>{{ r.ip || '—' }}</code></td>
                <td class="muted">{{ open === r.id ? '▲' : '▼' }}</td>
              </tr>
              <tr v-if="open === r.id">
                <td colspan="6" style="background: #faf8f3">
                  <div class="grid c2">
                    <div><h3>Before</h3><pre class="mono" style="margin: 0; white-space: pre-wrap; word-break: break-all">{{ json(r.before) }}</pre></div>
                    <div><h3>After</h3><pre class="mono" style="margin: 0; white-space: pre-wrap; word-break: break-all">{{ json(r.after) }}</pre></div>
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="!rows.length && !loading"><td colspan="6" class="empty">No entries.</td></tr>
          </tbody>
        </table>
      </div>
      <div v-if="more" class="pager"><button :disabled="loading" @click="load(true)">Load more</button></div>
    </div>
  </div>
</template>

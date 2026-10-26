<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { useBusy, useLoader } from '@/composables/useBusy'
import { dateTime } from '@/composables/format'
import Modal from '@/components/Modal.vue'

interface Setting {
  key: string
  group: string
  kind: 'int' | 'float' | 'bool' | 'string' | 'json'
  desc: string
  value: unknown
  default: unknown
  configured: boolean
  missing: boolean
  enum?: string[]
  updatedAt?: string
}
interface Hist { id: number; key: string; old: unknown; new: unknown; changedBy: number | null; changedAt: string }

const auth = useAuth()
const { busy, run } = useBusy()
const { data, loading, error, load } = useLoader(() => api.get<{ settings: Setting[] }>('/admin/settings'))
onMounted(load)

const all = computed(() => data.value?.settings ?? [])
const groups = computed(() => [...new Set(all.value.map((s) => s.group))].sort())
const missing = computed(() => all.value.filter((s) => s.missing))
const tab = ref('')
const search = ref('')
const activeTab = computed(() => tab.value || (missing.value.length ? '__missing' : groups.value[0] ?? ''))

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (q) return all.value.filter((s) => s.key.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q))
  if (activeTab.value === '__missing') return missing.value
  return all.value.filter((s) => s.group === activeTab.value)
})
const missingIn = (g: string) => all.value.filter((s) => s.group === g && s.missing).length

/** what is shown in the editor: the saved value, otherwise the default, otherwise empty */
function current(s: Setting): unknown {
  if (s.configured && s.value !== null && s.value !== undefined) return s.value
  return s.default ?? null
}

// drafts hold the text of an editor until it is saved
const drafts = reactive<Record<string, string | boolean>>({})
const errors = reactive<Record<string, string>>({})

function draft(s: Setting): string | boolean {
  if (s.key in drafts) return drafts[s.key]
  const v = current(s)
  if (s.kind === 'bool') return v === true
  if (s.kind === 'json') return v === null ? '' : JSON.stringify(v, null, 2)
  return v === null || v === undefined ? '' : String(v)
}
function setDraft(s: Setting, v: string | boolean) {
  drafts[s.key] = v
  delete errors[s.key]
}
const dirty = (s: Setting) => s.key in drafts

function parsed(s: Setting): { ok: true; value: unknown } | { ok: false; error: string } {
  const d = draft(s)
  switch (s.kind) {
    case 'bool':
      return { ok: true, value: d === true }
    case 'int':
    case 'float': {
      const t = String(d).trim()
      if (t === '' || Number.isNaN(Number(t))) return { ok: false, error: 'Enter a number' }
      const n = Number(t)
      if (s.kind === 'int' && !Number.isInteger(n)) return { ok: false, error: 'Whole numbers only' }
      return { ok: true, value: n }
    }
    case 'string':
      return { ok: true, value: String(d) }
    default:
      try {
        return { ok: true, value: JSON.parse(String(d)) }
      } catch (e) {
        return { ok: false, error: 'Not valid JSON: ' + (e instanceof Error ? e.message : '') }
      }
  }
}

const canWrite = (s: Setting) => auth.can('settings.write.' + s.group)

async function save(s: Setting) {
  const p = parsed(s)
  if (!p.ok) {
    errors[s.key] = p.error
    return
  }
  const ok = await run(() => api.put(`/admin/settings/${encodeURIComponent(s.key)}`, { value: p.value }), `${s.key} saved`)
  if (ok) {
    delete drafts[s.key]
    await load(true)
  }
}
function revert(s: Setting) {
  delete drafts[s.key]
  delete errors[s.key]
}
function format(s: Setting) {
  const p = parsed(s)
  if (p.ok) setDraft(s, JSON.stringify(p.value, null, 2))
  else errors[s.key] = p.error
}

// ---- history
const histKey = ref('')
const history = ref<Hist[]>([])
async function showHistory(key: string) {
  histKey.value = key
  history.value = []
  const r = await run(() => api.get<{ history: Hist[] | null }>('/admin/settings/history', { key, limit: 30 }))
  history.value = r?.history ?? []
}
const show = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v))
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Settings</h1>
      <span class="grow" />
      <input v-model="search" placeholder="Search a setting" style="width: 260px" />
      <button @click="load()">Reload</button>
    </div>
    <p class="hint">
      Every number the game uses lives here. A setting marked <span class="badge bad">missing</span> has no value yet: the feature that needs it answers
      "not configured" to players until you set it. Changes apply within seconds and are written to the audit log.
    </p>
    <p v-if="error" class="err">{{ error }}</p>
    <p v-if="loading && !data" class="muted">Loading…</p>

    <div v-if="data && !search" class="tabs">
      <button v-if="missing.length" :class="{ on: activeTab === '__missing' }" @click="tab = '__missing'">
        Missing <span class="badge bad">{{ missing.length }}</span>
      </button>
      <button v-for="g in groups" :key="g" :class="{ on: activeTab === g }" @click="tab = g">
        {{ g }} <span v-if="missingIn(g)" class="badge bad">{{ missingIn(g) }}</span>
      </button>
    </div>

    <div class="col">
      <div v-for="s in visible" :key="s.key" class="card">
        <div class="row between">
          <div>
            <code><b>{{ s.key }}</b></code>
            <span class="badge" style="margin-left: 8px">{{ s.kind }}</span>
            <span v-if="s.missing" class="badge bad">missing</span>
            <span v-else-if="!s.configured" class="badge info">default</span>
          </div>
          <div class="muted">
            <span v-if="s.updatedAt">changed {{ dateTime(s.updatedAt) }}</span>
            <button class="sm ghost" @click="showHistory(s.key)">History</button>
          </div>
        </div>
        <p class="muted" style="margin: 4px 0 10px">{{ s.desc }}</p>

        <div class="row" style="align-items: flex-start">
          <label v-if="s.kind === 'bool'" class="row">
            <input type="checkbox" :checked="draft(s) === true" :disabled="!canWrite(s)" @change="setDraft(s, ($event.target as HTMLInputElement).checked)" />
            {{ draft(s) === true ? 'On' : 'Off' }}
          </label>
          <select v-else-if="s.enum?.length" :value="String(draft(s))" :disabled="!canWrite(s)" @change="setDraft(s, ($event.target as HTMLSelectElement).value)">
            <option v-for="o in s.enum" :key="o" :value="o">{{ o }}</option>
          </select>
          <textarea
            v-else-if="s.kind === 'json'"
            :value="String(draft(s))"
            :disabled="!canWrite(s)"
            rows="8"
            class="mono grow"
            spellcheck="false"
            style="min-width: 280px; width: 100%"
            @input="setDraft(s, ($event.target as HTMLTextAreaElement).value)"
          />
          <input
            v-else
            :value="String(draft(s))"
            :type="s.kind === 'string' ? 'text' : 'number'"
            :step="s.kind === 'float' ? 'any' : '1'"
            :disabled="!canWrite(s)"
            :placeholder="s.missing ? 'Required' : ''"
            style="width: min(420px, 100%)"
            @input="setDraft(s, ($event.target as HTMLInputElement).value)"
          />

          <template v-if="canWrite(s) && dirty(s)">
            <button class="primary" :disabled="busy" @click="save(s)">Save</button>
            <button :disabled="busy" @click="revert(s)">Undo</button>
            <button v-if="s.kind === 'json'" :disabled="busy" @click="format(s)">Format</button>
          </template>
        </div>
        <p v-if="errors[s.key]" class="err" style="margin: 6px 0 0">{{ errors[s.key] }}</p>
        <p v-if="s.configured && s.default !== null && s.default !== undefined && s.kind !== 'json'" class="hint" style="margin: 6px 0 0">
          Default: {{ show(s.default) }}
        </p>
      </div>
      <div v-if="!visible.length && !loading" class="card empty">Nothing to show.</div>
    </div>

    <Modal v-if="histKey" :title="`History of ${histKey}`" wide @close="histKey = ''">
      <table>
        <thead><tr><th>When</th><th>Admin</th><th>Before</th><th>After</th></tr></thead>
        <tbody>
          <tr v-for="h in history" :key="h.id">
            <td class="nowrap">{{ dateTime(h.changedAt) }}</td>
            <td>{{ h.changedBy ? '#' + h.changedBy : '—' }}</td>
            <td><code style="word-break: break-all">{{ show(h.old).slice(0, 240) }}</code></td>
            <td><code style="word-break: break-all">{{ show(h.new).slice(0, 240) }}</code></td>
          </tr>
          <tr v-if="!history.length"><td colspan="4" class="empty">No changes recorded.</td></tr>
        </tbody>
      </table>
      <div class="actions"><button @click="histKey = ''">Close</button></div>
    </Modal>
  </div>
</template>

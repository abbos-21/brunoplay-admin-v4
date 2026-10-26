<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { useBusy, useLoader } from '@/composables/useBusy'
import { num, tone } from '@/composables/format'

interface Tpl { type: string; lang: 'EN' | 'RU'; text: string; button: string; default: string; edited: boolean }
interface Stat { type: string; status: string; count: number }

const auth = useAuth()
const { busy, run } = useBusy()
const { data, loading, error, load } = useLoader(() => api.get<{ templates: Tpl[] | null }>('/admin/notifications/templates'))
const hours = ref(24)
const st = useLoader(() => api.get<{ stats: Stat[] | null }>('/admin/notifications/stats', { hours: hours.value }))
onMounted(() => {
  load()
  st.load()
})
const canWrite = computed(() => auth.can('notifications.write'))
const search = ref('')

const types = computed(() => {
  const by = new Map<string, { EN?: Tpl; RU?: Tpl }>()
  for (const t of data.value?.templates ?? []) by.set(t.type, { ...by.get(t.type), [t.lang]: t })
  const q = search.value.trim().toLowerCase()
  return [...by.entries()].filter(([k]) => !q || k.includes(q))
})

// drafts: key "type/LANG" → text + button
const drafts = reactive<Record<string, { text: string; button: string }>>({})
const key = (t: Tpl) => `${t.type}/${t.lang}`
const get = (t: Tpl) => drafts[key(t)] ?? { text: t.text, button: t.button }
function edit(t: Tpl, field: 'text' | 'button', v: string) {
  drafts[key(t)] = { ...get(t), [field]: v }
}
const dirty = (t: Tpl) => key(t) in drafts && (drafts[key(t)].text !== t.text || drafts[key(t)].button !== t.button)
const placeholders = (s: string) => [...new Set([...s.matchAll(/\{[a-zA-Z_]+\}/g)].map((m) => m[0]))]
const missingPh = (t: Tpl) => placeholders(t.default).filter((p) => !get(t).text.includes(p))

async function save(t: Tpl) {
  const d = get(t)
  if (await run(() => api.put(`/admin/notifications/templates/${t.type}/${t.lang}`, { text: d.text, button: d.button }), `${t.type} (${t.lang}) saved`)) {
    delete drafts[key(t)]
    load(true)
  }
}
async function reset(t: Tpl) {
  if (await run(() => api.del(`/admin/notifications/templates/${t.type}/${t.lang}`), 'Back to the default text')) {
    delete drafts[key(t)]
    load(true)
  }
}

const byType = computed(() => {
  const m = new Map<string, Stat[]>()
  for (const s of st.data.value?.stats ?? []) m.set(s.type, [...(m.get(s.type) ?? []), s])
  return m
})
const totals = computed(() => {
  const m = new Map<string, number>()
  for (const s of st.data.value?.stats ?? []) m.set(s.status, (m.get(s.status) ?? 0) + s.count)
  return [...m.entries()]
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Bot messages</h1>
      <span class="grow" />
      <input v-model="search" placeholder="Filter by type" style="width: 200px" />
      <button @click="(load(), st.load())">Reload</button>
    </div>
    <p class="hint">
      The texts the bot sends automatically, in both languages. Keep the <code>{placeholders}</code> — the server fills them in. An edited text shows <span class="badge info">edited</span>;
      <b>Use default</b> restores the original. Basic HTML (&lt;b&gt;, &lt;i&gt;) works.
    </p>
    <p v-if="error" class="err">{{ error }}</p>

    <div class="card mb">
      <div class="row between">
        <h2 style="margin: 0">Delivery in the last</h2>
        <select v-model.number="hours" @change="st.load()">
          <option :value="1">hour</option><option :value="24">24 hours</option><option :value="168">7 days</option>
        </select>
      </div>
      <div class="row" style="margin-top: 10px">
        <span v-for="[s, n] in totals" :key="s" class="badge" :class="tone(s)">{{ s }}: {{ num(n) }}</span>
        <span v-if="!totals.length" class="muted">No messages in this period.</span>
      </div>
      <p class="hint" style="margin-bottom: 0">SKIPPED means the server held a message back on purpose (quiet hours, daily cap, cooldown, opt-out or no longer relevant). FAILED needs attention.</p>
    </div>

    <p v-if="loading && !data" class="muted">Loading…</p>
    <div class="col">
      <div v-for="[type, pair] in types" :key="type" class="card">
        <div class="row between">
          <h3 style="margin: 0"><code>{{ type }}</code></h3>
          <span class="hint">
            <template v-for="s in byType.get(type) ?? []" :key="s.status"><span class="badge" :class="tone(s.status)" style="margin-left: 4px">{{ s.status }} {{ num(s.count) }}</span></template>
          </span>
        </div>
        <div class="grid c2" style="margin-top: 10px">
          <div v-for="t in [pair.EN, pair.RU]" :key="t?.lang">
            <template v-if="t">
              <div class="row" style="margin-bottom: 4px">
                <b>{{ t.lang === 'EN' ? 'English' : 'Russian' }}</b>
                <span v-if="t.edited" class="badge info">edited</span>
              </div>
              <textarea :value="get(t).text" :disabled="!canWrite" rows="3" maxlength="1000" @input="edit(t, 'text', ($event.target as HTMLTextAreaElement).value)" />
              <label class="field" style="margin-top: 6px">Button
                <input :value="get(t).button" :disabled="!canWrite" maxlength="40" @input="edit(t, 'button', ($event.target as HTMLInputElement).value)" />
              </label>
              <p v-if="missingPh(t).length" class="err" style="margin: 6px 0 0">Missing placeholder: {{ missingPh(t).join(' ') }}</p>
              <div v-if="canWrite" class="row" style="margin-top: 8px">
                <button class="primary sm" :disabled="busy || !dirty(t)" @click="save(t)">Save</button>
                <button v-if="t.edited" class="sm" :disabled="busy" @click="reset(t)">Use default</button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

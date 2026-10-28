<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { api } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { useBusy, useLoader } from '@/composables/useBusy'
import { useToast } from '@/composables/useToast'

interface Field { key: string; label: string; help: string; kind: 'string' | 'bool' | 'number'; value: string | boolean | number }
interface Webhook { label: string; url: string; note: string }
interface Provider {
  id: string
  name: string
  formats: string[]
  enabled: boolean
  ready: boolean
  problem: string
  fields: Field[]
  webhooks: Webhook[]
}
interface Page { providers: Provider[]; required: boolean }

const auth = useAuth()
const toast = useToast()
const { busy, run } = useBusy()
const canWrite = computed(() => auth.can('settings.write.ads'))

const page = useLoader(() => api.get<Page>('/admin/ads/providers'))
onMounted(() => page.load())

// the draft the admin edits; nothing is saved until "Save"
const list = ref<Provider[]>([])
const original = ref('')
watch(
  () => page.data.value,
  (d) => {
    list.value = JSON.parse(JSON.stringify(d?.providers ?? []))
    original.value = snapshot()
  },
  { immediate: true },
)
function snapshot() {
  return JSON.stringify(list.value.map((p) => [p.id, p.enabled, p.fields.map((f) => f.value)]))
}
const dirty = computed(() => snapshot() !== original.value)
const required = computed(() => page.data.value?.required ?? true)

function move(i: number, d: -1 | 1) {
  const j = i + d
  if (j < 0 || j >= list.value.length) return
  const [x] = list.value.splice(i, 1)
  list.value.splice(j, 0, x)
}

const formatNames: Record<string, string> = { rewarded: 'Rewarded', interstitial: 'Interstitial', task: 'Sponsored task' }

// A draft provider counts as "serving" when it is on and (for fields the admin just typed) set up. The server decides for real;
// this only drives the warning, so a field that was just typed counts as filled.
const serving = computed(() =>
  list.value.filter((p) => p.enabled && p.formats.includes('rewarded') && (p.ready || p.fields.some((f) => f.kind === 'string' && String(f.value).trim() !== ''))),
)
const nobody = computed(() => !serving.value.length)

async function save() {
  const fields: Record<string, string | boolean | number> = {}
  for (const p of list.value) {
    for (const f of p.fields) {
      if (f.kind === 'number') fields[f.key] = f.value === '' ? NaN : Number(f.value)
      else fields[f.key] = typeof f.value === 'string' ? f.value.trim() : f.value
    }
  }
  if (Object.values(fields).some((v) => typeof v === 'number' && !Number.isFinite(v))) {
    toast.error('Type a whole number in the seconds field.')
    return
  }
  const out = await run(
    () => api.put<Page>('/admin/ads/providers', { providers: list.value.map((p) => ({ id: p.id, enabled: p.enabled })), fields }),
    'Saved. New ads follow it within a few seconds.',
  )
  if (out) page.data.value = out
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.ok('Copied')
  } catch {
    toast.error('Could not copy, select the text and copy it yourself')
  }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Ads</h1>
      <span class="grow" />
      <button :disabled="busy" @click="page.load()">Refresh</button>
      <button v-if="canWrite" class="primary" :disabled="busy || !dirty" @click="save">Save</button>
    </div>
    <p class="hint">
      The ad providers. The <b>order is the priority</b>: for a rewarded ad (fishing start and collect, bonus, and so on) the game asks the first
      provider that is on; if it has no ad or fails, it asks the next one. Switch a provider off and it is skipped. Interstitial ads and the
      sponsored task card come only from the providers that serve those formats (see the badges) and follow the same on/off switch.
    </p>
    <p v-if="!required" class="hint">
      Note: <b>Ads required</b> is OFF in Settings, so players can also play without watching ads. Turn it on before launch.
    </p>
    <p v-else-if="nobody" class="err">
      No provider is on and set up for rewarded ads. While that is so, fishing start and collect cannot get an ad and players are stopped.
      Switch one on (and fill in what it needs).
    </p>

    <p v-if="page.error.value" class="err">{{ page.error.value }}</p>

    <div class="col">
      <div v-for="(p, i) in list" :key="p.id" class="card" :style="{ opacity: p.enabled ? 1 : 0.7 }">
        <div class="row">
          <b style="font-size: 18px">{{ i + 1 }}</b>
          <b style="font-size: 18px">{{ p.name }}</b>
          <span v-if="!p.enabled" class="badge">off</span>
          <span v-else-if="p.ready" class="badge ok">ready</span>
          <span v-else class="badge warn">not set up</span>
          <span v-for="f in p.formats" :key="f" class="badge info">{{ formatNames[f] ?? f }}</span>
          <span class="grow" />
          <label class="row">
            <input v-model="p.enabled" type="checkbox" :disabled="!canWrite || busy" />
            {{ p.enabled ? 'On' : 'Off' }}
          </label>
          <button class="sm" :disabled="!canWrite || busy || i === 0" title="Higher priority" @click="move(i, -1)">▲</button>
          <button class="sm" :disabled="!canWrite || busy || i === list.length - 1" title="Lower priority" @click="move(i, 1)">▼</button>
        </div>

        <p v-if="!p.ready && p.problem" class="hint" style="margin: 8px 0 0">{{ p.problem }}</p>

        <div v-if="p.fields.length" class="col" style="margin-top: 12px">
          <template v-for="f in p.fields" :key="f.key">
            <label v-if="f.kind === 'bool'" class="row">
              <input v-model="f.value" type="checkbox" :disabled="!canWrite || busy" />
              {{ f.label }} <span class="hint">{{ f.help }}</span>
            </label>
            <label v-else-if="f.kind === 'number'" class="field">
              {{ f.label }}
              <input v-model.number="f.value" type="number" min="0" max="120" step="1" :disabled="!canWrite || busy" style="max-width: 140px" />
              <span class="hint">{{ f.help }}</span>
            </label>
            <label v-else class="field">
              {{ f.label }}
              <input v-model="f.value" :disabled="!canWrite || busy" maxlength="40" />
              <span class="hint">{{ f.help }}</span>
            </label>
          </template>
        </div>

        <div v-if="p.webhooks.length" style="margin-top: 12px">
          <div class="hint" style="margin-bottom: 4px">Give these addresses to {{ p.name }} (its dashboard):</div>
          <div v-for="w in p.webhooks" :key="w.url" style="margin-bottom: 8px">
            <div class="hint">{{ w.label }}</div>
            <div class="row">
              <code style="word-break: break-all">{{ w.url }}</code>
              <button class="sm ghost" @click="copy(w.url)">Copy</button>
            </div>
            <div class="hint">{{ w.note }}</div>
          </div>
        </div>
      </div>
    </div>
    <p v-if="!list.length && !page.loading.value" class="muted">No providers.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { useBusy, useLoader } from '@/composables/useBusy'
import { dateTime, num, tone } from '@/composables/format'
import Modal from '@/components/Modal.vue'

interface Segment {
  language: string
  minLevel: number
  maxLevel: number
  inactiveDays: number
  hasBooster: boolean | null
  minFriends: number
  openGiftClaim: boolean | null
}
interface B {
  id: number
  title: string
  textEn: string
  textRu: string
  buttonEn: string
  buttonRu: string
  buttonPath: string
  photoUrl: string
  segment: Segment
  status: string
  scheduledAt: string | null
  testSentAt: string | null
  queued: number
  createdAt: string
  startedAt: string | null
}

const auth = useAuth()
const { busy, run } = useBusy()
const { data, loading, error, load } = useLoader(() => api.get<{ broadcasts: B[] | null }>('/admin/broadcasts'))
onMounted(load)
const list = computed(() => data.value?.broadcasts ?? [])
const canWrite = computed(() => auth.can('notifications.write'))

const emptySeg = (): Segment => ({ language: '', minLevel: 0, maxLevel: 0, inactiveDays: 0, hasBooster: null, minFriends: 0, openGiftClaim: null })
const editing = ref<number | 'new' | null>(null)
const f = reactive({ title: '', textEn: '', textRu: '', buttonEn: '', buttonRu: '', buttonPath: '', photoUrl: '', segment: emptySeg() })
const formError = ref('')

function openNew() {
  Object.assign(f, { title: '', textEn: '', textRu: '', buttonEn: '', buttonRu: '', buttonPath: '', photoUrl: '', segment: emptySeg() })
  formError.value = ''
  editing.value = 'new'
}
function openEdit(b: B) {
  Object.assign(f, { title: b.title, textEn: b.textEn, textRu: b.textRu, buttonEn: b.buttonEn, buttonRu: b.buttonRu, buttonPath: b.buttonPath, photoUrl: b.photoUrl, segment: { ...emptySeg(), ...b.segment } })
  formError.value = ''
  editing.value = b.id
}
const tri = (v: boolean | null) => (v === null ? '' : v ? 'yes' : 'no')
const fromTri = (s: string) => (s === '' ? null : s === 'yes')

async function save() {
  formError.value = ''
  if (!f.title.trim() || !f.textEn.trim() || !f.textRu.trim()) return (formError.value = 'The title and both texts are required.')
  if ((f.buttonEn || f.buttonRu) && !(f.buttonEn && f.buttonRu)) return (formError.value = 'Give the button text in both languages, or in neither.')
  const body = { ...f, segment: { ...f.segment, minLevel: Number(f.segment.minLevel) || 0, maxLevel: Number(f.segment.maxLevel) || 0, inactiveDays: Number(f.segment.inactiveDays) || 0, minFriends: Number(f.segment.minFriends) || 0 } }
  const r = await run<B>(
    () => (editing.value === 'new' ? api.post<B>('/admin/broadcasts', body) : api.put<B>(`/admin/broadcasts/${editing.value}`, body)),
    'Draft saved. Send yourself a test before starting it.',
  )
  if (r) {
    editing.value = null
    load(true)
  }
}

async function test(b: B) {
  if (await run(() => api.post(`/admin/broadcasts/${b.id}/test`), 'Test sent to your Telegram')) load(true)
}

// ---- start
const starting = ref<B | null>(null)
const when = ref('')
const stats = ref<Record<string, number> | null>(null)
async function start() {
  const b = starting.value
  if (!b) return
  const at = when.value ? new Date(when.value).toISOString() : undefined
  if (await run(() => api.post(`/admin/broadcasts/${b.id}/start`, at ? { at } : {}), at ? 'Scheduled' : 'Sending started')) {
    starting.value = null
    load(true)
  }
}

const cancelling = ref<B | null>(null)
async function cancel() {
  const b = cancelling.value
  if (!b) return
  if (await run(() => api.post(`/admin/broadcasts/${b.id}/cancel`), 'Cancelled')) {
    cancelling.value = null
    load(true)
  }
}

const viewing = ref<B | null>(null)
async function view(b: B) {
  viewing.value = b
  stats.value = null
  const r = await run(() => api.get<{ broadcast: B; stats: Record<string, number> }>(`/admin/broadcasts/${b.id}`))
  if (r) {
    viewing.value = r.broadcast
    stats.value = r.stats
  }
}

function segmentText(s: Segment) {
  const p: string[] = []
  if (s.language) p.push(s.language)
  if (s.minLevel) p.push(`level ≥ ${s.minLevel}`)
  if (s.maxLevel) p.push(`level ≤ ${s.maxLevel}`)
  if (s.inactiveDays) p.push(`away ≥ ${s.inactiveDays} d`)
  if (s.hasBooster !== null && s.hasBooster !== undefined) p.push(s.hasBooster ? 'has a booster' : 'no booster')
  if (s.minFriends) p.push(`≥ ${s.minFriends} friends`)
  if (s.openGiftClaim !== null && s.openGiftClaim !== undefined) p.push(s.openGiftClaim ? 'open gift claim' : 'no open gift claim')
  return p.length ? p.join(', ') : 'everyone the bot can reach'
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Broadcasts</h1>
      <span class="grow" />
      <button v-if="canWrite" class="primary" @click="openNew">+ New broadcast</button>
    </div>
    <p class="hint">
      A broadcast goes to players who started the bot and allow it. Flow: <b>1.</b> save a draft, <b>2.</b> send a test to your own Telegram (set your Telegram id in <i>Admins</i>), <b>3.</b> start now or schedule.
      Editing a draft clears its test. The server sends at a safe speed and respects each player's quiet hours and opt-outs.
    </p>
    <p v-if="error" class="err">{{ error }}</p>

    <div class="card flush">
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Title</th><th>Audience</th><th>Status</th><th>Test</th><th class="right">Queued</th><th /></tr></thead>
          <tbody>
            <tr v-for="b in list" :key="b.id">
              <td>{{ b.id }}</td>
              <td><b>{{ b.title }}</b><div class="hint">{{ dateTime(b.createdAt) }}</div></td>
              <td class="hint">{{ segmentText(b.segment) }}</td>
              <td>
                <span class="badge" :class="tone(b.status)">{{ b.status }}</span>
                <div v-if="b.scheduledAt && b.status === 'SCHEDULED'" class="hint">at {{ dateTime(b.scheduledAt) }}</div>
              </td>
              <td>{{ b.testSentAt ? dateTime(b.testSentAt) : '—' }}</td>
              <td class="right">{{ num(b.queued) }}</td>
              <td class="nowrap right">
                <button class="sm" @click="view(b)">Results</button>
                <template v-if="canWrite && b.status === 'DRAFT'">
                  <button class="sm" :disabled="busy" @click="openEdit(b)">Edit</button>
                  <button class="sm" :disabled="busy" @click="test(b)">Send test</button>
                  <button class="sm primary" :disabled="busy || !b.testSentAt" :title="b.testSentAt ? '' : 'Send a test first'" @click="((starting = b), (when = ''))">Start…</button>
                </template>
                <button v-if="canWrite && ['DRAFT', 'SCHEDULED', 'SENDING'].includes(b.status)" class="sm danger" :disabled="busy" @click="cancelling = b">Cancel</button>
              </td>
            </tr>
            <tr v-if="!list.length && !loading"><td colspan="7" class="empty">No broadcasts yet.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <Modal v-if="editing !== null" :title="editing === 'new' ? 'New broadcast' : 'Edit draft'" wide @close="editing = null">
      <div class="grid c2">
        <label class="field" style="grid-column: 1 / -1">Internal title (only you see it)<input v-model="f.title" maxlength="120" /></label>
        <label class="field">Text (English)<textarea v-model="f.textEn" rows="6" maxlength="1000" /><span class="hint">{{ f.textEn.length }}/1000 · basic HTML: &lt;b&gt; &lt;i&gt;</span></label>
        <label class="field">Text (Russian)<textarea v-model="f.textRu" rows="6" maxlength="1000" /><span class="hint">{{ f.textRu.length }}/1000</span></label>
        <label class="field">Button text (English)<input v-model="f.buttonEn" maxlength="40" /></label>
        <label class="field">Button text (Russian)<input v-model="f.buttonRu" maxlength="40" /></label>
        <label class="field">Button opens (page in the app)<input v-model="f.buttonPath" maxlength="100" placeholder="/shop" /></label>
        <label class="field">Picture link (optional)<input v-model="f.photoUrl" maxlength="500" placeholder="https://…" /></label>
      </div>

      <h3 class="mt">Audience <span class="hint">(leave empty for everybody)</span></h3>
      <div class="grid c3">
        <label class="field">Language
          <select v-model="f.segment.language"><option value="">All</option><option value="EN">English</option><option value="RU">Russian</option></select>
        </label>
        <label class="field">Level at least<input v-model.number="f.segment.minLevel" type="number" min="0" /></label>
        <label class="field">Level at most<input v-model.number="f.segment.maxLevel" type="number" min="0" /></label>
        <label class="field">Away for at least (days)<input v-model.number="f.segment.inactiveDays" type="number" min="0" /></label>
        <label class="field">Friends at least<input v-model.number="f.segment.minFriends" type="number" min="0" /></label>
        <label class="field">Has an active booster
          <select :value="tri(f.segment.hasBooster)" @change="f.segment.hasBooster = fromTri(($event.target as HTMLSelectElement).value)">
            <option value="">Any</option><option value="yes">Yes</option><option value="no">No</option>
          </select>
        </label>
        <label class="field">Has a gift claim open
          <select :value="tri(f.segment.openGiftClaim)" @change="f.segment.openGiftClaim = fromTri(($event.target as HTMLSelectElement).value)">
            <option value="">Any</option><option value="yes">Yes</option><option value="no">No</option>
          </select>
        </label>
      </div>
      <p v-if="formError" class="err">{{ formError }}</p>
      <div class="actions">
        <button @click="editing = null">Cancel</button>
        <button class="primary" :disabled="busy" @click="save">Save draft</button>
      </div>
    </Modal>

    <Modal v-if="starting" :title="`Start “${starting.title}”`" @close="starting = null">
      <p class="muted" style="margin-top: 0">Audience: {{ segmentText(starting.segment) }}.</p>
      <label class="field">Send at (your local time; leave empty to send now)<input v-model="when" type="datetime-local" /></label>
      <div class="actions">
        <button @click="starting = null">Not yet</button>
        <button class="primary" :disabled="busy" @click="start">{{ when ? 'Schedule' : 'Send now' }}</button>
      </div>
    </Modal>

    <Modal v-if="cancelling" title="Cancel this broadcast?" @close="cancelling = null">
      <p style="margin-top: 0">Messages not sent yet are dropped. Messages already delivered stay with the players.</p>
      <div class="actions">
        <button @click="cancelling = null">Keep it</button>
        <button class="danger" :disabled="busy" @click="cancel">Cancel broadcast</button>
      </div>
    </Modal>

    <Modal v-if="viewing" :title="viewing.title" wide @close="viewing = null">
      <div class="grid c2">
        <div>
          <h3>English</h3>
          <div class="card" style="white-space: pre-wrap">{{ viewing.textEn }}<div v-if="viewing.buttonEn" class="mt"><span class="badge info">[ {{ viewing.buttonEn }} ]</span></div></div>
        </div>
        <div>
          <h3>Russian</h3>
          <div class="card" style="white-space: pre-wrap">{{ viewing.textRu }}<div v-if="viewing.buttonRu" class="mt"><span class="badge info">[ {{ viewing.buttonRu }} ]</span></div></div>
        </div>
      </div>
      <h3 class="mt">Delivery</h3>
      <p v-if="!stats" class="muted">Loading…</p>
      <div v-else class="row">
        <span v-for="(n, s) in stats" :key="s" class="badge" :class="tone(String(s))">{{ s }}: {{ num(n) }}</span>
        <span v-if="!Object.keys(stats).length" class="muted">No messages were queued.</span>
      </div>
      <div class="actions"><button @click="viewing = null">Close</button></div>
    </Modal>
  </div>
</template>

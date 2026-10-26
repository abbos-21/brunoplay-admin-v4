<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { useBusy, useLoader } from '@/composables/useBusy'
import { dateTime, num, toLocalInput, tone } from '@/composables/format'
import { METRICS, type Prize } from '@/composables/tournament'
import Modal from '@/components/Modal.vue'

interface T {
  id: number
  nameEn?: string
  nameRu?: string
  descEn?: string
  descRu?: string
  name: string
  metric: string
  startAt: string
  endAt: string
  entryFee: number
  prizes: Prize[]
  status: string
}

const router = useRouter()
const auth = useAuth()
const { busy, run } = useBusy()
const { data, loading, error, load } = useLoader(() => api.get<{ tournaments: T[] | null }>('/admin/tournaments'))
onMounted(load)
const list = computed(() => data.value?.tournaments ?? [])
const canWrite = computed(() => auth.can('tournaments.write'))

const editing = ref<number | 'new' | null>(null)
const f = reactive({ nameEn: '', nameRu: '', descEn: '', descRu: '', metric: 'COINS_MINED', startAt: '', endAt: '', entryFee: 0, prizes: [] as Prize[] })
const formError = ref('')
const locked = computed(() => {
  if (editing.value === 'new' || editing.value === null) return false
  const t = list.value.find((x) => x.id === editing.value)
  return !!t && t.status !== 'SCHEDULED'
})

function openNew() {
  const start = new Date(Date.now() + 86400_000)
  start.setMinutes(0, 0, 0)
  Object.assign(f, {
    nameEn: '', nameRu: '', descEn: '', descRu: '', metric: 'COINS_MINED', startAt: toLocalInput(start),
    endAt: toLocalInput(new Date(start.getTime() + 7 * 86400_000)), entryFee: 0,
    prizes: [{ place: 1, coins: 0, stars: 0, gift: '' }] as Prize[],
  })
  formError.value = ''
  editing.value = 'new'
}
function openEdit(t: T) {
  Object.assign(f, {
    nameEn: t.nameEn ?? t.name, nameRu: t.nameRu ?? '', descEn: t.descEn ?? '', descRu: t.descRu ?? '', metric: t.metric,
    startAt: toLocalInput(t.startAt), endAt: toLocalInput(t.endAt), entryFee: t.entryFee, prizes: t.prizes.map((p) => ({ ...p })),
  })
  formError.value = ''
  editing.value = t.id
}
function addPrize() {
  f.prizes.push({ place: (f.prizes.at(-1)?.place ?? 0) + 1, coins: 0, stars: 0, gift: '' })
}

async function save() {
  formError.value = ''
  if (!f.nameEn.trim() || !f.nameRu.trim()) return (formError.value = 'The name is required in both languages.')
  if (!f.startAt || !f.endAt || new Date(f.endAt) <= new Date(f.startAt)) return (formError.value = 'The end must be after the start.')
  if (!f.prizes.length) return (formError.value = 'Add at least one prize.')
  const places = f.prizes.map((p) => p.place)
  if (new Set(places).size !== places.length) return (formError.value = 'Each place can have only one prize.')
  if (f.prizes.some((p) => !p.coins && !p.stars && !p.gift.trim())) return (formError.value = 'Every prize needs coins, stars or a gift.')
  const body = {
    nameEn: f.nameEn, nameRu: f.nameRu, descEn: f.descEn, descRu: f.descRu, metric: f.metric,
    startAt: new Date(f.startAt).toISOString(), endAt: new Date(f.endAt).toISOString(), entryFee: Number(f.entryFee) || 0,
    prizes: f.prizes.map((p) => ({ place: Number(p.place), coins: Number(p.coins) || 0, stars: Number(p.stars) || 0, gift: p.gift.trim() })),
  }
  const ok = await run(
    () => (editing.value === 'new' ? api.post('/admin/tournaments', body) : api.put(`/admin/tournaments/${editing.value}`, body)),
    editing.value === 'new' ? 'Tournament created' : 'Tournament saved',
  )
  if (ok) {
    editing.value = null
    load(true)
  }
}

const prizeText = (t: T) =>
  t.prizes
    .slice(0, 3)
    .map((p) => `#${p.place}: ${[p.coins && num(p.coins) + '🪙', p.stars && num(p.stars) + '⭐', p.gift].filter(Boolean).join(' ')}`)
    .join(' · ') + (t.prizes.length > 3 ? ` … +${t.prizes.length - 3}` : '')
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Tournaments</h1>
      <span class="grow" />
      <button v-if="canWrite" class="primary" @click="openNew">+ New tournament</button>
    </div>
    <p class="hint">
      Players join for the entry fee (stars) and compete on one metric. When it ends, open it, remove cheaters (disqualify) and press <b>Pay prizes</b>. Payment is a manual decision by finance or a super admin.
    </p>
    <p v-if="error" class="err">{{ error }}</p>

    <div class="card flush">
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Tournament</th><th>Metric</th><th>Runs</th><th class="right">Entry</th><th>Prizes</th><th>Status</th><th /></tr></thead>
          <tbody>
            <tr v-for="t in list" :key="t.id" class="click" @click="router.push(`/tournaments/${t.id}`)">
              <td>{{ t.id }}</td>
              <td><b>{{ t.nameEn ?? t.name }}</b><div class="hint">{{ t.nameRu }}</div></td>
              <td>{{ METRICS[t.metric] ?? t.metric }}</td>
              <td class="nowrap">{{ dateTime(t.startAt) }}<br />→ {{ dateTime(t.endAt) }}</td>
              <td class="right">{{ t.entryFee ? num(t.entryFee) + ' ⭐' : 'free' }}</td>
              <td class="hint">{{ prizeText(t) }}</td>
              <td><span class="badge" :class="tone(t.status)">{{ t.status }}</span></td>
              <td class="right" @click.stop>
                <button v-if="canWrite && t.status !== 'PAID' && t.status !== 'CANCELLED'" class="sm" @click="openEdit(t)">Edit</button>
              </td>
            </tr>
            <tr v-if="!list.length && !loading"><td colspan="8" class="empty">No tournaments yet.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <Modal v-if="editing !== null" :title="editing === 'new' ? 'New tournament' : 'Edit tournament'" wide @close="editing = null">
      <p v-if="locked" class="hint" style="margin-top: 0">It has started: only the texts and the prizes can change.</p>
      <div class="grid c2">
        <label class="field">Name (English)<input v-model="f.nameEn" maxlength="120" /></label>
        <label class="field">Name (Russian)<input v-model="f.nameRu" maxlength="120" /></label>
        <label class="field">Description (English)<textarea v-model="f.descEn" maxlength="500" /></label>
        <label class="field">Description (Russian)<textarea v-model="f.descRu" maxlength="500" /></label>
        <label class="field">Metric
          <select v-model="f.metric" :disabled="locked"><option v-for="(l, k) in METRICS" :key="k" :value="k">{{ l }}</option></select>
        </label>
        <label class="field">Entry fee (stars, 0 = free)<input v-model.number="f.entryFee" type="number" min="0" :disabled="locked" /></label>
        <label class="field">Starts (your local time)<input v-model="f.startAt" type="datetime-local" :disabled="locked" /></label>
        <label class="field">Ends<input v-model="f.endAt" type="datetime-local" :disabled="locked" /></label>
      </div>

      <h3 class="mt">Prizes</h3>
      <table>
        <thead><tr><th>Place</th><th>Coins</th><th>Stars</th><th>Gift key</th><th /></tr></thead>
        <tbody>
          <tr v-for="(p, k) in f.prizes" :key="k">
            <td><input v-model.number="p.place" type="number" min="1" max="100" style="width: 70px" /></td>
            <td><input v-model.number="p.coins" type="number" min="0" style="width: 110px" /></td>
            <td><input v-model.number="p.stars" type="number" min="0" style="width: 110px" /></td>
            <td><input v-model="p.gift" maxlength="40" placeholder="optional" style="width: 150px" /></td>
            <td><button class="sm danger" :disabled="f.prizes.length < 2" @click="f.prizes.splice(k, 1)">✕</button></td>
          </tr>
        </tbody>
      </table>
      <button class="sm" style="margin-top: 8px" @click="addPrize">+ Add a place</button>
      <p class="hint">A gift prize is delivered like any other gift: it lands in the winner's collection.</p>

      <p v-if="formError" class="err">{{ formError }}</p>
      <div class="actions">
        <button @click="editing = null">Cancel</button>
        <button class="primary" :disabled="busy" @click="save">Save</button>
      </div>
    </Modal>
  </div>
</template>

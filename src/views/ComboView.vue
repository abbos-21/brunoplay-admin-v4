<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { useBusy, useLoader } from '@/composables/useBusy'
import { num, utcDay } from '@/composables/format'
import Modal from '@/components/Modal.vue'
import hat from '@/assets/combo/hat.webp'
import fish from '@/assets/combo/fish.webp'
import net from '@/assets/combo/net.webp'
import boots from '@/assets/combo/boots.webp'
import boat from '@/assets/combo/boat.webp'
import bucket from '@/assets/combo/bucket.webp'
import backpack from '@/assets/combo/backpack.webp'
import rod from '@/assets/combo/rod.webp'

interface Img { id: number; name: string; nameEn?: string; nameRu?: string; icon: string; active?: boolean }
interface Day { day: string; items: number[]; source: string; attempters: number; avgBest: number; claimed: number }

const auth = useAuth()
const { busy, run } = useBusy()
const canWrite = computed(() => auth.can('combo.write'))

const images = useLoader(() => api.get<{ images: Img[] | null }>('/admin/combo/images'))
const from = ref(utcDay(new Date(Date.now() - 7 * 86400_000)))
const to = ref(utcDay(new Date(Date.now() + 30 * 86400_000)))
const patterns = useLoader(() => api.get<{ patterns: Day[] | null }>('/admin/combo/patterns', { from: from.value, to: to.value }))

onMounted(() => {
  images.load()
  patterns.load()
})
const imgs = computed(() => images.data.value?.images ?? [])
const byId = computed(() => new Map(imgs.value.map((i) => [i.id, i])))
const days = computed(() => patterns.data.value?.patterns ?? [])
const today = utcDay(new Date())

const isUrl = (s: string) => /^(https?:)?\/\/|^\//.test(s)
// the artwork the game itself shows for the built-in pictures (a picture added later can use an image link instead)
const ART: Record<number, string> = { 1: hat, 2: fish, 3: net, 4: boots, 5: boat, 6: bucket, 7: backpack, 8: rod }
const artOf = (i?: Img) => (i ? (ART[i.id] ?? (isUrl(i.icon) ? i.icon : '')) : '')

// ---- patterns
const editDay = ref('')
const slots = ref<number[]>([0, 0, 0, 0])
const slotError = computed(() => {
  if (slots.value.some((x) => !x)) return 'Choose a picture for every slot.'
  if (new Set(slots.value).size !== slots.value.length) return 'Pictures cannot repeat inside one pattern.'
  return ''
})
function openDay(d: Day) {
  editDay.value = d.day
  slots.value = d.items.length === 4 ? [...d.items] : [0, 0, 0, 0]
}
function openNewDay() {
  const next = new Date(Date.now() + 86400_000)
  const taken = new Set(days.value.map((d) => d.day))
  while (taken.has(utcDay(next))) next.setUTCDate(next.getUTCDate() + 1)
  editDay.value = utcDay(next)
  slots.value = [0, 0, 0, 0]
}
async function savePattern() {
  if (slotError.value) return
  if (await run(() => api.put(`/admin/combo/patterns/${editDay.value}`, { items: slots.value }), `Pattern for ${editDay.value} saved`)) {
    editDay.value = ''
    patterns.load(true)
  }
}
async function removePattern(d: string) {
  if (await run(() => api.del(`/admin/combo/patterns/${d}`), 'Pattern removed (the server will pick one at random that day)')) patterns.load(true)
}

// ---- pictures
const pic = ref<Img | null>(null)
const picForm = ref({ nameEn: '', nameRu: '', icon: '', active: true })
function openPic(i: Img) {
  pic.value = i
  picForm.value = { nameEn: i.nameEn ?? i.name, nameRu: i.nameRu ?? '', icon: i.icon, active: i.active !== false }
}
async function savePic() {
  const i = pic.value
  if (!i) return
  if (await run(() => api.patch(`/admin/combo/images/${i.id}`, picForm.value), 'Picture saved')) {
    pic.value = null
    images.load(true)
  }
}
const activeCount = computed(() => imgs.value.filter((i) => i.active !== false).length)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Daily combo</h1>
      <span class="grow" />
      <button v-if="canWrite" class="primary" @click="openNewDay">+ Schedule a day</button>
    </div>
    <p class="hint">
      Each game day (UTC) has one secret pattern of 4 different pictures, the same for every player. If a day has no scheduled pattern the server draws one at random.
      A day that has started cannot be changed. The pattern is never sent to the app.
    </p>

    <div class="card flush mb">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Day (UTC)</th><th>Pattern</th><th>Source</th><th class="right">Players tried</th><th class="right">Average best</th><th class="right">Claimed</th><th /></tr></thead>
          <tbody>
            <tr v-for="d in days" :key="d.day" :style="d.day === today ? 'background:#fffbea' : ''">
              <td class="nowrap"><b>{{ d.day }}</b> <span v-if="d.day === today" class="badge info">today</span></td>
              <td>
                <span v-for="(id, k) in d.items" :key="k" style="margin-right: 8px">
                  <img v-if="artOf(byId.get(id))" :src="artOf(byId.get(id))" :alt="byId.get(id)?.nameEn" :title="byId.get(id)?.nameEn" style="height: 34px; vertical-align: middle" />
                  <template v-else>{{ byId.get(id)?.icon ?? '#' + id }}</template>
                </span>
              </td>
              <td><span class="badge" :class="d.source === 'admin' ? 'info' : ''">{{ d.source }}</span></td>
              <td class="right">{{ num(d.attempters) }}</td>
              <td class="right">{{ d.attempters ? num(d.avgBest) + ' / 4' : '—' }}</td>
              <td class="right">{{ num(d.claimed) }}</td>
              <td class="nowrap right">
                <template v-if="canWrite && d.day > today">
                  <button class="sm" :disabled="busy" @click="openDay(d)">Edit</button>
                  <button v-if="d.source === 'admin'" class="sm danger" :disabled="busy" @click="removePattern(d.day)">Remove</button>
                </template>
              </td>
            </tr>
            <tr v-if="!days.length && !patterns.loading.value"><td colspan="7" class="empty">No pattern has been created yet; they appear when days start.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <h2>Pictures <span class="muted">({{ activeCount }} active, the pattern draws from these)</span></h2>
    <div class="grid c4">
      <div v-for="i in imgs" :key="i.id" class="card" :style="{ opacity: i.active === false ? 0.5 : 1 }">
        <div style="font-size: 34px; line-height: 1.2; height: 44px">
          <img v-if="artOf(i)" :src="artOf(i)" :alt="i.nameEn ?? i.name" style="height: 40px" />
          <template v-else>{{ i.icon }}</template>
        </div>
        <b>{{ i.nameEn ?? i.name }}</b>
        <div class="muted">{{ i.nameRu }}</div>
        <div class="row" style="margin-top: 8px">
          <span v-if="i.active === false" class="badge">off</span>
          <button v-if="canWrite" class="sm" @click="openPic(i)">Edit</button>
        </div>
      </div>
    </div>

    <Modal v-if="editDay" :title="`Pattern for ${editDay}`" @close="editDay = ''">
      <label v-if="!days.some((d) => d.day === editDay)" class="field" style="margin-bottom: 12px">
        Day (UTC, in the future)
        <input v-model="editDay" type="date" :min="utcDay(new Date(Date.now() + 86400_000))" />
      </label>
      <div class="col">
        <label v-for="(_, k) in slots" :key="k" class="field">
          Slot {{ k + 1 }}
          <span class="row">
            <span style="width: 44px; height: 40px; display: inline-flex; align-items: center; justify-content: center">
              <img v-if="artOf(byId.get(slots[k]!))" :src="artOf(byId.get(slots[k]!))" style="max-height: 40px; max-width: 44px" />
            </span>
            <select v-model.number="slots[k]" class="grow">
              <option :value="0" disabled>Choose…</option>
              <option v-for="i in imgs.filter((x) => x.active !== false)" :key="i.id" :value="i.id">{{ i.nameEn ?? i.name }}</option>
            </select>
          </span>
        </label>
      </div>
      <p v-if="slotError" class="err">{{ slotError }}</p>
      <div class="actions">
        <button @click="editDay = ''">Cancel</button>
        <button class="primary" :disabled="busy || !!slotError || editDay <= today" @click="savePattern">Save</button>
      </div>
    </Modal>

    <Modal v-if="pic" title="Edit picture" @close="pic = null">
      <div class="col">
        <label class="field">Name (English)<input v-model="picForm.nameEn" maxlength="60" /></label>
        <label class="field">Name (Russian)<input v-model="picForm.nameRu" maxlength="60" /></label>
        <label class="field">Icon (an emoji or an image link)<input v-model="picForm.icon" maxlength="500" /></label>
        <label class="row"><input v-model="picForm.active" type="checkbox" /> Active (can appear in the picture pool)</label>
      </div>
      <p class="hint">Keep at least 8 active pictures so players have enough to choose from.</p>
      <div class="actions">
        <button @click="pic = null">Cancel</button>
        <button class="primary" :disabled="busy" @click="savePic">Save</button>
      </div>
    </Modal>
  </div>
</template>

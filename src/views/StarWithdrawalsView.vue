<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { useBusy } from '@/composables/useBusy'
import { copyText, dateTime, num, tone } from '@/composables/format'
import { useToast } from '@/composables/useToast'
import ReasonModal from '@/components/ReasonModal.vue'

interface Row {
  id: number
  stars: number
  status: string
  rejectReason?: string
  createdAt: string
  processedAt: string | null
  playerId: number
  username: string
  telegramId: number
}

const auth = useAuth()
const toast = useToast()
const { busy, run } = useBusy()

const status = ref('PENDING')
const rows = ref<Row[]>([])
const loading = ref(false)
const more = ref(false)
const PAGE = 50

async function load(append = false) {
  loading.value = true
  try {
    const before = append && rows.value.length ? rows.value[rows.value.length - 1].id : 0
    const r = await api.get<{ withdrawals: Row[] | null }>('/admin/star-withdrawals', { status: status.value, before, limit: PAGE })
    const l = r.withdrawals ?? []
    rows.value = append ? [...rows.value, ...l] : l
    more.value = l.length === PAGE
  } catch (e) {
    toast.error(e)
  } finally {
    loading.value = false
  }
}
onMounted(() => load())
watch(status, () => load())
const canWrite = computed(() => auth.can('withdrawals.write'))

async function deliver(w: Row) {
  if (await run(() => api.post(`/admin/star-withdrawals/${w.id}/deliver`), 'Marked as delivered. The player is told.')) rows.value = rows.value.filter((x) => x.id !== w.id)
}

const cancelling = ref<Row | null>(null)
async function cancel(reason: string) {
  const w = cancelling.value
  if (!w) return
  if (await run(() => api.post(`/admin/star-withdrawals/${w.id}/cancel`, { reason }), 'Cancelled, the stars went back to the player. The player is told.')) {
    cancelling.value = null
    rows.value = rows.value.filter((x) => x.id !== w.id)
  }
}
async function copy(s: string) {
  toast.ok((await copyText(s)) ? 'Copied' : 'Could not copy')
}
const total = computed(() => rows.value.reduce((a, w) => a + w.stars, 0))
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Star withdrawals</h1>
      <span class="grow" />
      <select v-model="status">
        <option value="PENDING">Waiting</option>
        <option value="DELIVERED">Delivered</option>
        <option value="CANCELLED">Cancelled</option>
      </select>
      <button @click="load()">Refresh</button>
    </div>
    <p class="hint">
      A player asked to take game stars out as real Telegram Stars (the stars were already taken from their game balance). Open their chat with the button below,
      send them the Stars, then press <b>Delivered</b>. If you cannot, press <b>Cancel</b> with a reason: the stars return to their game balance and they are told why.
      Requests should be checked within 24 hours. The rules (minimum, level, limits, notice) are in Settings → withdrawal, the <b>starwd.*</b> keys.
    </p>
    <p v-if="status === 'PENDING' && rows.length" class="hint"><b>{{ rows.length }}</b> waiting, <b>{{ num(total) }} ⭐</b> in total.</p>

    <div class="card flush">
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Stars</th><th>Player</th><th>Telegram</th><th>Requested</th><th>Status</th><th /></tr></thead>
          <tbody>
            <tr v-for="w in rows" :key="w.id">
              <td>{{ w.id }}</td>
              <td><b>{{ num(w.stars) }} ⭐</b></td>
              <td><RouterLink :to="`/players/${w.playerId}`">{{ w.username ? '@' + w.username : '#' + w.playerId }}</RouterLink></td>
              <td class="nowrap">
                <a :href="w.username ? `https://t.me/${w.username}` : `tg://user?id=${w.telegramId}`" target="_blank" rel="noopener">Open chat</a>
                <button class="sm ghost" @click="copy(String(w.telegramId))">Copy id</button>
              </td>
              <td class="nowrap">{{ dateTime(w.createdAt) }}</td>
              <td>
                <span class="badge" :class="tone(w.status)">{{ w.status }}</span>
                <div v-if="w.rejectReason" class="hint">{{ w.rejectReason }}</div>
              </td>
              <td class="nowrap right">
                <template v-if="canWrite && w.status === 'PENDING'">
                  <button class="sm primary" :disabled="busy" @click="deliver(w)">Delivered</button>
                  <button class="sm danger" :disabled="busy" @click="cancelling = w">Cancel</button>
                </template>
              </td>
            </tr>
            <tr v-if="!rows.length && !loading"><td colspan="7" class="empty">Nothing here.</td></tr>
          </tbody>
        </table>
      </div>
      <div v-if="more" class="pager"><button :disabled="loading" @click="load(true)">Load more</button></div>
    </div>

    <ReasonModal v-if="cancelling" title="Cancel this star withdrawal" text="The stars go back to the player's game balance and they see this reason." confirm-text="Cancel withdrawal" danger :busy="busy" @confirm="cancel" @close="cancelling = null" />
  </div>
</template>

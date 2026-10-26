<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { useBusy } from '@/composables/useBusy'
import { copyText, dateTime, num, tone } from '@/composables/format'
import { useToast } from '@/composables/useToast'
import ReasonModal from '@/components/ReasonModal.vue'

interface Claim {
  id: number
  gift: string
  name: string
  starValue: number
  status: string
  source: string
  rejectReason?: string
  createdAt: string
  claimRequestedAt: string | null
  deliveredAt: string | null
  playerId: number
  username: string
  telegramId: number
}

const auth = useAuth()
const toast = useToast()
const { busy, run } = useBusy()

const status = ref('CLAIM_REQUESTED')
const rows = ref<Claim[]>([])
const loading = ref(false)
const more = ref(false)
const PAGE = 50

async function load(append = false) {
  loading.value = true
  try {
    const before = append && rows.value.length ? rows.value[rows.value.length - 1].id : 0
    const r = await api.get<{ claims: Claim[] | null }>('/admin/gifts/claims', { status: status.value, before, limit: PAGE })
    const l = r.claims ?? []
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
const canWrite = computed(() => auth.can('gifts.write'))

async function deliver(c: Claim) {
  if (await run(() => api.post(`/admin/gifts/${c.id}/deliver`), 'Marked as delivered. The player is told.')) rows.value = rows.value.filter((x) => x.id !== c.id)
}

const rejecting = ref<Claim | null>(null)
async function reject(reason: string) {
  const c = rejecting.value
  if (!c) return
  if (await run(() => api.post(`/admin/gifts/${c.id}/reject`, { reason }), 'Sent back to the collection. The player is told.')) {
    rejecting.value = null
    rows.value = rows.value.filter((x) => x.id !== c.id)
  }
}
async function copy(s: string) {
  toast.ok((await copyText(s)) ? 'Copied' : 'Could not copy')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Gift claims</h1>
      <span class="grow" />
      <select v-model="status">
        <option value="CLAIM_REQUESTED">Waiting for delivery</option>
        <option value="DELIVERED">Delivered</option>
        <option value="OWNED">In collections</option>
        <option value="SOLD">Sold for stars</option>
      </select>
      <button @click="load()">Refresh</button>
    </div>
    <p class="hint">
      Send the real Telegram gift to the player (open their profile with the button below), then press <b>Delivered</b>. If you cannot send it, press <b>Reject</b> with a reason:
      the gift returns to their collection, where they can still sell it for stars.
    </p>

    <div class="card flush">
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Gift</th><th>Player</th><th>Telegram</th><th>Requested</th><th>Status</th><th /></tr></thead>
          <tbody>
            <tr v-for="c in rows" :key="c.id">
              <td>{{ c.id }}</td>
              <td><b>{{ c.name }}</b> <span class="muted">· {{ num(c.starValue) }} ⭐ · {{ c.source }}</span></td>
              <td><RouterLink :to="`/players/${c.playerId}`">{{ c.username ? '@' + c.username : '#' + c.playerId }}</RouterLink></td>
              <td class="nowrap">
                <a :href="c.username ? `https://t.me/${c.username}` : `tg://user?id=${c.telegramId}`" target="_blank" rel="noopener">Open chat</a>
                <button class="sm ghost" @click="copy(String(c.telegramId))">Copy id</button>
              </td>
              <td class="nowrap">{{ dateTime(c.claimRequestedAt ?? c.createdAt) }}</td>
              <td>
                <span class="badge" :class="tone(c.status)">{{ c.status }}</span>
                <div v-if="c.rejectReason" class="hint">{{ c.rejectReason }}</div>
              </td>
              <td class="nowrap right">
                <template v-if="canWrite && c.status === 'CLAIM_REQUESTED'">
                  <button class="sm primary" :disabled="busy" @click="deliver(c)">Delivered</button>
                  <button class="sm danger" :disabled="busy" @click="rejecting = c">Reject</button>
                </template>
              </td>
            </tr>
            <tr v-if="!rows.length && !loading"><td colspan="7" class="empty">Nothing here.</td></tr>
          </tbody>
        </table>
      </div>
      <div v-if="more" class="pager"><button :disabled="loading" @click="load(true)">Load more</button></div>
    </div>

    <ReasonModal v-if="rejecting" title="Reject this gift claim" text="The gift goes back to the player's collection and they see this reason." confirm-text="Reject" danger :busy="busy" @confirm="reject" @close="rejecting = null" />
  </div>
</template>

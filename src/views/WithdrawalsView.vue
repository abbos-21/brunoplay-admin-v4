<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { useBusy } from '@/composables/useBusy'
import { copyText, dateTime, num, tone, tonNano } from '@/composables/format'
import { useToast } from '@/composables/useToast'
import Modal from '@/components/Modal.vue'

interface Wd {
  id: number
  playerId: number
  amountCoins: number
  amountTon: string
  amountNano: number
  feeNano: number
  targetAddress: string
  status: string
  txHash: string | null
  auto?: boolean
  needsReview?: boolean
  failReason?: string
  createdAt: string
  processedAt: string | null
}

const auth = useAuth()
const toast = useToast()
const { busy, run } = useBusy()

const status = ref('PENDING')
const rows = ref<Wd[]>([])
const loading = ref(false)
const more = ref(false)
const PAGE = 50

async function load(append = false) {
  loading.value = true
  try {
    const before = append && rows.value.length ? rows.value[rows.value.length - 1].id : 0
    const r = await api.get<{ withdrawals: Wd[] }>('/admin/withdrawals', { status: status.value, before, limit: PAGE })
    rows.value = append ? [...rows.value, ...r.withdrawals] : r.withdrawals
    more.value = r.withdrawals.length === PAGE
  } catch (e) {
    toast.error(e)
  } finally {
    loading.value = false
  }
}
onMounted(() => load())
watch(status, () => load())

const canWrite = computed(() => auth.can('withdrawals.write'))

function replace(w: Wd) {
  const i = rows.value.findIndex((x) => x.id === w.id)
  if (i >= 0) {
    if (status.value && status.value !== w.status) rows.value.splice(i, 1)
    else rows.value[i] = w
  }
}

async function processing(w: Wd) {
  const r = await run(() => api.post<Wd>(`/admin/withdrawals/${w.id}/processing`), `Withdrawal #${w.id} marked as being paid`)
  if (r) replace(r)
}

const completing = ref<Wd | null>(null)
const txHash = ref('')
async function complete() {
  const w = completing.value
  if (!w) return
  const r = await run(() => api.post<Wd>(`/admin/withdrawals/${w.id}/complete`, { txHash: txHash.value.trim() }), `Withdrawal #${w.id} completed`)
  if (r) {
    replace(r)
    completing.value = null
    txHash.value = ''
  }
}

const rejecting = ref<Wd | null>(null)
const reason = ref('')
const force = ref(false)
async function reject() {
  const w = rejecting.value
  if (!w) return
  const r = await run(() => api.post<Wd>(`/admin/withdrawals/${w.id}/reject`, { reason: reason.value.trim(), force: force.value }), `Withdrawal #${w.id} rejected, coins returned`)
  if (r) {
    replace(r)
    rejecting.value = null
    reason.value = ''
    force.value = false
  }
}

async function copy(s: string) {
  toast.ok((await copyText(s)) ? 'Copied' : 'Could not copy')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Withdrawals</h1>
      <span class="grow" />
      <select v-model="status">
        <option value="PENDING">Waiting</option>
        <option value="PROCESSING">Being paid</option>
        <option value="COMPLETED">Completed</option>
        <option value="REJECTED">Rejected</option>
        <option value="">All</option>
      </select>
      <button @click="load()">Refresh</button>
    </div>

    <p class="hint">
      Pay manually: copy the address, send the TON from your wallet, then press <b>Complete</b> with the transaction hash. <b>Reject</b> returns the coins to the player.
      A row marked <span class="badge bad">needs review</span> is an automatic payout whose result is unclear: look at the payout wallet history before doing anything.
    </p>

    <div class="card flush">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Player</th><th class="right">Coins</th><th class="right">TON to send</th><th>Address</th><th>Status</th><th>Created</th><th /></tr>
          </thead>
          <tbody>
            <tr v-for="w in rows" :key="w.id">
              <td>{{ w.id }}</td>
              <td><RouterLink :to="`/players/${w.playerId}`">#{{ w.playerId }}</RouterLink></td>
              <td class="right">{{ num(w.amountCoins) }}</td>
              <td class="right">
                {{ w.amountTon }} <span class="muted">(fee {{ tonNano(w.feeNano) }})</span>
              </td>
              <td>
                <code>{{ w.targetAddress.slice(0, 8) }}…{{ w.targetAddress.slice(-6) }}</code>
                <button class="sm ghost" @click="copy(w.targetAddress)">Copy</button>
              </td>
              <td>
                <span class="badge" :class="tone(w.status)">{{ w.status }}</span>
                <span v-if="w.auto" class="badge info" title="paid by the server">auto</span>
                <span v-if="w.needsReview" class="badge bad">needs review</span>
                <div v-if="w.failReason" class="hint">{{ w.failReason }}</div>
                <div v-if="w.txHash" class="hint mono">{{ w.txHash.slice(0, 14) }}…</div>
              </td>
              <td class="nowrap">{{ dateTime(w.createdAt) }}</td>
              <td class="nowrap right">
                <template v-if="canWrite && (w.status === 'PENDING' || w.status === 'PROCESSING')">
                  <button v-if="w.status === 'PENDING'" class="sm" :disabled="busy" @click="processing(w)">Start paying</button>
                  <button class="sm primary" :disabled="busy" @click="((completing = w), (txHash = ''))">Complete</button>
                  <button class="sm danger" :disabled="busy" @click="((rejecting = w), (reason = ''), (force = false))">Reject</button>
                </template>
              </td>
            </tr>
            <tr v-if="!rows.length && !loading"><td colspan="8" class="empty">Nothing here.</td></tr>
          </tbody>
        </table>
      </div>
      <div v-if="more" class="pager"><button :disabled="loading" @click="load(true)">Load more</button></div>
    </div>

    <Modal v-if="completing" :title="`Complete withdrawal #${completing.id}`" @close="completing = null">
      <p class="muted" style="margin-top: 0">
        You sent <b>{{ completing.amountTon }} TON</b> to <code>{{ completing.targetAddress }}</code>. Paste the transaction hash as proof.
      </p>
      <label class="field">Transaction hash<input v-model="txHash" class="mono" autofocus /></label>
      <div class="actions">
        <button @click="completing = null">Cancel</button>
        <button class="primary" :disabled="busy || txHash.trim().length < 8" @click="complete">Mark as paid</button>
      </div>
    </Modal>

    <Modal v-if="rejecting" :title="`Reject withdrawal #${rejecting.id}`" @close="rejecting = null">
      <p class="muted" style="margin-top: 0">{{ num(rejecting.amountCoins) }} coins go back to the player and they are told the reason.</p>
      <label class="field">Reason<textarea v-model="reason" autofocus /></label>
      <label v-if="rejecting.needsReview" class="row" style="margin-top: 10px">
        <input v-model="force" type="checkbox" />
        <span class="err">I checked the payout wallet and I am sure nothing was sent (required for a payout that needs review).</span>
      </label>
      <div class="actions">
        <button @click="rejecting = null">Cancel</button>
        <button class="danger" :disabled="busy || reason.trim().length < 3 || (rejecting.needsReview && !force)" @click="reject">Reject and return coins</button>
      </div>
    </Modal>
  </div>
</template>

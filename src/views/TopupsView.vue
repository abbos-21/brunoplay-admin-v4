<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { useBusy } from '@/composables/useBusy'
import { dateTime, num, tone } from '@/composables/format'
import { useToast } from '@/composables/useToast'
import ReasonModal from '@/components/ReasonModal.vue'
import Modal from '@/components/Modal.vue'

interface Order {
  id: string
  playerId: number
  username: string
  method: string
  status: string
  stars: number
  bonusStars: number
  price: number
  paidAmount: number
  note: string
  createdAt: string
  paidAt: string | null
}

const auth = useAuth()
const toast = useToast()
const { busy, run } = useBusy()

const status = ref('')
const rows = ref<Order[]>([])
const loading = ref(false)
const more = ref(false)
const PAGE = 50

async function load(append = false) {
  loading.value = true
  try {
    const before = append && rows.value.length ? new Date(rows.value[rows.value.length - 1].createdAt).getTime() : 0
    const r = await api.get<{ orders: Order[] | null }>('/admin/topup/orders', { status: status.value, before, limit: PAGE })
    const l = r.orders ?? []
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

const canWrite = computed(() => auth.can('payments.write'))

const crediting = ref<Order | null>(null)
async function credit(reason: string) {
  const o = crediting.value
  if (!o) return
  if (await run(() => api.post(`/admin/topup/orders/${o.id}/credit`, { reason }), 'Stars credited')) {
    crediting.value = null
    load()
  }
}

const refunding = ref<Order | null>(null)
async function refund() {
  const o = refunding.value
  if (!o) return
  if (await run(() => api.post(`/admin/topup/orders/${o.id}/refund`), 'Refund sent')) {
    refunding.value = null
    load()
  }
}

const unit = (o: Order) => (o.method === 'TON' ? 'nanoTON' : 'Telegram Stars')
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Star top-ups</h1>
      <span class="grow" />
      <select v-model="status">
        <option value="">All</option>
        <option value="PENDING">Unpaid</option>
        <option value="PAID">Paid</option>
        <option value="EXPIRED">Expired</option>
        <option value="REFUNDED">Refunded</option>
      </select>
      <button @click="load()">Refresh</button>
    </div>
    <p class="hint">
      Telegram payments are credited automatically. A TON order is credited when the transfer is found on the chain; if a player paid but
      nothing was credited, check the wallet and use <b>Credit</b>. <b>Refund</b> returns a Telegram payment and takes the stars back.
    </p>

    <div class="card flush">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Order</th><th>Player</th><th>Method</th><th class="right">Stars (+bonus)</th><th class="right">Price</th><th>Status</th><th>Created</th><th /></tr>
          </thead>
          <tbody>
            <tr v-for="o in rows" :key="o.id">
              <td><code>{{ o.id.slice(0, 8) }}</code></td>
              <td><RouterLink :to="`/players/${o.playerId}`">{{ o.username ? '@' + o.username : '#' + o.playerId }}</RouterLink></td>
              <td>{{ o.method }}</td>
              <td class="right">{{ num(o.stars) }} <span class="muted">+{{ num(o.bonusStars) }}</span></td>
              <td class="right">{{ num(o.price) }} <span class="muted">{{ unit(o) }}</span></td>
              <td>
                <span class="badge" :class="tone(o.status)">{{ o.status }}</span>
                <div v-if="o.note" class="hint">{{ o.note }}</div>
              </td>
              <td class="nowrap">{{ dateTime(o.createdAt) }}<div v-if="o.paidAt" class="hint">paid {{ dateTime(o.paidAt) }}</div></td>
              <td class="nowrap right">
                <template v-if="canWrite">
                  <button v-if="o.status === 'PENDING' || o.status === 'EXPIRED'" class="sm" :disabled="busy" @click="crediting = o">Credit</button>
                  <button v-if="o.status === 'PAID' && o.method === 'TG_STARS'" class="sm danger" :disabled="busy" @click="refunding = o">Refund</button>
                </template>
              </td>
            </tr>
            <tr v-if="!rows.length && !loading"><td colspan="8" class="empty">No orders.</td></tr>
          </tbody>
        </table>
      </div>
      <div v-if="more" class="pager"><button :disabled="loading" @click="load(true)">Load more</button></div>
    </div>

    <ReasonModal
      v-if="crediting"
      title="Credit stars manually"
      :text="`Gives ${num(crediting.stars + crediting.bonusStars)} stars to the player of this order. Use it only after you saw the payment yourself.`"
      confirm-text="Credit stars"
      :busy="busy"
      @confirm="credit"
      @close="crediting = null"
    />
    <Modal v-if="refunding" title="Refund this payment?" @close="refunding = null">
      <p class="muted" style="margin-top: 0">
        Telegram returns {{ num(refunding.price) }} Stars to the player. The stars are taken back and the account is put on hold if they were already spent.
      </p>
      <div class="actions">
        <button @click="refunding = null">Cancel</button>
        <button class="danger" :disabled="busy" @click="refund">Refund</button>
      </div>
    </Modal>
  </div>
</template>

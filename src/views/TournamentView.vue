<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { api } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { useBusy, useLoader } from '@/composables/useBusy'
import { dateTime, num, tone } from '@/composables/format'
import { METRICS, type Prize } from '@/composables/tournament'
import Modal from '@/components/Modal.vue'

interface T {
  id: number
  name: string
  nameEn?: string
  metric: string
  startAt: string
  endAt: string
  entryFee: number
  prizes: Prize[]
  status: string
  paidAt?: string
}
interface Row { rank: number; playerId: number; username: string; score: number; disqualified: boolean; blocked: boolean; riskScore: number; flags: unknown }
interface Payout { playerId: number; place: number; score: number; coins: number; stars: number; gift: string }

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const { busy, run } = useBusy()
const id = Number(route.params.id)

const { data, loading, error, load } = useLoader(() => api.get<{ tournament: T; entries: Row[] | null }>(`/admin/tournaments/${id}/review`, { limit: 200 }))
onMounted(load)
const t = computed(() => data.value?.tournament)
const rows = computed(() => data.value?.entries ?? [])
const canWrite = computed(() => auth.can('tournaments.write'))
const canPay = computed(() => auth.can('payouts.tournament'))

const prizeFor = (rank: number) => t.value?.prizes.find((p) => p.place === rank)
const prizeLabel = (p?: Prize) => (p ? [p.coins && num(p.coins) + ' 🪙', p.stars && num(p.stars) + ' ⭐', p.gift].filter(Boolean).join(' + ') : '')

async function dq(r: Row, on: boolean) {
  if (await run(() => api.post(`/admin/tournaments/${id}/disqualify`, { playerId: r.playerId, on }), on ? 'Disqualified' : 'Reinstated')) load(true)
}

const paying = ref(false)
const payouts = ref<Payout[] | null>(null)
async function pay() {
  const r = await run(() => api.post<{ payouts: Payout[] | null }>(`/admin/tournaments/${id}/pay`), 'Prizes paid')
  if (r) {
    paying.value = false
    payouts.value = r.payouts ?? []
    load(true)
  }
}

const cancelling = ref(false)
async function cancel() {
  const r = await run(() => api.post<{ refunded: number }>(`/admin/tournaments/${id}/cancel`))
  if (r) {
    cancelling.value = false
    load(true)
  }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <button class="sm" @click="router.push('/tournaments')">← Tournaments</button>
      <h1>{{ t?.nameEn ?? t?.name ?? 'Tournament' }}</h1>
      <span v-if="t" class="badge" :class="tone(t.status)">{{ t.status }}</span>
      <span class="grow" />
      <template v-if="t">
        <button v-if="canPay && t.status === 'ENDED'" class="primary" :disabled="busy" @click="paying = true">Pay prizes</button>
        <button v-if="canWrite && (t.status === 'SCHEDULED' || t.status === 'ACTIVE' || t.status === 'ENDED')" class="danger" :disabled="busy" @click="cancelling = true">Cancel and refund</button>
      </template>
    </div>
    <p v-if="error" class="err">{{ error }}</p>
    <p v-if="loading && !data" class="muted">Loading…</p>

    <template v-if="t">
      <div class="card mb">
        <dl class="kv">
          <dt>Metric</dt><dd>{{ METRICS[t.metric] ?? t.metric }}</dd>
          <dt>Runs</dt><dd>{{ dateTime(t.startAt) }} → {{ dateTime(t.endAt) }}</dd>
          <dt>Entry fee</dt><dd>{{ t.entryFee ? num(t.entryFee) + ' ⭐' : 'free' }}</dd>
          <dt>Prizes</dt>
          <dd><span v-for="p in t.prizes" :key="p.place" class="badge" style="margin: 0 6px 4px 0">#{{ p.place }} {{ prizeLabel(p) }}</span></dd>
          <dt v-if="t.paidAt">Paid</dt><dd v-if="t.paidAt">{{ dateTime(t.paidAt) }}</dd>
        </dl>
        <p v-if="t.status === 'ENDED'" class="hint" style="margin-bottom: 0">
          The tournament is over. Check the table (risk score and signals are shown), disqualify anyone who cheated — disqualified players are skipped and the places move up — then pay.
        </p>
      </div>

      <div v-if="payouts" class="card mb" style="border-color: var(--ok)">
        <h2>Paid</h2>
        <table>
          <thead><tr><th>Place</th><th>Player</th><th class="right">Score</th><th>Prize</th></tr></thead>
          <tbody>
            <tr v-for="p in payouts" :key="p.playerId"><td>#{{ p.place }}</td><td><RouterLink :to="`/players/${p.playerId}`">#{{ p.playerId }}</RouterLink></td><td class="right">{{ num(p.score) }}</td><td>{{ prizeLabel(p) }}</td></tr>
          </tbody>
        </table>
      </div>

      <div class="card flush">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Rank</th><th>Player</th><th class="right">Score</th><th>Prize</th><th>Risk</th><th /></tr></thead>
            <tbody>
              <tr v-for="r in rows" :key="r.playerId" :style="{ opacity: r.disqualified ? 0.5 : 1 }">
                <td><b>{{ r.disqualified ? '—' : r.rank }}</b></td>
                <td>
                  <RouterLink :to="`/players/${r.playerId}`">{{ r.username ? '@' + r.username : '#' + r.playerId }}</RouterLink>
                  <span v-if="r.blocked" class="badge bad">blocked</span>
                  <span v-if="r.disqualified" class="badge bad">disqualified</span>
                </td>
                <td class="right">{{ num(r.score) }}</td>
                <td>{{ r.disqualified ? '' : prizeLabel(prizeFor(r.rank)) }}</td>
                <td>
                  <span :class="r.riskScore >= 50 ? 'err' : 'muted'">{{ r.riskScore }}</span>
                  <template v-if="Array.isArray(r.flags)"><span v-for="f in r.flags as string[]" :key="f" class="badge warn" style="margin-left: 4px">{{ f }}</span></template>
                </td>
                <td class="right">
                  <template v-if="canWrite && t.status !== 'PAID' && t.status !== 'CANCELLED'">
                    <button v-if="!r.disqualified" class="sm danger" :disabled="busy" @click="dq(r, true)">Disqualify</button>
                    <button v-else class="sm" :disabled="busy" @click="dq(r, false)">Reinstate</button>
                  </template>
                </td>
              </tr>
              <tr v-if="!rows.length && !loading"><td colspan="6" class="empty">Nobody joined.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <Modal v-if="paying" title="Pay the prizes now?" @close="paying = false">
      <p style="margin-top: 0">
        Coins and stars go to the winners immediately and gifts land in their collections. Each player is told by the bot. This can only be done once.
      </p>
      <div class="actions">
        <button @click="paying = false">Not yet</button>
        <button class="primary" :disabled="busy" @click="pay">Pay prizes</button>
      </div>
    </Modal>
    <Modal v-if="cancelling" title="Cancel this tournament?" @close="cancelling = false">
      <p style="margin-top: 0">Everyone who paid an entry fee gets it back. This cannot be undone.</p>
      <div class="actions">
        <button @click="cancelling = false">Keep it</button>
        <button class="danger" :disabled="busy" @click="cancel">Cancel and refund</button>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/api/client'
import { useLoader } from '@/composables/useBusy'
import { dateTime, num, pct, tonNano } from '@/composables/format'
import Bars from '@/components/Bars.vue'
import Stat from '@/components/Stat.vue'

interface Point { day: string; dim: string; value: number }
interface Live {
  pendingWithdrawals: number
  pendingWithdrawalCoins: number
  withdrawalsNeedingReview: number
  pendingTopups: number
  queuedMessages: number
  openGiftClaims: number
  flaggedPlayers: number
}
interface Dash { from: string; to: string; series: Record<string, Point[]>; live: Live; generatedAt: string }

const days = ref(30)
const { data, loading, error, load } = useLoader(() => api.get<Dash>('/admin/dashboard', { days: days.value }))
watch(days, () => load())

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  load()
  timer = setInterval(() => load(true), 60_000)
})
onUnmounted(() => clearInterval(timer))

/** every day of the range, oldest first */
const range = computed(() => {
  if (!data.value) return []
  const out: string[] = []
  const end = new Date(data.value.to + 'T00:00:00Z')
  for (let d = new Date(data.value.from + 'T00:00:00Z'); d <= end; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10))
  return out
})

const pts = (m: string) => data.value?.series[m] ?? []

/** one bar per day: the sum of all dims of a metric (optionally only some dims) */
function daily(metric: string, only?: (dim: string) => boolean) {
  const by = new Map<string, number>()
  for (const p of pts(metric)) if (!only || only(p.dim)) by.set(p.day, (by.get(p.day) ?? 0) + p.value)
  return range.value.map((d) => ({ label: d, value: by.get(d) ?? 0 }))
}
const total = (metric: string, only?: (dim: string) => boolean) => daily(metric, only).reduce((a, b) => a + b.value, 0)

/** a metric split by dim, summed over the whole range */
function breakdown(metric: string) {
  const by = new Map<string, number>()
  for (const p of pts(metric)) by.set(p.dim, (by.get(p.dim) ?? 0) + p.value)
  return [...by.entries()].sort((a, b) => b[1] - a[1])
}

const last = (metric: string, dim = '') => {
  const l = pts(metric).filter((p) => p.dim === dim)
  return l.length ? l[l.length - 1].value : null
}

const circulation = computed(() => {
  const l = pts('circulation')
  const day = l.length ? l[l.length - 1].day : ''
  const v = (k: string) => l.filter((p) => p.day === day && p.dim === k).reduce((a, b) => a + b.value, 0)
  return { day, coins: v('coins'), stars: v('stars'), gifts: v('gifts_owned'), claims: v('gift_claims_open') }
})

function retention(n: number) {
  const size = total('cohort_size')
  const back = total('returned_d' + n)
  // only cohorts old enough to have a value count
  const withValue = new Set(pts('returned_d' + n).map((p) => p.day))
  const denom = pts('cohort_size').filter((p) => withValue.has(p.day)).reduce((a, b) => a + b.value, 0)
  return denom ? back / denom : size ? 0 : null
}

const netCoins = computed(() => total('coins_in') - total('coins_out'))
const adBreakdown = computed(() => breakdown('ad_views'))
const coinsInBy = computed(() => breakdown('coins_in').slice(0, 8))
const coinsOutBy = computed(() => breakdown('coins_out').slice(0, 8))
const starsInBy = computed(() => breakdown('stars_in').slice(0, 8))
const starsOutBy = computed(() => breakdown('stars_out').slice(0, 8))
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Dashboard</h1>
      <span class="grow" />
      <span v-if="data" class="muted">updated {{ dateTime(data.generatedAt) }}</span>
      <select v-model.number="days">
        <option :value="7">Last 7 days</option>
        <option :value="14">Last 14 days</option>
        <option :value="30">Last 30 days</option>
        <option :value="90">Last 90 days</option>
      </select>
      <button @click="load()">Refresh</button>
    </div>

    <p v-if="error" class="err">{{ error }}</p>
    <p v-if="loading && !data" class="muted">Loading…</p>

    <template v-if="data">
      <h2>Needs attention</h2>
      <div class="grid c4 mb">
        <RouterLink to="/withdrawals" style="color: inherit; text-decoration: none">
          <Stat label="Open withdrawals" :value="data.live.pendingWithdrawals" :hint="`${num(data.live.pendingWithdrawalCoins)} coins`" :tone="data.live.pendingWithdrawals ? 'warn' : undefined" />
        </RouterLink>
        <RouterLink to="/withdrawals" style="color: inherit; text-decoration: none">
          <Stat label="Payouts needing review" :value="data.live.withdrawalsNeedingReview" hint="check before resending" :tone="data.live.withdrawalsNeedingReview ? 'bad' : undefined" />
        </RouterLink>
        <RouterLink to="/gifts" style="color: inherit; text-decoration: none">
          <Stat label="Gift claims waiting" :value="data.live.openGiftClaims" :tone="data.live.openGiftClaims ? 'warn' : undefined" />
        </RouterLink>
        <RouterLink to="/risk" style="color: inherit; text-decoration: none">
          <Stat label="Players on hold" :value="data.live.flaggedPlayers" :tone="data.live.flaggedPlayers ? 'warn' : undefined" />
        </RouterLink>
        <RouterLink to="/topups" style="color: inherit; text-decoration: none">
          <Stat label="Unpaid top-up orders" :value="data.live.pendingTopups" />
        </RouterLink>
        <Stat label="Bot messages queued" :value="data.live.queuedMessages" />
        <Stat label="Coins in circulation" :value="num(circulation.coins)" :hint="circulation.day" />
        <Stat label="Stars in circulation" :value="num(circulation.stars)" :hint="`${num(circulation.gifts)} gifts owned`" />
      </div>

      <h2>Players</h2>
      <div class="grid c4 mb">
        <Stat label="Active today (DAU)" :value="num(daily('dau').at(-1)?.value ?? 0)" />
        <Stat label="Active in 30 days (MAU)" :value="num(last('mau'))" />
        <Stat label="New in period" :value="num(total('new_players'))" />
        <Stat label="Returned after 1 / 7 / 30 days" :value="`${pct(retention(1))} / ${pct(retention(7))} / ${pct(retention(30))}`" hint="share of new players seen again" />
      </div>
      <div class="grid c2 mb">
        <div class="card"><h3>Daily active players</h3><Bars :items="daily('dau')" /></div>
        <div class="card"><h3>New players</h3><Bars :items="daily('new_players')" /></div>
      </div>

      <h2>Money</h2>
      <div class="grid c4 mb">
        <Stat label="Stars bought" :value="num(total('stars_bought'))" :hint="`${num(total('topups'))} top-ups`" />
        <Stat label="TON paid out" :value="tonNano(total('withdrawn_ton_nano'))" />
        <Stat label="Withdrawal requests" :value="num(total('withdrawal_requests'))" :hint="`${num(total('withdrawal_coins'))} coins requested`" />
        <Stat label="Coins created − spent" :value="num(netCoins)" :hint="netCoins > 0 ? 'the supply grew' : 'the supply shrank'" />
      </div>
      <div class="grid c2 mb">
        <div class="card"><h3>Stars bought per day</h3><Bars :items="daily('stars_bought')" unit="stars" /></div>
        <div class="card"><h3>TON paid out per day</h3><Bars :items="daily('withdrawn_ton_nano').map((x) => ({ label: x.label, value: x.value / 1e9 }))" unit="TON" /></div>
        <div class="card"><h3>Coins created per day</h3><Bars :items="daily('coins_in')" unit="coins" /></div>
        <div class="card"><h3>Coins removed per day</h3><Bars :items="daily('coins_out')" unit="coins" /></div>
      </div>

      <div class="grid c2 mb">
        <div class="card">
          <h3>Where coins come from</h3>
          <table><tbody><tr v-for="[k, v] in coinsInBy" :key="k"><td>{{ k }}</td><td class="right">{{ num(v) }}</td></tr><tr v-if="!coinsInBy.length"><td class="muted">No data yet</td></tr></tbody></table>
        </div>
        <div class="card">
          <h3>Where coins go</h3>
          <table><tbody><tr v-for="[k, v] in coinsOutBy" :key="k"><td>{{ k }}</td><td class="right">{{ num(v) }}</td></tr><tr v-if="!coinsOutBy.length"><td class="muted">No data yet</td></tr></tbody></table>
        </div>
        <div class="card">
          <h3>Where stars come from</h3>
          <table><tbody><tr v-for="[k, v] in starsInBy" :key="k"><td>{{ k }}</td><td class="right">{{ num(v) }}</td></tr><tr v-if="!starsInBy.length"><td class="muted">No data yet</td></tr></tbody></table>
        </div>
        <div class="card">
          <h3>Where stars go</h3>
          <table><tbody><tr v-for="[k, v] in starsOutBy" :key="k"><td>{{ k }}</td><td class="right">{{ num(v) }}</td></tr><tr v-if="!starsOutBy.length"><td class="muted">No data yet</td></tr></tbody></table>
        </div>
      </div>

      <h2>Ads</h2>
      <div class="grid c2 mb">
        <div class="card">
          <h3>Ad views by placement and result</h3>
          <table>
            <tbody>
              <tr v-for="[k, v] in adBreakdown" :key="k"><td>{{ k }}</td><td class="right">{{ num(v) }}</td></tr>
              <tr v-if="!adBreakdown.length"><td class="muted">No ads yet</td></tr>
            </tbody>
          </table>
        </div>
        <div class="card">
          <h3>Ads skipped because none could load (fallback)</h3>
          <Bars :items="daily('ad_fallbacks')" />
          <p class="hint">Many of these means the ad network is failing: players are fishing without watching ads.</p>
        </div>
      </div>
    </template>
  </div>
</template>

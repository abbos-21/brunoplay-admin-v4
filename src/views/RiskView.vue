<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { useBusy, useLoader } from '@/composables/useBusy'

interface Row {
  id: number
  username: string
  riskScore: number
  flags: string[] | null
  holdWithdrawals: boolean
  holdRewards: boolean
  isBlocked: boolean
  lastIp: string
}

const router = useRouter()
const auth = useAuth()
const { busy, run } = useBusy()
const { data, loading, error, load } = useLoader(() => api.get<{ players: Row[] | null }>('/admin/risk', { limit: 100 }))
onMounted(load)
const rows = computed(() => data.value?.players ?? [])
const canBlock = computed(() => auth.can('players.block'))

async function clear(r: Row) {
  if (await run(() => api.post(`/admin/players/${r.id}/risk/clear`), `Cleared #${r.id}`)) load(true)
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Risk review</h1>
      <span class="grow" />
      <button @click="load()">Refresh</button>
    </div>
    <p class="hint">
      The server scores suspicious behaviour (fast clicking, impossible Ride results, many accounts on one address…) and holds withdrawals or rewards above the threshold in settings.
      Open a player to read the history and decide: <b>Clear</b> lifts the holds, or block the account.
    </p>
    <p v-if="error" class="err">{{ error }}</p>
    <div class="card flush">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Player</th><th class="right">Score</th><th>Signals</th><th>Holds</th><th>Last address</th><th /></tr></thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id" class="click" @click="router.push(`/players/${r.id}`)">
              <td><b>{{ r.username ? '@' + r.username : '#' + r.id }}</b> <span v-if="r.isBlocked" class="badge bad">blocked</span></td>
              <td class="right"><b :class="r.riskScore >= 50 ? 'err' : ''">{{ r.riskScore }}</b></td>
              <td><span v-for="f in r.flags ?? []" :key="f" class="badge warn" style="margin-right: 4px">{{ f }}</span></td>
              <td>
                <span v-if="r.holdWithdrawals" class="badge warn">withdrawals</span>
                <span v-if="r.holdRewards" class="badge warn">rewards</span>
              </td>
              <td><code>{{ r.lastIp || '—' }}</code></td>
              <td class="right" @click.stop>
                <button v-if="canBlock" class="sm" :disabled="busy" @click="clear(r)">Clear</button>
              </td>
            </tr>
            <tr v-if="!rows.length && !loading"><td colspan="6" class="empty">Nobody is flagged. 🎉</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

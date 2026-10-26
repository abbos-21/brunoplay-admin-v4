<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/api/client'
import { useLoader } from '@/composables/useBusy'
import { dateTime, num, pct } from '@/composables/format'

interface Stat { game: string; tier: string; spent: number; paid: number; ratio: number }
interface Ev { id: number; playerId: number; game: string; tier: string; from: string; to: string; ratioAfter: number; createdAt: string }

const { data, loading, error, load } = useLoader(() => api.get<{ stats: Stat[] | null; events: Ev[] | null }>('/admin/games/guard'))
onMounted(load)
const stats = computed(() => data.value?.stats ?? [])
const events = computed(() => data.value?.events ?? [])
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Payout guard</h1>
      <span class="grow" />
      <button @click="load()">Refresh</button>
    </div>
    <p class="hint">
      For every game and price tier the server compares what players paid with what they won over the recent window (length and maximum ratio are in
      <RouterLink to="/settings">Settings → games</RouterLink>). When a draw would push the payout ratio above the maximum, it quietly gives a smaller prize instead; every such intervention is listed below.
    </p>
    <p v-if="error" class="err">{{ error }}</p>

    <div class="card flush mb">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Game</th><th>Tier</th><th class="right">Players paid</th><th class="right">Players won</th><th class="right">Payout ratio</th></tr></thead>
          <tbody>
            <tr v-for="s in stats" :key="s.game + s.tier">
              <td>{{ s.game }}</td>
              <td>{{ s.tier || '—' }}</td>
              <td class="right">{{ num(s.spent) }} ⭐</td>
              <td class="right">{{ num(s.paid) }} ⭐</td>
              <td class="right"><b>{{ pct(s.ratio) }}</b></td>
            </tr>
            <tr v-if="!stats.length && !loading"><td colspan="5" class="empty">No games played in the window yet.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <h2>Recent interventions</h2>
    <div class="card flush">
      <div class="table-wrap">
        <table>
          <thead><tr><th>When</th><th>Player</th><th>Game</th><th>Drawn</th><th>Given</th><th class="right">Ratio after</th></tr></thead>
          <tbody>
            <tr v-for="e in events" :key="e.id">
              <td class="nowrap">{{ dateTime(e.createdAt) }}</td>
              <td><RouterLink :to="`/players/${e.playerId}`">#{{ e.playerId }}</RouterLink></td>
              <td>{{ e.game }} {{ e.tier }}</td>
              <td><code>{{ e.from }}</code></td>
              <td><code>{{ e.to }}</code></td>
              <td class="right">{{ pct(e.ratioAfter) }}</td>
            </tr>
            <tr v-if="!events.length && !loading"><td colspan="6" class="empty">The guard has not had to step in.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

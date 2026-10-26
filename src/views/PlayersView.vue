<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api/client'
import { ago, num } from '@/composables/format'
import { useToast } from '@/composables/useToast'
import Pager from '@/components/Pager.vue'

export interface PlayerRow {
  id: number
  telegramId: string
  username: string
  firstName: string
  lastName: string
  language: string
  isPremium: boolean
  coins: number
  stars: number
  totalCoinsEarned: number
  level: number
  isBlocked: boolean
  holdWithdrawals: boolean
  holdRewards: boolean
  riskScore: number
  createdAt: string
  lastSeenAt: string
}

const router = useRouter()
const toast = useToast()
const q = ref('')
const filter = ref('')
const page = ref(1)
const PAGE = 30
const rows = ref<PlayerRow[]>([])
const total = ref(0)
const loading = ref(false)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE)))

async function load() {
  loading.value = true
  try {
    const r = await api.get<{ players: PlayerRow[]; total: number }>('/admin/players', {
      q: q.value.trim(),
      blocked: filter.value === 'blocked' ? 1 : undefined,
      flagged: filter.value === 'flagged' ? 1 : undefined,
      limit: PAGE,
      offset: (page.value - 1) * PAGE,
    })
    rows.value = r.players
    total.value = r.total
  } catch (e) {
    toast.error(e)
  } finally {
    loading.value = false
  }
}

let t: ReturnType<typeof setTimeout>
watch([q, filter], () => {
  clearTimeout(t)
  t = setTimeout(() => {
    page.value = 1
    load()
  }, 300)
})
watch(page, load)
onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Players</h1>
      <span class="grow" />
      <input v-model="q" placeholder="Search @username, name, Telegram id or player id" style="width: 340px; max-width: 100%" />
      <select v-model="filter">
        <option value="">Everyone</option>
        <option value="flagged">On hold / risky</option>
        <option value="blocked">Blocked</option>
      </select>
    </div>

    <div class="card flush">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Player</th><th>Lang</th><th class="right">Level</th><th class="right">Coins</th><th class="right">Stars</th><th class="right">Risk</th><th>Last seen</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in rows" :key="p.id" class="click" @click="router.push(`/players/${p.id}`)">
              <td>{{ p.id }}</td>
              <td>
                <b>{{ p.username ? '@' + p.username : p.firstName || '—' }}</b>
                <span v-if="p.isPremium" title="Telegram Premium"> ⭐</span>
                <span v-if="p.isBlocked" class="badge bad">blocked</span>
                <span v-if="p.holdWithdrawals" class="badge warn">withdrawals held</span>
                <span v-if="p.holdRewards" class="badge warn">rewards held</span>
              </td>
              <td>{{ p.language }}</td>
              <td class="right">{{ p.level }}</td>
              <td class="right">{{ num(p.coins) }}</td>
              <td class="right">{{ num(p.stars) }}</td>
              <td class="right"><span :class="p.riskScore >= 50 ? 'err' : 'muted'">{{ p.riskScore }}</span></td>
              <td class="nowrap">{{ ago(p.lastSeenAt) }}</td>
            </tr>
            <tr v-if="!rows.length && !loading"><td colspan="8" class="empty">No players found.</td></tr>
          </tbody>
        </table>
      </div>
      <Pager :page="page" :total-pages="totalPages" :total="total" @change="(p) => (page = p)" />
    </div>
  </div>
</template>

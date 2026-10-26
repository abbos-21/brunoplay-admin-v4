<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/api/client'
import { useLoader } from '@/composables/useBusy'
import { num } from '@/composables/format'

interface Mismatch { playerId: number; currency: string; balance: number; ledger: number }

const { data, loading, error, load } = useLoader(() => api.get<{ mismatches: Mismatch[] | null; ok: boolean }>('/admin/ledger/audit'))
onMounted(load)
const rows = computed(() => data.value?.mismatches ?? [])
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Ledger check</h1>
      <span class="grow" />
      <button :disabled="loading" @click="load()">{{ loading ? 'Checking…' : 'Check now' }}</button>
    </div>
    <p class="hint">
      Every coin and star movement is written to an append-only ledger. This check compares each player's balance with the sum of their ledger.
      The server runs it every 6 hours and alerts the admin chat; it must always come back clean.
    </p>
    <p v-if="error" class="err">{{ error }}</p>

    <div v-if="data" class="card" :style="{ borderColor: data.ok ? 'var(--ok)' : 'var(--bad)' }">
      <h2 :style="{ color: data.ok ? 'var(--ok)' : 'var(--bad)' }">{{ data.ok ? '✔ The books balance' : `✖ ${rows.length} account(s) do not balance` }}</h2>
      <p v-if="data.ok" class="muted" style="margin: 0">Every balance equals its ledger.</p>
      <p v-else class="err">Stop paying out and investigate. Do not edit balances by hand.</p>
    </div>

    <div v-if="rows.length" class="card flush mt">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Player</th><th>Currency</th><th class="right">Balance</th><th class="right">Ledger sum</th><th class="right">Difference</th></tr></thead>
          <tbody>
            <tr v-for="m in rows" :key="m.playerId + m.currency">
              <td><RouterLink :to="`/players/${m.playerId}`">#{{ m.playerId }}</RouterLink></td>
              <td>{{ m.currency }}</td>
              <td class="right">{{ num(m.balance) }}</td>
              <td class="right">{{ num(m.ledger) }}</td>
              <td class="right err">{{ num(m.balance - m.ledger) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { ROLE_LABEL, useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'

const auth = useAuth()
const route = useRoute()
const router = useRouter()
const { toasts } = useToast()
const open = ref(false)

// signed out from anywhere (expired session) → the sign in page
watch(
  () => auth.isLoggedIn.value,
  (v) => {
    if (!v && route.path !== '/login') router.replace({ path: '/login', query: { next: route.fullPath } })
  },
)
watch(() => route.fullPath, () => (open.value = false))

async function signOut() {
  await auth.logout()
  router.push('/login')
}

interface Item { to: string; label: string; icon: string; perm?: string }
const groups: { title: string; items: Item[] }[] = [
  { title: '', items: [{ to: '/', label: 'Dashboard', icon: '📊', perm: 'dashboard.read' }] },
  {
    title: 'Money',
    items: [
      { to: '/withdrawals', label: 'Withdrawals', icon: '💸', perm: 'withdrawals.read' },
      { to: '/topups', label: 'Top-ups', icon: '⭐', perm: 'payments.read' },
    ],
  },
  {
    title: 'Players',
    items: [
      { to: '/players', label: 'Players', icon: '👥', perm: 'players.read' },
      { to: '/risk', label: 'Risk review', icon: '🛡️', perm: 'players.read' },
      { to: '/gifts', label: 'Gift claims', icon: '🎁', perm: 'gifts.read' },
    ],
  },
  {
    title: 'Game',
    items: [
      { to: '/settings', label: 'Settings', icon: '⚙️', perm: 'settings.read' },
      { to: '/tasks', label: 'Tasks', icon: '✅', perm: 'tasks.read' },
      { to: '/combo', label: 'Daily combo', icon: '🧩', perm: 'combo.read' },
      { to: '/tournaments', label: 'Tournaments', icon: '🏆', perm: 'tournaments.read' },
      { to: '/games', label: 'Payout guard', icon: '🎰', perm: 'dashboard.read' },
    ],
  },
  {
    title: 'Bot',
    items: [
      { to: '/broadcasts', label: 'Broadcasts', icon: '📣', perm: 'notifications.read' },
      { to: '/templates', label: 'Bot messages', icon: '💬', perm: 'notifications.read' },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/ledger', label: 'Ledger check', icon: '🧮', perm: 'ledger.read' },
      { to: '/audit', label: 'Audit log', icon: '📜' },
      { to: '/admins', label: 'Admins', icon: '🔑', perm: 'admins.manage' },
    ],
  },
]
const visible = () =>
  groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || auth.can(i.perm)) }))
    .filter((g) => g.items.length)
</script>

<template>
  <RouterView v-if="!auth.isLoggedIn.value" />

  <div v-else class="shell">
    <aside class="side" :class="{ open }">
      <div class="brand"><i>B</i> BrunoPlay Admin</div>
      <nav class="nav">
        <template v-for="g in visible()" :key="g.title">
          <small v-if="g.title">{{ g.title }}</small>
          <RouterLink v-for="i in g.items" :key="i.to" :to="i.to" :exact-active-class="i.to === '/' ? 'router-link-active' : ''">
            <span>{{ i.icon }}</span> {{ i.label }}
          </RouterLink>
        </template>
      </nav>
      <div class="me">
        <RouterLink to="/account" style="color: #fff"><strong>{{ auth.admin.value?.name || auth.admin.value?.email }}</strong></RouterLink>
        <div class="muted" style="color: var(--side-ink); opacity: 0.7">{{ ROLE_LABEL[auth.admin.value!.role] }}</div>
        <button class="sm" @click="signOut">Sign out</button>
      </div>
    </aside>

    <main class="main">
      <div class="row" style="margin-bottom: 8px">
        <button class="menu-btn sm" @click="open = !open">☰ Menu</button>
      </div>
      <RouterView :key="route.fullPath" />
    </main>
  </div>

  <div class="toasts">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="{ error: t.kind === 'error' }">{{ t.text }}</div>
  </div>
</template>

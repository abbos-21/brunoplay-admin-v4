import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from './composables/useAuth'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    /** permission the page needs (the server checks again) */
    perm?: string
    title?: string
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('./views/LoginView.vue'), meta: { public: true, title: 'Sign in' } },
    { path: '/', component: () => import('./views/DashboardView.vue'), meta: { perm: 'dashboard.read', title: 'Dashboard' } },
    { path: '/withdrawals', component: () => import('./views/WithdrawalsView.vue'), meta: { perm: 'withdrawals.read', title: 'Withdrawals' } },
    { path: '/topups', component: () => import('./views/TopupsView.vue'), meta: { perm: 'payments.read', title: 'Top-ups' } },
    { path: '/players', component: () => import('./views/PlayersView.vue'), meta: { perm: 'players.read', title: 'Players' } },
    { path: '/players/:id', component: () => import('./views/PlayerView.vue'), meta: { perm: 'players.read', title: 'Player' } },
    { path: '/risk', component: () => import('./views/RiskView.vue'), meta: { perm: 'players.read', title: 'Risk review' } },
    { path: '/gifts', component: () => import('./views/GiftsView.vue'), meta: { perm: 'gifts.read', title: 'Gift claims' } },
    { path: '/games', component: () => import('./views/GuardView.vue'), meta: { perm: 'dashboard.read', title: 'Payout guard' } },
    { path: '/tournaments', component: () => import('./views/TournamentsView.vue'), meta: { perm: 'tournaments.read', title: 'Tournaments' } },
    { path: '/tournaments/:id', component: () => import('./views/TournamentView.vue'), meta: { perm: 'tournaments.read', title: 'Tournament' } },
    { path: '/tasks', component: () => import('./views/TasksView.vue'), meta: { perm: 'tasks.read', title: 'Tasks' } },
    { path: '/combo', component: () => import('./views/ComboView.vue'), meta: { perm: 'combo.read', title: 'Daily combo' } },
    { path: '/settings', component: () => import('./views/SettingsView.vue'), meta: { perm: 'settings.read', title: 'Settings' } },
    { path: '/broadcasts', component: () => import('./views/BroadcastsView.vue'), meta: { perm: 'notifications.read', title: 'Broadcasts' } },
    { path: '/templates', component: () => import('./views/TemplatesView.vue'), meta: { perm: 'notifications.read', title: 'Bot messages' } },
    { path: '/ledger', component: () => import('./views/LedgerAuditView.vue'), meta: { perm: 'ledger.read', title: 'Ledger check' } },
    { path: '/audit', component: () => import('./views/AuditView.vue'), meta: { title: 'Audit log' } },
    { path: '/admins', component: () => import('./views/AdminsView.vue'), meta: { perm: 'admins.manage', title: 'Admins' } },
    { path: '/account', component: () => import('./views/AccountView.vue'), meta: { title: 'My account' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuth()
  if (!to.meta.public && !auth.isLoggedIn.value) return { path: '/login', query: to.fullPath !== '/' ? { next: to.fullPath } : {} }
  if (to.path === '/login' && auth.isLoggedIn.value) return '/'
  if (to.meta.perm && !auth.can(to.meta.perm)) return '/account'
})

router.afterEach((to) => {
  document.title = `${to.meta.title ?? 'Admin'} · BrunoPlay Admin`
})

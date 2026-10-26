import { computed, reactive } from 'vue'
import { api, setUnauthorizedHandler, tokenStore, type Session } from '@/api/client'

export type Role = 'super' | 'finance' | 'support' | 'content'

export interface Admin {
  id: number
  email: string
  name: string
  role: Role
  isActive: boolean
  lastLoginAt: string | null
  telegramId: number | null
  createdAt: string
}

/**
 * The same table as the server's internal/admin/rbac.go. It only decides what the panel shows;
 * the server checks every request again, so a mismatch can never grant anything.
 */
const PERMS: Record<Role, string[]> = {
  super: ['*'],
  finance: [
    'dashboard.read', 'players.read', 'ledger.read', 'withdrawals.*', 'payments.*', 'topup.*', 'settings.read',
    'settings.write.withdrawal', 'settings.write.topup', 'audit.read.own', 'payouts.*', 'tournaments.read',
  ],
  support: [
    'dashboard.read', 'players.read', 'players.block', 'players.note', 'ledger.read', 'gifts.*', 'referrals.read',
    'settings.read', 'tournaments.read', 'audit.read.own',
  ],
  content: [
    'dashboard.read', 'tasks.*', 'combo.*', 'music.*', 'content.*', 'notifications.*', 'tournaments.*', 'ads.read',
    'settings.read', 'settings.write.links', 'settings.write.notifications', 'settings.write.daily',
    'settings.write.system', 'audit.read.own',
  ],
}

export function roleCan(role: Role | undefined, perm: string): boolean {
  if (!role) return false
  return PERMS[role].some((g) => g === '*' || g === perm || (g.endsWith('.*') && perm.startsWith(g.slice(0, -1))))
}

export const ROLE_LABEL: Record<Role, string> = {
  super: 'Super admin',
  finance: 'Finance',
  support: 'Support',
  content: 'Content',
}

const state = reactive<{ admin: Admin | null; ready: boolean }>({ admin: null, ready: false })

export function useAuth() {
  return {
    state,
    admin: computed(() => state.admin),
    isLoggedIn: computed(() => !!state.admin),
    can: (perm: string) => roleCan(state.admin?.role, perm),

    async login(email: string, password: string) {
      const s = await api.post<Session>('/admin/auth/login', { email, password })
      tokenStore.set(s.accessToken, s.refreshToken)
      state.admin = s.admin as Admin
    },
    async logout() {
      const rt = tokenStore.refresh()
      tokenStore.set(null, null)
      state.admin = null
      if (rt) {
        try {
          await api.post('/admin/auth/logout', { refreshToken: rt })
        } catch {
          /* the session is gone locally either way */
        }
      }
    },
    /** at start: restore the session from the saved tokens */
    async restore() {
      if (tokenStore.access() || tokenStore.refresh()) {
        try {
          state.admin = await api.get<Admin>('/admin/me')
        } catch {
          tokenStore.set(null, null)
        }
      }
      state.ready = true
    },
    setAdmin(a: Admin) {
      state.admin = a
    },
  }
}

// a rejected session sends you back to the sign in page
setUnauthorizedHandler(() => {
  tokenStore.set(null, null)
  state.admin = null
})

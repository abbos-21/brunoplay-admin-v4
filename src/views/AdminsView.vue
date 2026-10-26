<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from '@/api/client'
import { ROLE_LABEL, useAuth, type Admin, type Role } from '@/composables/useAuth'
import { useBusy, useLoader } from '@/composables/useBusy'
import { ago } from '@/composables/format'
import { PASSWORD_HINT, passwordProblem } from '@/composables/password'
import Modal from '@/components/Modal.vue'

const ROLE_HELP: Record<Role, string> = {
  super: 'Everything, including admins and deleting player data.',
  finance: 'Withdrawals, top-ups, payouts, money settings, read-only players and ledger.',
  support: 'Players (block, notes, holds), gift claims, read-only settings and tournaments.',
  content: 'Tasks, daily combo, bot messages and broadcasts, tournaments, links and daily settings.',
}

const auth = useAuth()
const { busy, run } = useBusy()
const { data, loading, error, load } = useLoader(() => api.get<{ admins: Admin[] | null; roles: Role[] }>('/admin/admins'))
onMounted(load)
const admins = computed(() => data.value?.admins ?? [])
const roles = computed<Role[]>(() => data.value?.roles ?? ['super', 'finance', 'support', 'content'])
const me = computed(() => auth.admin.value)

const editing = ref<number | 'new' | null>(null)
const f = reactive({ email: '', name: '', role: 'support' as Role, isActive: true, password: '', telegramId: '' })
const formError = ref('')

function openNew() {
  Object.assign(f, { email: '', name: '', role: 'support', isActive: true, password: '', telegramId: '' })
  formError.value = ''
  editing.value = 'new'
}
function openEdit(a: Admin) {
  Object.assign(f, { email: a.email, name: a.name, role: a.role, isActive: a.isActive, password: '', telegramId: a.telegramId ? String(a.telegramId) : '' })
  formError.value = ''
  editing.value = a.id
}

async function save() {
  formError.value = ''
  const tg = f.telegramId.trim() ? Number(f.telegramId.trim()) : undefined
  if (tg !== undefined && (!Number.isInteger(tg) || tg <= 0)) return (formError.value = 'The Telegram id is a whole number.')
  if (f.password) {
    const p = passwordProblem(f.password)
    if (p) return (formError.value = p)
  }
  if (editing.value === 'new') {
    if (!f.email.trim()) return (formError.value = 'Enter an e-mail.')
    if (!f.password) return (formError.value = 'Set a starting password.')
    const ok = await run(() => api.post('/admin/admins', { email: f.email.trim(), name: f.name.trim(), password: f.password, role: f.role, telegramId: tg }), 'Admin created')
    if (ok) {
      editing.value = null
      load(true)
    }
    return
  }
  const body: Record<string, unknown> = { name: f.name.trim(), role: f.role, isActive: f.isActive }
  if (f.password) body.password = f.password
  if (tg !== undefined) body.telegramId = tg
  const ok = await run(() => api.patch(`/admin/admins/${editing.value}`, body), 'Saved')
  if (ok) {
    editing.value = null
    load(true)
  }
}
const isSelf = computed(() => editing.value === me.value?.id)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Admins</h1>
      <span class="grow" />
      <button class="primary" @click="openNew">+ New admin</button>
    </div>
    <p class="hint">
      Sign-in is by e-mail and password. Give people the smallest role they need, and deactivate (do not share) accounts when someone leaves. Deactivating signs the person out at once.
      Anyone with the Finance role can move money, so keep that group small.
    </p>
    <p v-if="error" class="err">{{ error }}</p>

    <div class="card flush mb">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Admin</th><th>Role</th><th>Telegram id</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
          <tbody>
            <tr v-for="a in admins" :key="a.id">
              <td><b>{{ a.name || a.email }}</b><div class="hint">{{ a.email }}</div></td>
              <td>{{ ROLE_LABEL[a.role] }}</td>
              <td><code>{{ a.telegramId ?? '—' }}</code></td>
              <td>{{ ago(a.lastLoginAt) }}</td>
              <td><span class="badge" :class="a.isActive ? 'ok' : 'bad'">{{ a.isActive ? 'active' : 'deactivated' }}</span></td>
              <td class="right"><button class="sm" @click="openEdit(a)">Edit</button></td>
            </tr>
            <tr v-if="!admins.length && !loading"><td colspan="6" class="empty">No admins.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2>What each role can do</h2>
      <dl class="kv"><template v-for="r in roles" :key="r"><dt>{{ ROLE_LABEL[r] }}</dt><dd>{{ ROLE_HELP[r] }}</dd></template></dl>
    </div>

    <Modal v-if="editing !== null" :title="editing === 'new' ? 'New admin' : 'Edit admin'" @close="editing = null">
      <div class="col">
        <label class="field">E-mail<input v-model="f.email" type="email" :disabled="editing !== 'new'" /></label>
        <label class="field">Name<input v-model="f.name" maxlength="100" /></label>
        <label class="field">Role
          <select v-model="f.role" :disabled="isSelf"><option v-for="r in roles" :key="r" :value="r">{{ ROLE_LABEL[r] }}</option></select>
          <span class="hint">{{ ROLE_HELP[f.role] }}</span>
        </label>
        <label class="field">Telegram id <span class="hint">(receives broadcast tests; get it from @userinfobot)</span><input v-model="f.telegramId" inputmode="numeric" /></label>
        <label class="field">{{ editing === 'new' ? 'Starting password' : 'New password (leave empty to keep the current one)' }}
          <input v-model="f.password" type="password" autocomplete="new-password" />
          <span class="hint">{{ PASSWORD_HINT }}</span>
        </label>
        <label v-if="editing !== 'new'" class="row"><input v-model="f.isActive" type="checkbox" :disabled="isSelf" /> Active</label>
      </div>
      <p v-if="formError" class="err">{{ formError }}</p>
      <div class="actions">
        <button @click="editing = null">Cancel</button>
        <button class="primary" :disabled="busy" @click="save">Save</button>
      </div>
    </Modal>
  </div>
</template>

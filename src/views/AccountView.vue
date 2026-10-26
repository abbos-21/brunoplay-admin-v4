<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ROLE_LABEL, useAuth } from '@/composables/useAuth'
import { useBusy } from '@/composables/useBusy'
import { api } from '@/api/client'
import { dateTime } from '@/composables/format'
import { PASSWORD_HINT, passwordProblem } from '@/composables/password'

const auth = useAuth()
const router = useRouter()
const { busy, run } = useBusy()

const current = ref('')
const next = ref('')
const again = ref('')
const problem = ref('')

async function change() {
  problem.value = passwordProblem(next.value)
  if (!problem.value && next.value !== again.value) problem.value = 'The two new passwords differ.'
  if (!problem.value && next.value === current.value) problem.value = 'The new password must differ from the current one.'
  if (problem.value) return
  const ok = await run(() => api.post('/admin/me/password', { current: current.value, new: next.value }), 'Password changed')
  if (ok) {
    current.value = next.value = again.value = ''
  }
}

async function signOut() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="page" style="max-width: 640px">
    <div class="page-head"><h1>My account</h1></div>

    <div v-if="auth.admin.value" class="card mb">
      <dl class="kv">
        <dt>E-mail</dt><dd>{{ auth.admin.value.email }}</dd>
        <dt>Name</dt><dd>{{ auth.admin.value.name || '—' }}</dd>
        <dt>Role</dt><dd>{{ ROLE_LABEL[auth.admin.value.role] }}</dd>
        <dt>Telegram id</dt><dd>{{ auth.admin.value.telegramId ?? 'not set (a super admin can set it under Admins; needed to test broadcasts)' }}</dd>
        <dt>Last sign-in</dt><dd>{{ dateTime(auth.admin.value.lastLoginAt) }}</dd>
      </dl>
      <div class="row mt"><button @click="signOut">Sign out</button></div>
    </div>

    <form class="card col" @submit.prevent="change">
      <h2>Change password</h2>
      <label class="field">Current password<input v-model="current" type="password" autocomplete="current-password" /></label>
      <label class="field">New password<input v-model="next" type="password" autocomplete="new-password" /><span class="hint">{{ PASSWORD_HINT }}</span></label>
      <label class="field">Repeat the new password<input v-model="again" type="password" autocomplete="new-password" /></label>
      <p v-if="problem" class="err" style="margin: 0">{{ problem }}</p>
      <div><button class="primary" :disabled="busy || !current || !next || !again">Change password</button></div>
      <p class="hint" style="margin: 0">Never share it, and keep it in a password manager. Do not reuse the one from another site.</p>
    </form>
  </div>
</template>

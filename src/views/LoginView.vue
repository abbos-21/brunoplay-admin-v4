<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useBusy } from '@/composables/useBusy'

const auth = useAuth()
const route = useRoute()
const router = useRouter()
const { busy, run } = useBusy()

const email = ref('')
const password = ref('')

async function submit() {
  const ok = await run(async () => {
    await auth.login(email.value.trim(), password.value)
    return true
  })
  if (ok) {
    password.value = ''
    router.replace(typeof route.query.next === 'string' && route.query.next.startsWith('/') ? route.query.next : '/')
  }
}
</script>

<template>
  <div class="login">
    <form class="card col" @submit.prevent="submit">
      <div class="brand" style="color: var(--ink); padding: 0 0 6px"><i>B</i> BrunoPlay Admin</div>
      <label class="field">
        E-mail
        <input v-model="email" type="email" autocomplete="username" required autofocus />
      </label>
      <label class="field">
        Password
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <button class="primary" :disabled="busy || !email || !password">{{ busy ? 'Signing in…' : 'Sign in' }}</button>
      <p class="hint" style="margin: 0">Repeated wrong passwords lock the account for a while.</p>
    </form>
  </div>
</template>

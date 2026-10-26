import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { useAuth } from './composables/useAuth'
import './styles.css'

// restore the session first so a refresh does not bounce you to the sign in page
useAuth()
  .restore()
  .finally(() => {
    createApp(App).use(router).mount('#app')
  })

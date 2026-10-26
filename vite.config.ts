import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  // VITE_BACKEND can be set in .env.local to point the dev proxy somewhere else
  const env = loadEnv(mode, '.', 'VITE_')
  return {
    plugins: [vue()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      port: 5174,
      // the panel calls /api; in development that is forwarded to the backend, so there is no CORS to set up
      proxy: { '/api': env.VITE_BACKEND ?? 'http://localhost:8080' },
    },
  }
})

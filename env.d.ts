/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** where the API lives, "/api" by default (same origin) */
  readonly VITE_API_URL?: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

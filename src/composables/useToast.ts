import { reactive } from 'vue'

export interface Toast {
  id: number
  kind: 'ok' | 'error'
  text: string
}

const toasts = reactive<Toast[]>([])
let next = 1

function push(kind: Toast['kind'], text: string) {
  const id = next++
  toasts.push({ id, kind, text })
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id)
    if (i >= 0) toasts.splice(i, 1)
  }, kind === 'error' ? 6000 : 3000)
}

export function useToast() {
  return {
    toasts,
    ok: (text: string) => push('ok', text),
    error: (e: unknown) => push('error', e instanceof Error ? e.message : String(e)),
  }
}

import { ref, type Ref } from 'vue'
import { useToast } from './useToast'

/** Runs one action at a time: blocks double clicks, shows the server's message when it fails. */
export function useBusy() {
  const busy = ref(false)
  const toast = useToast()

  async function run<T>(fn: () => Promise<T>, okText?: string): Promise<T | undefined> {
    if (busy.value) return undefined
    busy.value = true
    try {
      const r = await fn()
      if (okText) toast.ok(okText)
      return r
    } catch (e) {
      toast.error(e)
      return undefined
    } finally {
      busy.value = false
    }
  }
  return { busy, run }
}

/** Loads data, remembering loading and error state for the page. */
export function useLoader<T>(fn: () => Promise<T>) {
  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(true)
  const error = ref('')
  const toast = useToast()

  async function load(quiet = false) {
    if (!quiet) loading.value = true
    error.value = ''
    try {
      data.value = await fn()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      if (quiet) toast.error(e)
    } finally {
      loading.value = false
    }
  }
  return { data, loading, error, load }
}

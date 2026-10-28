const BASE = import.meta.env.VITE_API_URL ?? '/api'
/** Where the API is: pictures (gift images) are plain <img> addresses under it. */
export const API_BASE: string = BASE
const ACCESS = 'bp.admin.access'
const REFRESH = 'bp.admin.refresh'

function read(k: string): string | null {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function write(k: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* private mode: the session simply lasts until reload */
  }
}

export const tokenStore = {
  access: () => read(ACCESS),
  refresh: () => read(REFRESH),
  set(access: string | null, refresh: string | null) {
    write(ACCESS, access)
    write(REFRESH, refresh)
  },
}

/** An error answered by the API: `code` is machine readable, `message` is for people. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public params?: Record<string, unknown>,
    public requestId?: string,
  ) {
    super(message)
  }
}

let onUnauthorized: () => void = () => {}
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

export interface Session {
  accessToken: string
  refreshToken: string
  expiresAt: string
  admin: unknown
}

let refreshing: Promise<boolean> | null = null

/** Trades the refresh token for a new pair; many requests failing together share one attempt. */
function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing
  const rt = tokenStore.refresh()
  if (!rt) return Promise.resolve(false)
  refreshing = (async () => {
    try {
      const res = await fetch(`${BASE}/admin/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      })
      if (!res.ok) return false
      const s = (await res.json()) as Session
      tokenStore.set(s.accessToken, s.refreshToken)
      return true
    } catch {
      return false
    } finally {
      setTimeout(() => (refreshing = null), 0)
    }
  })()
  return refreshing
}

type Query = Record<string, string | number | boolean | undefined | null>

function qs(q?: Query) {
  if (!q) return ''
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

async function request<T>(method: string, path: string, body?: unknown, q?: Query, retry = true): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const t = tokenStore.access()
  if (t) headers.Authorization = `Bearer ${t}`

  let res: Response
  try {
    res = await fetch(`${BASE}${path}${qs(q)}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check the connection and try again.')
  }

  if (res.status === 401 && retry && !path.startsWith('/admin/auth/')) {
    if (await refreshSession()) return request<T>(method, path, body, q, false)
    onUnauthorized()
  }

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; params?: Record<string, unknown>; requestId?: string } } | null)?.error
    throw new ApiError(res.status, e?.code ?? `HTTP_${res.status}`, e?.message ?? `Request failed (${res.status})`, e?.params, e?.requestId)
  }
  return data as T
}

export const api = {
  get: <T>(path: string, q?: Query) => request<T>('GET', path, undefined, q),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
}

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** 1234567.5 → "1,234,567.5" */
export const num = (v: number | null | undefined) => (v === null || v === undefined ? '—' : nf.format(v))

/** nanoTON → "1.2345 TON" */
export const tonNano = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(v / 1e9)} TON`

export const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`)

export function dateTime(v: string | Date | null | undefined) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function ago(v: string | Date | null | undefined) {
  if (!v) return 'never'
  const s = Math.floor((Date.now() - new Date(v).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}

/** a short form of a long TON address: UQA9…aeuG */
export const shortAddress = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)

export const userName = (u: { username?: string; firstName?: string; id?: number } | null | undefined) =>
  !u ? '—' : u.username ? `@${u.username}` : u.firstName || `#${u.id}`

/** value for <input type="datetime-local"> from an ISO string, in local time */
export function toLocalInput(iso: string | Date) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** "2026-10-24" for the game day (UTC) of a date */
export const utcDay = (d: Date) => d.toISOString().slice(0, 10)

/** copies text and tells the caller whether it worked */
export async function copyText(s: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(s)
    return true
  } catch {
    return false
  }
}

/** badge colour for a status word */
export function tone(status: string): '' | 'ok' | 'warn' | 'bad' | 'info' {
  switch (status) {
    case 'COMPLETED': case 'PAID': case 'SENT': case 'DELIVERED': case 'ACTIVE': case 'DONE': case 'OWNED':
      return 'ok'
    case 'PENDING': case 'PROCESSING': case 'SCHEDULED': case 'QUEUED': case 'CLAIM_REQUESTED': case 'DRAFT': case 'SENDING':
      return 'warn'
    case 'REJECTED': case 'FAILED': case 'CANCELLED': case 'EXPIRED': case 'REFUNDED': case 'BLOCKED':
      return 'bad'
    case 'ENDED': case 'SKIPPED':
      return 'info'
    default:
      return ''
  }
}

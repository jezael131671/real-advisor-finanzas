import { format, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'

/** $60,000 */
export const fmx = (n, dec = 0) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN',
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  }).format(Number(n) || 0)

/** $60,000.00 */
export const fmxD = (n) => fmx(n, 2)

/** $60K / $1.2M */
export const fmxC = (n) => {
  const v = Number(n) || 0
  const s = v < 0 ? '-' : ''
  const a = Math.abs(v)
  if (a >= 1_000_000) return `${s}$${(a / 1_000_000).toFixed(1)}M`
  if (a >= 10_000)    return `${s}$${(a / 1_000).toFixed(0)}K`
  return fmx(v)
}

/** 24.5% */
export const pct = (n, dec = 1) => `${(Number(n) || 0).toFixed(dec)}%`

/** "15 may 2026" */
export const fmtDate = (dateStr, fmt = "d MMM yyyy") => {
  if (!dateStr) return '—'
  try {
    const raw = String(dateStr)
    const d   = raw.includes('T') ? parseISO(raw) : parseISO(raw + 'T00:00:00')
    return isValid(d) ? format(d, fmt, { locale: es }) : raw
  } catch { return String(dateStr) }
}

/** "mayo 2026" */
export const fmtMonth = (date = new Date()) =>
  format(date, "MMMM yyyy", { locale: es })

/** Today as YYYY-MM-DD */
export const today = () => new Date().toISOString().split('T')[0]

/** Tiny random id */
export const uid = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36)

/** +/- sign helper */
export const signOf = (type) =>
  ['ingreso', 'bajoquinto'].includes(type) ? '+' : '-'

/** Color helper for amounts */
export const amtColor = (type) =>
  ['ingreso', 'bajoquinto'].includes(type) ? 'text-emerald-600' : 'text-rose-600'

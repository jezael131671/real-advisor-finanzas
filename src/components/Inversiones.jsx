import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Plus, Pencil, Trash2, TrendingUp, TrendingDown, BarChart3,
  ArrowUpRight, ArrowDownRight, RefreshCw, Loader2, X, Zap, Camera,
} from 'lucide-react'
import useFinanceStore from '../store/useFinanceStore.js'
import { BROKERS, TICKER_DB } from '../store/defaultData.js'
import { fmx } from '../lib/formatters.js'
import { getMarketStatus, getMarketNextEvent } from '../lib/priceApi.js'
import { fetchMarketPrices, hasApiKey, fetchHistoricalPortfolio } from '../services/marketData.js'
import { useIBKR } from '../hooks/useIBKR.js'
import PortfolioChart    from './portfolio/PortfolioChart.jsx'
import DistributionChart from './portfolio/DistributionChart.jsx'
import toast from 'react-hot-toast'

// ── Helpers ───────────────────────────────────────────────────────────────────
const num  = (n) => Number(n) || 0
const isOpt = (t) => t === 'call' || t === 'put'
const isAutoUpdateable = (t) => t === 'accion' || t === 'etf' || t === 'cripto'
const PERIODS = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', 'ALL']

const TYPE_CONFIG = {
  accion:   { label: 'Acción',   badgeBg: 'rgba(59,130,246,0.12)',  badgeColor: '#2563EB', emoji: '📈', color: '#2563EB' },
  etf:      { label: 'ETF',      badgeBg: 'rgba(79,70,229,0.12)',   badgeColor: '#4F46E5', emoji: '📊', color: '#4F46E5' },
  cripto:   { label: 'Cripto',   badgeBg: 'rgba(217,119,6,0.12)',   badgeColor: '#D97706', emoji: '₿',  color: '#D97706' },
  cetes:    { label: 'CETES',    badgeBg: 'rgba(16,185,129,0.12)',  badgeColor: '#10B981', emoji: '🏛️', color: '#10B981' },
  call:     { label: 'CALL',     badgeBg: 'rgba(5,150,105,0.12)',   badgeColor: '#059669', emoji: '🟢', color: '#059669' },
  put:      { label: 'PUT',      badgeBg: 'rgba(225,29,72,0.12)',   badgeColor: '#E11D48', emoji: '🔴', color: '#E11D48' },
  efectivo: { label: 'Efectivo', badgeBg: 'rgba(75,82,119,0.10)',   badgeColor: '#4B5277', emoji: '💵', color: '#4B5277' },
}

const BROKER_MAP = Object.fromEntries(BROKERS.map(b => [b.key, b.label]))

const FILTERS = [
  { key: 'todas',    label: 'Todas'    },
  { key: 'accion',   label: 'Acciones' },
  { key: 'etf',      label: 'ETFs'     },
  { key: 'cripto',   label: 'Cripto'   },
  { key: 'cetes',    label: 'CETES'    },
  { key: 'opciones', label: 'Opciones' },
  { key: 'efectivo', label: 'Efectivo' },
]

// ── Distribution by type ──────────────────────────────────────────────────────
function computeDistribution(investments) {
  const buckets = {}
  investments.forEach(inv => {
    const type  = inv.type || 'efectivo'
    const price = num(inv.currentPrice || inv.buyPrice)
    const qty   = num(inv.quantity || 1)
    const mult  = isOpt(type) ? 100 : 1
    buckets[type] = (buckets[type] || 0) + price * qty * mult
  })
  const total = Object.values(buckets).reduce((s, v) => s + v, 0)
  return Object.entries(buckets)
    .filter(([, v]) => v > 0)
    .map(([type, value]) => ({
      type,
      name:  TYPE_CONFIG[type]?.label  ?? type,
      color: TYPE_CONFIG[type]?.color  ?? '#6B7280',
      value,
      pct:   total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value)
}

// ── Annualized return (CAGR) ──────────────────────────────────────────────────
// Formula: CAGR = (endValue / startValue) ^ (365 / holdingDays) − 1
//
// Rules applied:
//   MIN_DAYS  — industry standard lower bound. Below this threshold the
//               compounding exponent (365/days) is so large that even a 1%
//               simple return produces an astronomical annualized figure.
//               30 days is the accepted minimum in portfolio analytics.
//               For reference: +1% over 30 d annualizes to +13.1%.
//
//   MAX_PCT   — hard display cap.  A position bought yesterday that gained
//               50% would "annualize" to 2.6×10¹⁰⁴ — not a useful number.
//               We cap at ±9 999 % so the UI doesn't overflow.
//
//   options   — the per-position helper skips annualizing options entirely.
//               Options derive value from leverage + time decay; a contract
//               that doubles in a week says nothing about a 12-month return.
//               The portfolio-level CAGR still includes options in the
//               total cost/value, but only uses equity/ETF dates to anchor time.
//
// Returns: number (%), or null when there is insufficient history.
const MIN_DAYS_ANNUALIZED = 30
const MAX_ANN_PCT         = 9_999

function computeAnnualized(cost, val, investments) {
  if (cost <= 0 || val <= 0) return null
  const now = Date.now()

  // Anchor on positions that have a real buyDate ≥ MIN_DAYS ago.
  // Exclude options — their very short lifespans skew the reference date.
  const dates = investments
    .filter(i => !isOpt(i.type))         // equities & ETFs only for date anchor
    .map(i => {
      if (!i.buyDate) return null
      const d    = new Date(i.buyDate + 'T00:00:00')
      const days = Math.floor((now - d.getTime()) / 86_400_000)
      return days >= MIN_DAYS_ANNUALIZED ? d : null
    })
    .filter(Boolean)

  if (!dates.length) return null         // no qualifying history → show nothing

  const oldest = new Date(Math.min(...dates.map(d => d.getTime())))
  const days   = Math.max(1, Math.floor((now - oldest.getTime()) / 86_400_000))
  const r      = (val - cost) / cost
  const cagr   = (Math.pow(Math.max(1e-9, 1 + r), 365 / days) - 1) * 100
  return Math.max(-MAX_ANN_PCT, Math.min(MAX_ANN_PCT, cagr))
}

// ── calcMetrics ───────────────────────────────────────────────────────────────
function calcMetrics(inv) {
  const opts = isOpt(inv.type)
  const qty  = num(inv.quantity)
  const buy  = num(inv.buyPrice)
  const curr = num(inv.currentPrice || inv.buyPrice)
  const cost = opts ? qty * buy  * 100 : qty * buy
  const val  = opts ? qty * curr * 100 : qty * curr
  const gain    = val - cost
  const gainPct = cost > 0 ? (gain / cost) * 100 : 0
  const target   = num(inv.targetPrice)
  const targProg = target > 0 ? Math.min(100, (curr / target) * 100) : 0
  const expiryDt      = inv.expiryDate ? new Date(inv.expiryDate + 'T00:00:00') : null
  const daysToExpiry  = expiryDt ? Math.ceil((expiryDt - new Date()) / 86_400_000) : null
  const underlying    = num(inv.underlyingPrice)
  const strike        = num(inv.strikePrice)
  const itm = (opts && underlying > 0 && strike > 0)
    ? (inv.type === 'call' ? underlying > strike : underlying < strike)
    : null
  const delta = num(inv.delta)
  return { qty, buy, curr, cost, val, gain, gainPct, target, targProg, opts, daysToExpiry, itm, underlying, delta }
}

// ── timeSince ─────────────────────────────────────────────────────────────────
function timeSince(date) {
  if (!date) return 'Actualizar'
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (mins < 1)   return 'Ahora mismo'
  if (mins === 1) return 'Hace 1 min'
  if (mins < 60)  return `Hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  return hrs === 1 ? 'Hace 1 h' : `Hace ${hrs} h`
}

// ── MarketBadge ───────────────────────────────────────────────────────────────
function MarketBadge({ status }) {
  const cfg = {
    open:       { label: 'Mercado abierto', color: '#059669', bg: 'rgba(5,150,105,0.15)'   },
    premarket:  { label: 'Pre-mercado',     color: '#D97706', bg: 'rgba(217,119,6,0.12)'   },
    afterhours: { label: 'After-hours',     color: '#6366F1', bg: 'rgba(99,102,241,0.12)'  },
    closed:     { label: 'Mercado cerrado', color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
  }
  const c = cfg[status] ?? cfg.closed
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
      style={{ background: c.bg, color: c.color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: c.color }} />
      {c.label}
    </span>
  )
}

// ── Shared sub-components for detail sheets ───────────────────────────────────
function MetricCard({ label, value, color, wide = false }) {
  return (
    <div className={wide ? 'col-span-2' : ''}
      style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: '10px 12px' }}>
      <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t3)', marginBottom: 3, fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.15, color: color || 'var(--t1)' }}>
        {value}
      </p>
    </div>
  )
}

function SectionLabel({ label }) {
  return (
    <div className="col-span-2 pt-2.5 pb-0.5">
      <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', fontWeight: 700 }}>
        {label}
      </p>
    </div>
  )
}

// ── Position detail bottom sheet ──────────────────────────────────────────────
function PositionDetail({ inv, onClose, openModal, totalPortfolioVal = 0, onShowHistory }) {
  const m        = calcMetrics(inv)
  const tc       = TYPE_CONFIG[inv.type] ?? TYPE_CONFIG.accion
  const sym      = inv.ticker || inv.asset || '—'
  const fullName = (inv.asset && inv.asset !== sym) ? inv.asset : (TICKER_DB[sym]?.name || '')
  const up       = m.gain >= 0
  const gainClr  = up ? '#059669' : '#E11D48'
  const isAE     = inv.type === 'accion' || inv.type === 'etf'
  const isCrypto = inv.type === 'cripto'
  const hasDay   = (isAE || isCrypto) && Boolean(inv.priceUpdatedAt)

  // Per-position annualized return (CAGR)
  // Not shown for: options (leverage distorts meaning), positions < 30 days old,
  // positions without a buyDate.
  const buyDt    = inv.buyDate ? new Date(inv.buyDate + 'T00:00:00') : null
  const holdDays = buyDt ? Math.floor((Date.now() - buyDt.getTime()) / 86_400_000) : null
  const annualized = (!m.opts && holdDays !== null && holdDays >= MIN_DAYS_ANNUALIZED && m.cost > 0)
    ? Math.max(-MAX_ANN_PCT, Math.min(MAX_ANN_PCT,
        (Math.pow(Math.max(1e-9, m.val / m.cost), 365 / Math.max(1, holdDays)) - 1) * 100
      ))
    : null

  const weight = totalPortfolioVal > 0 ? (m.val / totalPortfolioVal) * 100 : 0
  const dc  = num(inv.dayChange    ?? 0)
  const dcp = num(inv.dayChangePct ?? 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}>
      <div className="w-full fade-up"
        style={{
          background:   'var(--bg)',
          borderRadius: '24px 24px 0 0',
          maxHeight:    '92vh',
          overflowY:    'auto',
          boxShadow:    '0 -8px 40px rgba(0,0,0,0.30)',
        }}
        onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {/* Sheet header */}
        <div className="px-5 pt-2 pb-4 flex items-start justify-between gap-3"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-xl">{tc.emoji}</span>
              <span className="text-xl font-black" style={{ color: 'var(--t1)' }}>{sym}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: tc.badgeBg, color: tc.badgeColor }}>{tc.label}</span>
            </div>
            {fullName && <p className="text-xs" style={{ color: 'var(--t3)' }}>{fullName}</p>}
          </div>
          <button onClick={onClose}
            className="btn-press w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
            <X size={14} style={{ color: 'var(--t2)' }} />
          </button>
        </div>

        {/* P&L hero row */}
        <div className="px-5 pt-4 pb-4 flex items-center gap-3"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: up ? 'rgba(5,150,105,0.12)' : 'rgba(225,29,72,0.10)' }}>
            {up
              ? <TrendingUp  size={18} color="#059669" strokeWidth={2.5} />
              : <TrendingDown size={18} color="#E11D48" strokeWidth={2.5} />}
          </div>
          <div>
            <p className="text-2xl font-black leading-none" style={{ color: gainClr }}>
              {up ? '+' : ''}{fmx(m.gain)}
            </p>
            <p className="text-sm font-bold mt-0.5" style={{ color: gainClr }}>
              {up ? '+' : ''}{m.gainPct.toFixed(2)}%
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] mb-0.5" style={{ color: 'var(--t3)' }}>Valor posición</p>
            <p className="text-lg font-black leading-none" style={{ color: 'var(--t1)' }}>{fmx(m.val)}</p>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="px-4 pt-1 pb-3 grid grid-cols-2 gap-2">

          {/* ── Rendimiento ─── */}
          <SectionLabel label="Rendimiento" />
          <MetricCard label="Ganancia $"  value={`${up?'+':''}${fmx(m.gain)}`}           color={gainClr} />
          <MetricCard label="Ganancia %"  value={`${up?'+':''}${m.gainPct.toFixed(2)}%`} color={gainClr} />
          {annualized !== null && (
            <MetricCard
              label="Anualizada"
              value={`${annualized >= 0 ? '+' : ''}${annualized.toFixed(1)}%`}
              color={annualized >= 0 ? '#6366F1' : '#E11D48'}
            />
          )}
          {totalPortfolioVal > 0 && (
            <MetricCard label="Peso portafolio" value={`${weight.toFixed(1)}%`} />
          )}

          {/* ── Precio ─── */}
          <SectionLabel label="Precio" />
          <MetricCard label="P. Promedio compra" value={fmx(m.buy)} />
          <MetricCard label="P. Actual" value={fmx(m.curr)}
            color={m.curr >= m.buy ? '#059669' : '#E11D48'} />
          {hasDay && <>
            <MetricCard label="Cambio hoy $"
              value={`${dc  >= 0 ? '+' : ''}${fmx(dc)}`}
              color={dc  >= 0 ? '#059669' : '#E11D48'} />
            <MetricCard label="Cambio hoy %"
              value={`${dcp >= 0 ? '+' : ''}${dcp.toFixed(2)}%`}
              color={dcp >= 0 ? '#059669' : '#E11D48'} />
            {(inv.dayHigh ?? 0) > 0 && <MetricCard label="Máx día" value={fmx(inv.dayHigh)} color="#059669" />}
            {(inv.dayLow  ?? 0) > 0 && <MetricCard label="Mín día" value={fmx(inv.dayLow)}  color="#E11D48" />}
          </>}

          {/* ── Opciones específico ─── */}
          {m.opts && <>
            {inv.strikePrice && <MetricCard label="Strike" value={fmx(inv.strikePrice)} />}
            {m.daysToExpiry !== null && (
              <MetricCard
                label="Días expiración"
                value={m.daysToExpiry <= 0 ? 'Expirada' : `${m.daysToExpiry}d`}
                color={m.daysToExpiry <= 0 ? '#E11D48' : m.daysToExpiry <= 7 ? '#E11D48' : m.daysToExpiry <= 30 ? '#D97706' : undefined}
              />
            )}
            {m.itm !== null    && <MetricCard label="Estado"     value={m.itm ? 'ITM' : 'OTM'} color={m.itm ? '#059669' : '#E11D48'} />}
            {m.underlying > 0  && <MetricCard label="Subyacente" value={fmx(m.underlying)} />}
            {m.delta !== 0     && <MetricCard label="Delta"       value={m.delta.toFixed(2)} />}
          </>}

          {/* ── Posición ─── */}
          <SectionLabel label="Posición" />
          <MetricCard label={m.opts ? 'Contratos' : 'Cantidad'} value={m.opts ? `${m.qty} ctrs` : `${m.qty}`} />
          <MetricCard label="Costo total" value={fmx(m.cost)} />
          {m.target > 0 && <MetricCard label="Objetivo"     value={fmx(m.target)} />}
          {inv.broker   && <MetricCard label="Broker"       value={BROKER_MAP[inv.broker] || inv.broker} />}
          {inv.buyDate  && <MetricCard label="Fecha compra" value={inv.buyDate} />}
          {inv.notes    && <MetricCard label="Notas" value={`"${inv.notes}"`} wide />}
        </div>

        {/* CTAs */}
        <div className="px-5 pb-8 flex flex-col gap-2.5">
          {(isAE || isCrypto) && onShowHistory && (
            <button
              onClick={onShowHistory}
              className="btn-press w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
              style={{
                background: 'rgba(99,102,241,0.10)',
                border:     '1px solid rgba(99,102,241,0.25)',
                color:      '#818CF8',
              }}>
              <BarChart3 size={14} />
              Ver historial de la posición
            </button>
          )}
          <button
            onClick={() => { openModal('inversion', inv); onClose() }}
            className="btn-press w-full py-3 rounded-2xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)', boxShadow: '0 4px 14px rgba(79,70,229,0.30)' }}>
            Editar posición
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Individual position history chart sheet ───────────────────────────────────
const HIST_PERIODS = ['1D', '1W', '1M', '3M', '6M', '1Y']

function PositionHistorySheet({ inv, onClose }) {
  const [activePeriod, setActivePeriod] = useState('1M')
  const [chartData,    setChartData]    = useState(null)
  const [chartLoading, setChartLoading] = useState(true)
  const chartCache = useRef({})

  const m        = calcMetrics(inv)
  const tc       = TYPE_CONFIG[inv.type] ?? TYPE_CONFIG.accion
  const sym      = inv.ticker || inv.asset || '—'
  const fullName = (inv.asset && inv.asset !== sym) ? inv.asset : (TICKER_DB[sym]?.name || '')
  const up       = m.gain >= 0

  useEffect(() => {
    const key = `${inv.id}_${activePeriod}`
    if (chartCache.current[key] !== undefined) {
      setChartData(chartCache.current[key])
      setChartLoading(false)
      return
    }
    let cancelled = false
    setChartLoading(true)
    fetchHistoricalPortfolio([inv], activePeriod)
      .then(data => {
        if (cancelled) return
        chartCache.current[key] = data
        setChartData(data)
      })
      .catch(() => { if (!cancelled) setChartData(null) })
      .finally(() => { if (!cancelled) setChartLoading(false) })
    return () => { cancelled = true }
  }, [activePeriod, inv.id])

  return (
    <div className="fixed inset-0 z-[60] flex items-end"
      style={{ background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="w-full fade-up"
        style={{
          background:   'var(--bg)',
          borderRadius: '24px 24px 0 0',
          maxHeight:    '80vh',
          overflowY:    'auto',
          boxShadow:    '0 -8px 40px rgba(0,0,0,0.35)',
        }}
        onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div className="px-5 pt-2 pb-4 flex items-start justify-between gap-3"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-base">{tc.emoji}</span>
              <span className="text-base font-black" style={{ color: 'var(--t1)' }}>{sym}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: tc.badgeBg, color: tc.badgeColor }}>{tc.label}</span>
            </div>
            {fullName && <p className="text-xs truncate" style={{ color: 'var(--t3)' }}>{fullName}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-base font-black" style={{ color: up ? '#059669' : '#E11D48' }}>
              {up ? '+' : ''}{m.gainPct.toFixed(2)}%
            </p>
            <p className="text-xs" style={{ color: 'var(--t2)' }}>{fmx(m.val)}</p>
          </div>
          <button onClick={onClose}
            className="btn-press w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
            <X size={14} style={{ color: 'var(--t2)' }} />
          </button>
        </div>

        {/* Quick stats row */}
        <div className="flex gap-5 px-5 pt-3 pb-3">
          {[
            { label: 'Valor actual', value: fmx(m.val),  color: 'var(--t1)' },
            { label: 'Ganancia $',   value: `${up?'+':''}${fmx(m.gain)}`, color: up ? '#059669' : '#E11D48' },
            { label: 'Invertido',    value: fmx(m.cost), color: 'var(--t2)' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t3)', marginBottom: 2 }}>{label}</p>
              <p className="text-sm font-black" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Period selector */}
        <div className="flex gap-1.5 px-5 pb-3">
          {HIST_PERIODS.map(p => (
            <button key={p} onClick={() => setActivePeriod(p)}
              className="btn-press flex-1 py-1.5 rounded-xl text-[10px] font-bold"
              style={{
                background: activePeriod === p ? 'rgba(99,102,241,0.25)' : 'var(--s2)',
                color:      activePeriod === p ? '#A5B4FC' : 'var(--t3)',
                border:     activePeriod === p ? '1px solid rgba(99,102,241,0.40)' : '1px solid var(--border)',
              }}>
              {p}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="mx-4 mb-8 rounded-3xl overflow-hidden"
          style={{ position: 'relative', background: 'linear-gradient(135deg, #0D0821 0%, #1E1050 50%, #0F1530 100%)' }}>
          <div className="glow-orb" style={{
            position: 'absolute', top: -20, right: -20, width: 120, height: 120,
            background: up ? 'rgba(5,150,105,0.20)' : 'rgba(225,29,72,0.20)',
            borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none',
          }} />
          <div className="pt-3 pb-2">
            <PortfolioChart
              data={chartData}
              loading={chartLoading}
              period={activePeriod}
              positive={up}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── IBKR capture summary panel ────────────────────────────────────────────────
function IBKRPanel({ snap, openModal }) {
  const up   = num(snap.lastUnrealizedPnl) >= 0
  const upD  = num(snap.lastDailyPnl)      >= 0
  const fmtSync = snap.syncedAt
    ? new Date(snap.syncedAt).toLocaleString('es-MX', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div className="mx-4 mb-3 rounded-3xl p-5"
      style={{
        background: 'linear-gradient(135deg,#0D0821 0%,#1E1050 55%,#0F1530 100%)',
        border: '1px solid rgba(99,102,241,0.22)',
      }}>

      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
            style={{ color: 'rgba(99,102,241,0.80)' }}>
            IBKR · Net Liquidation Value
          </p>
          <p className="text-3xl font-black text-white leading-none">
            {fmx(snap.lastNLV)}
          </p>
        </div>
        <button
          onClick={() => openModal('capture')}
          className="btn-press flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold shrink-0"
          style={{
            background: 'rgba(99,102,241,0.22)',
            border: '1px solid rgba(99,102,241,0.38)',
            color: '#A5B4FC',
          }}>
          <Camera size={12} /> Actualizar
        </button>
      </div>

      {/* 3-column metrics */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase',
            letterSpacing: '0.06em', marginBottom: 3 }}>
            Cash
          </p>
          <p className="text-xs font-black text-white">{fmx(snap.lastCash)}</p>
        </div>
        <div className="rounded-2xl p-3"
          style={{ background: up ? 'rgba(5,150,105,0.14)' : 'rgba(225,29,72,0.10)' }}>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase',
            letterSpacing: '0.06em', marginBottom: 3 }}>
            No realizado
          </p>
          <p className={`text-xs font-black ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
            {up ? '+' : ''}{fmx(snap.lastUnrealizedPnl)}
          </p>
        </div>
        <div className="rounded-2xl p-3"
          style={{ background: upD ? 'rgba(5,150,105,0.14)' : 'rgba(225,29,72,0.10)' }}>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase',
            letterSpacing: '0.06em', marginBottom: 3 }}>
            P&L hoy
          </p>
          <p className={`text-xs font-black ${upD ? 'text-emerald-400' : 'text-rose-400'}`}>
            {upD ? '+' : ''}{fmx(snap.lastDailyPnl)}
          </p>
        </div>
      </div>

      {fmtSync && (
        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)' }}>
          Captura: {fmtSync}  ·  {snap.source === 'capture' ? 'OCR' : 'API'}
        </p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Inversiones({ openModal }) {
  const { investments, accounts, settings, deleteInvestment, updateInvestment } = useFinanceStore()

  // ── IBKR integration ───────────────────────────────────────────────────────
  const ibkr = useIBKR()

  // ── IBKR capture snapshot ──────────────────────────────────────────────────
  const ibkrSnap       = settings?.ibkr ?? {}
  const hasIbkrSnap    = num(ibkrSnap.lastNLV) > 0
  const hasIbkrPositions = investments.some(i => i.ibkrSynced)

  const [filter,       setFilter]       = useState('todas')
  const [confirmDel,   setConfirmDel]   = useState(null)
  const [lastUpdated,  setLastUpdated]  = useState(null)
  const [marketStatus, setMarketStatus] = useState(() => getMarketStatus())
  const [isFetching,   setIsFetching]   = useState(false)
  const [activePeriod, setActivePeriod] = useState('1M')
  const [detailInv,    setDetailInv]    = useState(null)
  const [historyInv,   setHistoryInv]   = useState(null)

  // ── Chart async state ─────────────────────────────────────────────────────
  const [chartData,     setChartData]     = useState(null)
  const [chartLoading,  setChartLoading]  = useState(true)
  const [chartVersion,  setChartVersion]  = useState(0)  // bump to invalidate cache
  const chartCache = useRef({})           // cache[`${period}_${version}`] = data

  // ── Auto-update state & refs ──────────────────────────────────────────────
  const [autoCountdown,  setAutoCountdown]  = useState(60)
  const autoRefreshRef  = useRef(null)
  const countdownRef    = useRef(null)
  const handleUpdateRef = useRef(null)     // always points to latest handleUpdatePrices

  useEffect(() => {
    if (!investments.length) {
      setChartData(null)
      setChartLoading(false)
      return
    }
    const key = `${activePeriod}_${chartVersion}`
    if (chartCache.current[key] !== undefined) {
      setChartData(chartCache.current[key])
      setChartLoading(false)
      return
    }
    let cancelled = false
    setChartLoading(true)
    fetchHistoricalPortfolio(investments, activePeriod)
      .then(data => {
        if (cancelled) return
        chartCache.current[key] = data
        setChartData(data)
      })
      .catch(() => { if (!cancelled) setChartData(null) })
      .finally(() => { if (!cancelled) setChartLoading(false) })
    return () => { cancelled = true }
  }, [activePeriod, chartVersion]) // investments intentionally excluded — cache invalidated via chartVersion

  // ── IBKR sync handler ─────────────────────────────────────────────────────
  const handleIBKRSync = async () => {
    const result = await ibkr.sync()
    if (result.ok) {
      const n = result.positions.length
      toast.success(`IBKR: ${n} posición${n !== 1 ? 'es' : ''} sincronizada${n !== 1 ? 's' : ''}`)
      // Invalidate chart cache
      chartCache.current = {}
      setChartVersion(v => v + 1)
    } else {
      const err = result.error ?? 'Error de sincronización'
      if (err.includes('Gateway') || err.includes('localhost') || err.includes('disponible') || err.includes('red')) {
        toast.error('IBKR: Gateway no disponible — verifica que esté corriendo en localhost:5000', { duration: 5000 })
      } else if (err.includes('expirada') || err.includes('autentíc') || err.includes('Login')) {
        toast.error('IBKR: Sesión expirada — re-autentícate en el Client Portal Gateway', { duration: 5000 })
      } else if (err.includes('cuenta') || err.includes('Account') || err.includes('encontró')) {
        toast.error('IBKR: No se encontró cuenta — verifica tu conexión al Gateway', { duration: 5000 })
      } else {
        toast.error(`IBKR: ${err}`, { duration: 5000 })
      }
    }
  }

  // ── Price refresh ─────────────────────────────────────────────────────────
  const handleUpdatePrices = async () => {
    setMarketStatus(getMarketStatus())
    if (!investments.length) return
    setIsFetching(true)
    try {
      const { prices, underlying, errors } = await fetchMarketPrices(investments)
      if (errors.includes('stock_no_key') && !hasApiKey()) {
        toast('Sin clave de API — solo se actualizaron criptos', { icon: '⚠️' })
      }
      let updated = 0
      investments.forEach(inv => {
        const sym = inv.ticker?.toUpperCase()
        if (!sym) return
        if (isOpt(inv.type)) {
          const ul = underlying[sym] || prices[sym]
          if (ul) {
            updateInvestment(inv.id, { underlyingPrice: ul.price, priceUpdatedAt: Date.now() })
            updated++
          }
        } else if (prices[sym]) {
          const p = prices[sym]
          updateInvestment(inv.id, {
            currentPrice:   p.price,
            dayChange:      p.change    ?? 0,
            dayChangePct:   p.changePct ?? 0,
            dayHigh:        p.high      ?? 0,
            dayLow:         p.low       ?? 0,
            priceUpdatedAt: Date.now(),
          })
          updated++
        }
      })
      setLastUpdated(new Date())
      if (updated > 0) {
        toast.success(`${updated} precio${updated !== 1 ? 's' : ''} actualizado${updated !== 1 ? 's' : ''}`)
        // Invalidate chart cache so the new period fetch uses fresh prices
        chartCache.current = {}
        setChartVersion(v => v + 1)
      } else if (!errors.includes('stock_no_key')) {
        toast('No se encontraron precios actualizables', { icon: 'ℹ️' })
      }
    } catch {
      toast.error('Error al actualizar precios')
    } finally {
      setIsFetching(false)
    }
  }

  // Keep ref in sync every render so intervals never capture a stale closure
  handleUpdateRef.current = handleUpdatePrices

  // ── Auto-update every 60 seconds ─────────────────────────────────────────
  useEffect(() => {
    const canAuto = investments.some(i => isAutoUpdateable(i.type) || isOpt(i.type))
    if (!canAuto || !hasApiKey()) return

    // Initial fetch on mount
    handleUpdateRef.current()
    setAutoCountdown(60)

    const startTimers = () => {
      autoRefreshRef.current = setInterval(() => {
        handleUpdateRef.current()
        setAutoCountdown(60)
      }, 60_000)
      countdownRef.current = setInterval(() => {
        setAutoCountdown(c => (c > 1 ? c - 1 : 60))
      }, 1_000)
    }

    const stopTimers = () => {
      clearInterval(autoRefreshRef.current)
      clearInterval(countdownRef.current)
      autoRefreshRef.current = null
      countdownRef.current   = null
    }

    startTimers()

    const onVisibility = () => {
      if (document.hidden) {
        stopTimers()
      } else {
        // Back to foreground — refresh immediately then restart timers
        handleUpdateRef.current()
        setAutoCountdown(60)
        startTimers()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopTimers()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investments.length])   // restart cycle only when portfolio size changes

  // ── Computed ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (filter === 'todas')    return investments
    if (filter === 'opciones') return investments.filter(i => isOpt(i.type))
    return investments.filter(i => i.type === filter)
  }, [investments, filter])

  const summary = useMemo(() => {
    if (!investments.length) return null
    let totalCost = 0, totalVal = 0
    let best = null, worst = null, topConc = null

    investments.forEach(inv => {
      const m   = calcMetrics(inv)
      totalCost += m.cost
      totalVal  += m.val
      const lbl = inv.ticker || inv.asset || '—'
      if (!best    || m.gainPct > best.pct)  best    = { lbl, pct: m.gainPct }
      if (!worst   || m.gainPct < worst.pct) worst   = { lbl, pct: m.gainPct }
      if (!topConc || m.val     > topConc.val) topConc = { lbl, val: m.val }
    })

    const totalGain      = totalVal - totalCost
    const retPct         = totalCost > 0 ? (totalGain / totalCost) * 100 : 0
    const annualized     = computeAnnualized(totalCost, totalVal, investments)
    const concentration  = totalVal > 0 ? ((topConc?.val ?? 0) / totalVal) * 100 : 0

    return {
      totalVal, totalCost, totalGain, retPct, annualized,
      count: investments.length,
      best, worst, topConc, concentration,
    }
  }, [investments])

  const totalCash = useMemo(
    () => (accounts ?? []).reduce((s, a) => s + num(a.balance), 0),
    [accounts]
  )

  const distribution = useMemo(
    () => computeDistribution(investments),
    [investments]
  )

  const filterCounts = useMemo(() => {
    const c = { todas: investments.length, opciones: 0 }
    investments.forEach(i => {
      if (isOpt(i.type)) c.opciones = (c.opciones || 0) + 1
      else               c[i.type]  = (c[i.type]  || 0) + 1
    })
    return c
  }, [investments])

  const handleDelete = (inv) => {
    setConfirmDel(null)
    deleteInvestment(inv.id)
    toast.success(`${inv.ticker || inv.asset} eliminado`)
  }

  const isPositive = !summary || summary.totalGain >= 0

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mb-nav pt-safe">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--t1)' }}>Portafolio</h1>
            {summary && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>
                {summary.count} posición{summary.count !== 1 ? 'es' : ''} activa{summary.count !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button onClick={() => openModal('inversion', null)}
            className="btn-press flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)', boxShadow: '0 4px 14px rgba(79,70,229,0.30)' }}>
            <Plus size={15} strokeWidth={2.5} /> Nueva
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <MarketBadge status={marketStatus} />
            <span className="text-[10px] pl-0.5" style={{ color: 'var(--t3)' }}>
              {getMarketNextEvent()}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            {/* IBKR status + sync */}
            <div className="flex flex-col items-end gap-1">
              {/* Status indicator */}
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{
                  background: ibkr.syncing
                    ? '#D97706'
                    : ibkr.isMock
                      ? '#6366F1'
                      : ibkr.authStatus.authenticated
                        ? '#059669'
                        : '#6B7280',
                }} />
                <span className="text-[9px] font-semibold" style={{ color: 'var(--t3)' }}>
                  {ibkr.syncing
                    ? 'Sincronizando…'
                    : ibkr.isMock
                      ? 'Mock'
                      : ibkr.authStatus.authenticated
                        ? 'Conectado'
                        : 'Desconectado'}
                </span>
              </div>
              {/* Sync button */}
              <button onClick={handleIBKRSync} disabled={ibkr.syncing}
                className="btn-press flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold disabled:opacity-50"
                style={{
                  background: ibkr.isMock ? 'rgba(99,102,241,0.12)' : 'rgba(5,150,105,0.12)',
                  color: ibkr.isMock ? '#6366F1' : '#059669',
                  border: '1px solid',
                  borderColor: ibkr.isMock ? 'rgba(99,102,241,0.25)' : 'rgba(5,150,105,0.25)',
                }}>
                {ibkr.syncing
                  ? <Loader2 size={10} className="animate-spin" />
                  : <Zap size={10} strokeWidth={2.5} />}
                Sincronizar IBKR
              </button>
              {/* Last sync timestamp */}
              {ibkr.lastSyncedAt && (
                <span className="text-[9px] leading-none" style={{ color: 'var(--t3)', opacity: 0.55 }}>
                  Sync: {timeSince(ibkr.lastSyncedAt)}
                </span>
              )}
            </div>
            {/* Market price refresh */}
            <button onClick={handleUpdatePrices} disabled={isFetching}
              className="btn-press flex items-center gap-1.5 text-xs disabled:opacity-60"
              style={{ color: 'var(--t3)' }}>
              {isFetching
                ? <Loader2 size={11} className="animate-spin" />
                : <RefreshCw size={11} />}
              {isFetching ? 'Actualizando…' : timeSince(lastUpdated)}
            </button>
            {hasApiKey() && !isFetching && (
              <span className="text-[9px] tabular-nums"
                style={{ color: 'var(--t3)', opacity: 0.55 }}>
                Auto en {autoCountdown}s
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── IBKR capture panel (shown when no synced positions exist) ── */}
      {hasIbkrSnap && !hasIbkrPositions && (
        <IBKRPanel snap={ibkrSnap} openModal={openModal} />
      )}

      {/* ── Summary strip ──────────────────────────────────────────── */}
      {summary && (
        <div className="flex gap-2.5 overflow-x-auto px-4 pb-3" style={{ scrollbarWidth: 'none' }}>
          {[
            {
              label: 'Cash disponible',
              value: fmx(totalCash),
              color: totalCash >= 0 ? '#059669' : '#E11D48',
              bg:    totalCash >= 0 ? 'rgba(5,150,105,0.08)' : 'rgba(225,29,72,0.08)',
            },
            {
              label: 'Rentabilidad',
              value: `${summary.retPct >= 0 ? '+' : ''}${summary.retPct.toFixed(2)}%`,
              color: isPositive ? '#059669' : '#E11D48',
              bg:    isPositive ? 'rgba(5,150,105,0.08)' : 'rgba(225,29,72,0.08)',
            },
            {
              label: 'Ganancia',
              value: `${summary.totalGain >= 0 ? '+' : ''}${fmx(summary.totalGain)}`,
              color: isPositive ? '#059669' : '#E11D48',
              bg:    isPositive ? 'rgba(5,150,105,0.08)' : 'rgba(225,29,72,0.08)',
            },
            {
              label: 'Anualizada',
              value: summary.annualized !== null
                ? `${summary.annualized >= 0 ? '+' : ''}${summary.annualized.toFixed(1)}%`
                : '< 30d',
              color: summary.annualized !== null
                ? (summary.annualized >= 0 ? '#6366F1' : '#E11D48')
                : 'var(--t3)',
              bg:    'rgba(99,102,241,0.08)',
            },
            {
              label: 'Actualización',
              value: isFetching
                ? 'Actualizando…'
                : lastUpdated
                  ? `${timeSince(lastUpdated)} · ${autoCountdown}s`
                  : 'Auto 60s',
              color: 'var(--t2)',
              bg:    'var(--s2)',
            },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="shrink-0 rounded-2xl px-3.5 py-2.5"
              style={{ background: bg, border: '1px solid var(--border)', minWidth: 110 }}>
              <p className="text-[9px] uppercase tracking-wide mb-1" style={{ color: 'var(--t3)' }}>
                {label}
              </p>
              <p className="text-sm font-black leading-tight" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Portfolio Hero + Period selector + Chart ────────────────── */}
      {summary ? (
        <div className="mx-4 mb-3 rounded-3xl overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #0D0821 0%, #1E1050 50%, #0F1530 100%)' }}>

          {/* Glow orb */}
          <div style={{
            position: 'absolute', top: -30, right: -20, width: 140, height: 140,
            background: 'rgba(99,102,241,0.28)', borderRadius: '50%',
            filter: 'blur(48px)', pointerEvents: 'none',
          }} />

          <div className="relative p-5 pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-1"
              style={{ color: 'rgba(99,102,241,0.80)' }}>Valor del portafolio</p>
            <p className="text-3xl font-black text-white leading-none mb-2">
              {fmx(summary.totalVal)}
            </p>

            {/* P&L row */}
            <div className="flex items-center gap-2 mb-4">
              {summary.totalGain >= 0
                ? <TrendingUp  size={14} color="#34d399" strokeWidth={2.5} />
                : <TrendingDown size={14} color="#f87171" strokeWidth={2.5} />}
              <span className="text-sm font-bold"
                style={{ color: summary.totalGain >= 0 ? '#34d399' : '#f87171' }}>
                {summary.totalGain >= 0 ? '+' : ''}{fmx(summary.totalGain)}
              </span>
              <span className="text-sm font-semibold"
                style={{ color: summary.retPct >= 0 ? '#34d399' : '#f87171' }}>
                ({summary.retPct >= 0 ? '+' : ''}{summary.retPct.toFixed(2)}%)
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] mb-1 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.40)' }}>
                  Invertido
                </p>
                <p className="text-xs font-bold text-white">{fmx(summary.totalCost)}</p>
              </div>
              <div className="rounded-2xl p-3"
                style={{ background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(52,211,153,0.15)' }}>
                <p className="text-[10px] mb-1 uppercase tracking-wide" style={{ color: 'rgba(52,211,153,0.70)' }}>
                  ↑ Mejor
                </p>
                <p className="text-xs font-black" style={{ color: '#34d399' }}>{summary.best.lbl}</p>
                <p className="text-[10px] font-bold" style={{ color: '#34d399' }}>
                  {summary.best.pct >= 0 ? '+' : ''}{summary.best.pct.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-2xl p-3"
                style={{ background: 'rgba(225,29,72,0.10)', border: '1px solid rgba(248,113,113,0.15)' }}>
                <p className="text-[10px] mb-1 uppercase tracking-wide" style={{ color: 'rgba(248,113,113,0.70)' }}>
                  ↓ Peor
                </p>
                <p className="text-xs font-black" style={{ color: '#f87171' }}>{summary.worst.lbl}</p>
                <p className="text-[10px] font-bold" style={{ color: '#f87171' }}>
                  {summary.worst.pct.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Period selector */}
          <div className="flex gap-1.5 px-5 pb-2">
            {PERIODS.map(p => (
              <button key={p} onClick={() => setActivePeriod(p)}
                className="btn-press px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all"
                style={{
                  background: activePeriod === p
                    ? 'rgba(99,102,241,0.40)' : 'rgba(255,255,255,0.07)',
                  color: activePeriod === p
                    ? '#A5B4FC' : 'rgba(255,255,255,0.38)',
                  border: activePeriod === p
                    ? '1px solid rgba(99,102,241,0.50)' : '1px solid transparent',
                }}>
                {p}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="pb-2 pt-1">
            <PortfolioChart
              data={chartData}
              loading={chartLoading}
              period={activePeriod}
              positive={isPositive}
            />
          </div>
        </div>
      ) : (
        /* Empty hero */
        <div className="mx-4 mb-4 rounded-3xl p-8 flex flex-col items-center text-center"
          style={{ background: 'linear-gradient(135deg, #0D0821, #1E1050)', minHeight: 160 }}>
          <BarChart3 size={40} color="rgba(99,102,241,0.55)" strokeWidth={1.5} />
          <p className="text-white font-bold mt-3 text-base">Portafolio vacío</p>
          <p className="text-xs mt-1 mb-4" style={{ color: 'rgba(255,255,255,0.38)' }}>
            Registra acciones, ETFs, cripto y opciones
          </p>
          <button onClick={() => openModal('inversion', null)}
            className="btn-press px-5 py-2.5 rounded-2xl text-sm font-bold text-white"
            style={{ background: 'rgba(99,102,241,0.35)', border: '1px solid rgba(99,102,241,0.40)' }}>
            + Agregar inversión
          </button>
        </div>
      )}

      {/* ── Stats panel ─────────────────────────────────────────────── */}
      {summary && (
        <div className="flex gap-2.5 overflow-x-auto px-4 pb-3" style={{ scrollbarWidth: 'none' }}>
          {[
            { label: 'Mejor posición', value: summary.best.lbl,
              sub: `${summary.best.pct >= 0 ? '+' : ''}${summary.best.pct.toFixed(1)}%`, color: '#10B981' },
            { label: 'Peor posición',  value: summary.worst.lbl,
              sub: `${summary.worst.pct.toFixed(1)}%`, color: '#F43F5E' },
            { label: 'Concentración',  value: `${summary.concentration.toFixed(0)}%`,
              sub: summary.topConc?.lbl ?? '—', color: '#6366F1' },
            { label: 'Posiciones',     value: String(summary.count),
              sub: 'activas', color: '#D97706' },
            { label: 'Dividendos',     value: '$0',
              sub: 'acumulados', color: '#4B5277' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="shrink-0 rounded-2xl px-3.5 py-2.5"
              style={{ background: 'var(--s1)', border: '1px solid var(--border)', minWidth: 105 }}>
              <p className="text-[9px] uppercase tracking-wide mb-1" style={{ color: 'var(--t3)' }}>
                {label}
              </p>
              <p className="text-base font-black leading-tight" style={{ color }}>{value}</p>
              <p className="text-[10px] font-semibold mt-0.5" style={{ color: 'var(--t3)' }}>{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filter bar ──────────────────────────────────────────────── */}
      {investments.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 mb-4" style={{ scrollbarWidth: 'none' }}>
          {FILTERS.map(f => {
            const count  = filterCounts[f.key] || 0
            const active = filter === f.key
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className="btn-press shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition-all"
                style={{
                  background: active ? '#4F46E5' : 'var(--s1)',
                  color:      active ? '#fff'    : 'var(--t2)',
                  border:     active ? '1px solid #4F46E5' : '1px solid var(--border)',
                  boxShadow:  active ? '0 2px 10px rgba(79,70,229,0.25)' : 'none',
                }}>
                {f.label}
                {f.key !== 'todas' && count > 0 && (
                  <span className="text-[10px] px-1.5 py-0 rounded-full font-bold"
                    style={{
                      background: active ? 'rgba(255,255,255,0.25)' : 'var(--s3)',
                      color:      active ? '#fff' : 'var(--t3)',
                    }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Investment cards ─────────────────────────────────────────── */}
      <div className="px-4 space-y-3">
        {filtered.map(inv => {
          const m   = calcMetrics(inv)
          const tc  = TYPE_CONFIG[inv.type] ?? TYPE_CONFIG.accion
          const sym = inv.ticker || inv.asset || '—'
          const fullName = (inv.asset && inv.asset !== sym)
            ? inv.asset
            : (TICKER_DB[sym]?.name || '')
          const up         = m.gain >= 0
          const isDeleting = confirmDel === inv.id

          return (
            <div key={inv.id}
              className="overflow-hidden fade-up cursor-pointer"
              style={{
                background:   'var(--s1)',
                border:       '1px solid var(--border)',
                borderLeft:   `3px solid ${up ? '#059669' : '#E11D48'}`,
                borderRadius: 20,
                boxShadow:    '0 2px 14px rgba(0,10,50,0.07)',
              }}
              onClick={() => !isDeleting && setDetailInv(inv)}>

              {/* Card header */}
              <div className="flex items-start justify-between px-4 pt-4 pb-2 gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className="text-base">{tc.emoji}</span>
                    <span className="text-base font-black" style={{ color: 'var(--t1)' }}>{sym}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: tc.badgeBg, color: tc.badgeColor }}>{tc.label}</span>
                    {inv.broker && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--s3)', color: 'var(--t3)' }}>
                        {BROKER_MAP[inv.broker] || inv.broker}
                      </span>
                    )}
                    {inv.currency && inv.currency !== 'MXN' && (
                      <span className="badge-blue text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {inv.currency}
                      </span>
                    )}
                  </div>
                  {fullName && (
                    <p className="text-xs truncate" style={{ color: 'var(--t3)' }}>{fullName}</p>
                  )}
                  {isAutoUpdateable(inv.type) && !inv.priceUpdatedAt && (
                    <span className="text-[10px] font-semibold" style={{ color: '#D97706' }}>
                      ⚡ precio no actualizado
                    </span>
                  )}
                </div>

                {/* Action buttons — stop propagation so card click ≠ detail open */}
                <div className="flex gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openModal('inversion', inv)}
                    className="btn-press w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
                    <Pencil size={13} style={{ color: 'var(--t2)' }} />
                  </button>
                  <button onClick={() => setConfirmDel(inv.id)}
                    className="btn-press w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(225,29,72,0.07)', border: '1px solid rgba(225,29,72,0.15)' }}>
                    <Trash2 size={13} color="#E11D48" />
                  </button>
                </div>
              </div>

              {/* Card metrics */}
              <div className="px-4 pt-3 pb-4">
                {m.opts ? (
                  /* ── Options layout ─────────────────────── */
                  <div>
                    <div className="flex items-end justify-between mb-3">
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: 'var(--t3)' }}>
                          {m.qty} ctrs × {fmx(m.curr)} prima
                        </p>
                        <p className="text-2xl font-black leading-none" style={{ color: 'var(--t1)' }}>
                          {fmx(m.val)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`flex items-center gap-0.5 justify-end mb-0.5 ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {up ? <ArrowUpRight size={16} strokeWidth={2.5} /> : <ArrowDownRight size={16} strokeWidth={2.5} />}
                          <span className="text-base font-black">
                            {up ? '+' : ''}{m.gainPct.toFixed(2)}%
                          </span>
                        </div>
                        <p className={`text-sm font-bold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {up ? '+' : ''}{fmx(m.gain)}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 pb-3 mb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--t3)' }}>Prima cmpra</p>
                        <p className="text-xs font-bold" style={{ color: 'var(--t2)' }}>{fmx(m.buy)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--t3)' }}>Invertido</p>
                        <p className="text-xs font-bold" style={{ color: 'var(--t2)' }}>{fmx(m.cost)}</p>
                      </div>
                      {m.curr !== m.buy && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--t3)' }}>Prima actual</p>
                          <p className={`text-xs font-bold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {fmx(m.curr)}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-2 items-end">
                      {inv.strikePrice ? (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--t3)' }}>Strike</p>
                          <p className="text-xs font-bold" style={{ color: 'var(--t2)' }}>${inv.strikePrice}</p>
                        </div>
                      ) : null}
                      {m.daysToExpiry !== null ? (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--t3)' }}>Días exp.</p>
                          <p className={`text-xs font-bold ${
                            m.daysToExpiry <= 0 ? 'text-rose-600' :
                            m.daysToExpiry <= 7 ? 'text-rose-500' :
                            m.daysToExpiry <= 30 ? 'text-amber-500' : ''}`}
                            style={m.daysToExpiry > 30 ? { color: 'var(--t2)' } : {}}>
                            {m.daysToExpiry <= 0 ? 'Expirada' : `${m.daysToExpiry}d`}
                          </p>
                        </div>
                      ) : null}
                      {m.itm !== null ? (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--t3)' }}>Estado</p>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: m.itm ? 'rgba(5,150,105,0.12)' : 'rgba(225,29,72,0.10)',
                              color:      m.itm ? '#059669' : '#E11D48',
                            }}>
                            {m.itm ? 'ITM' : 'OTM'}
                          </span>
                        </div>
                      ) : null}
                      {inv.delta != null ? (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--t3)' }}>Delta</p>
                          <p className="text-xs font-bold" style={{ color: 'var(--t2)' }}>{m.delta.toFixed(2)}</p>
                        </div>
                      ) : null}
                      {m.underlying > 0 ? (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--t3)' }}>Subyacente</p>
                          <p className="text-xs font-bold" style={{ color: 'var(--t2)' }}>{fmx(m.underlying)}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  /* ── Regular layout ─────────────────────── */
                  <div>
                    <div className="flex items-end justify-between mb-3">
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: 'var(--t3)' }}>
                          {m.qty} × {fmx(m.curr)}
                        </p>
                        <p className="text-2xl font-black leading-none" style={{ color: 'var(--t1)' }}>
                          {fmx(m.val)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`flex items-center gap-0.5 justify-end mb-0.5 ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {up ? <ArrowUpRight size={16} strokeWidth={2.5} /> : <ArrowDownRight size={16} strokeWidth={2.5} />}
                          <span className="text-base font-black">
                            {up ? '+' : ''}{m.gainPct.toFixed(2)}%
                          </span>
                        </div>
                        <p className={`text-sm font-bold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {up ? '+' : ''}{fmx(m.gain)}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4 pb-3 mb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--t3)' }}>P. compra</p>
                        <p className="text-xs font-bold" style={{ color: 'var(--t2)' }}>{fmx(m.buy)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--t3)' }}>Invertido</p>
                        <p className="text-xs font-bold" style={{ color: 'var(--t2)' }}>{fmx(m.cost)}</p>
                      </div>
                      {m.curr !== m.buy && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--t3)' }}>P. actual</p>
                          <p className={`text-xs font-bold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {fmx(m.curr)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Day market data — acciones & ETFs */}
                    {(inv.type === 'accion' || inv.type === 'etf') && inv.priceUpdatedAt && (
                      <div className="flex gap-4 flex-wrap mb-3 pt-0.5">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--t3)' }}>Cambio hoy</p>
                          <p className={`text-xs font-bold ${(inv.dayChange ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {(inv.dayChange ?? 0) >= 0 ? '+' : ''}{fmx(inv.dayChange ?? 0)}{' '}
                            <span className="text-[10px] font-semibold">
                              ({(inv.dayChangePct ?? 0) >= 0 ? '+' : ''}{(inv.dayChangePct ?? 0).toFixed(2)}%)
                            </span>
                          </p>
                        </div>
                        {(inv.dayHigh ?? 0) > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--t3)' }}>Máx día</p>
                            <p className="text-xs font-bold text-emerald-600">{fmx(inv.dayHigh)}</p>
                          </div>
                        )}
                        {(inv.dayLow ?? 0) > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--t3)' }}>Mín día</p>
                            <p className="text-xs font-bold text-rose-500">{fmx(inv.dayLow)}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Target progress */}
                    {m.target > 0 && (
                      <div className="mb-2">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span style={{ color: 'var(--t3)' }}>🎯 Objetivo {fmx(m.target)}</span>
                          <span className="font-black"
                            style={{ color: m.targProg >= 100 ? '#059669' : '#4F46E5' }}>
                            {m.targProg.toFixed(0)}%
                          </span>
                        </div>
                        <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'var(--s3)' }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.min(100, m.targProg)}%`,
                              background: m.targProg >= 100 ? '#059669'
                                : `linear-gradient(90deg, ${up ? '#4F46E5' : '#E11D48'}, ${up ? '#818CF8' : '#F43F5E'})`,
                            }} />
                        </div>
                      </div>
                    )}

                    {inv.notes && (
                      <p className="text-xs italic mt-1" style={{ color: 'var(--t3)' }}>"{inv.notes}"</p>
                    )}
                  </div>
                )}
              </div>

              {/* Delete confirmation */}
              {isDeleting && (
                <div className="mx-4 mb-4 p-3 rounded-2xl fade-in"
                  style={{ background: 'rgba(225,29,72,0.06)', border: '1px solid rgba(225,29,72,0.18)' }}
                  onClick={e => e.stopPropagation()}>
                  <p className="text-xs text-center font-semibold mb-2.5" style={{ color: 'var(--t1)' }}>
                    ¿Eliminar {sym}?
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDel(null)}
                      className="btn-press flex-1 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: 'var(--s3)', color: 'var(--t2)' }}>
                      Cancelar
                    </button>
                    <button onClick={() => handleDelete(inv)}
                      className="btn-press flex-1 py-2 rounded-xl text-xs font-bold text-white"
                      style={{ background: '#E11D48' }}>
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Empty filter state */}
        {investments.length > 0 && filtered.length === 0 && (
          <div className="text-center py-10 fade-in">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold" style={{ color: 'var(--t2)' }}>
              No hay {FILTERS.find(f => f.key === filter)?.label.toLowerCase() ?? ''} en tu portafolio
            </p>
            <button onClick={() => openModal('inversion', null)}
              className="btn-press mt-4 px-5 py-2 rounded-2xl text-sm font-bold"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              + Agregar
            </button>
          </div>
        )}
      </div>

      {/* ── Distribution ─────────────────────────────────────────────── */}
      {distribution.length > 1 && (
        <div className="mx-4 mt-4 mb-4 rounded-3xl p-4"
          style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-bold mb-3" style={{ color: 'var(--t1)' }}>Distribución</p>
          <DistributionChart data={distribution} />
        </div>
      )}

      {/* ── Position detail bottom sheet ─────────────────────────────── */}
      {detailInv && (
        <PositionDetail
          inv={detailInv}
          onClose={() => setDetailInv(null)}
          openModal={openModal}
          totalPortfolioVal={summary?.totalVal ?? 0}
          onShowHistory={() => setHistoryInv(detailInv)}
        />
      )}

      {/* ── Individual position history chart sheet ───────────────────── */}
      {historyInv && (
        <PositionHistorySheet
          inv={historyInv}
          onClose={() => setHistoryInv(null)}
        />
      )}

    </div>
  )
}

import { useMemo, useState } from 'react'
import {
  Bell, ChevronRight, TrendingUp, TrendingDown,
  Wallet, CreditCard, ArrowUpRight, ArrowDownRight,
  Loader2, BrainCircuit,
} from 'lucide-react'
import useFinanceStore   from '../store/useFinanceStore.js'
import { computeStats, computeAlerts, computeMonthlyFlow, getAccountGradient, computeCashFlow, computeAdvisorScore, computeBreakdown } from '../store/selectors.js'
import { fmx, fmxC, fmtMonth } from '../lib/formatters.js'
import { fetchMarketPrices, hasApiKey } from '../services/marketData.js'
import { getMarketStatus } from '../lib/priceApi.js'
import toast from 'react-hot-toast'

// ── Net-worth historical sparkline ────────────────────────────────────────────
function NWSparkline({ points, W = 88, H = 38 }) {
  if (!points?.length || points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const rng = max - min || 1
  const pad = H * 0.1
  const xs  = points.map((_, i) => (i / (points.length - 1)) * W)
  const ys  = points.map(v => H - pad - ((v - min) / rng) * (H - pad * 2))
  const line = xs.map((x, i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ')
  const area = `${line} L ${W} ${H} L 0 ${H} Z`
  const up   = points[points.length - 1] >= points[0]
  const c    = up ? '#4ADE80' : '#F87171'
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={c} stopOpacity="0.35" />
          <stop offset="100%" stopColor={c} stopOpacity="0"    />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#nwGrad)" />
      <path d={line} fill="none" stroke={c} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Monthly bar chart ─────────────────────────────────────────────────────────
function FlowChart({ data }) {
  const H    = 58
  const max  = Math.max(...data.map(d => Math.max(d.income, d.expense, 1)))
  const bW   = 9
  const gap  = 3
  const grpW = bW * 2 + gap + 12
  const W    = grpW * data.length

  return (
    <svg width="100%" height={H + 18} viewBox={`0 0 ${W} ${H + 18}`} preserveAspectRatio="none"
      style={{ display: 'block' }}>
      {data.map((d, i) => {
        const x    = i * grpW + 1
        const iH   = Math.max(2, (d.income  / max) * H)
        const eH   = Math.max(2, (d.expense / max) * H)
        const last = i === data.length - 1
        return (
          <g key={i}>
            <rect x={x}         y={H - iH} width={bW} height={iH} rx={2.5}
              fill="#059669" opacity={last ? 1 : 0.55} />
            <rect x={x+bW+gap}  y={H - eH} width={bW} height={eH} rx={2.5}
              fill="#E11D48" opacity={last ? 0.9 : 0.45} />
            <text x={x + bW + gap / 2 + 0.5} y={H + 13} textAnchor="middle"
              fontSize={7.5} fill="#8B91B0" fontFamily="system-ui,sans-serif">
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Patrimonio breakdown row ──────────────────────────────────────────────────
const BDRow = ({ emoji, label, value, color, bold = false, separator = false }) => (
  <>
    {separator && <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />}
    <div className="flex items-center justify-between py-0.5">
      <span className={`text-[11px] ${bold ? 'font-bold' : 'font-medium'}`}
        style={{ color: bold ? 'rgba(255,255,255,0.80)' : 'rgba(167,139,250,0.60)' }}>
        {emoji && <span className="mr-1">{emoji}</span>}{label}
      </span>
      <span className={`text-[11px] ${bold ? 'font-bold' : 'font-medium'} shrink-0`} style={{ color }}>
        {value}
      </span>
    </div>
  </>
)

// ── Progress bar ──────────────────────────────────────────────────────────────
const Bar = ({ pct, gradient, h = 5 }) => (
  <div style={{ height: h, borderRadius: 99, background: 'var(--s3)', overflow: 'hidden' }}>
    <div style={{
      height: '100%', borderRadius: 99,
      width: `${Math.min(100, Math.max(0, pct))}%`,
      background: gradient,
      transition: 'width 0.4s ease',
    }} />
  </div>
)

// ── Month-over-month delta ────────────────────────────────────────────────────
const MoDelta = ({ curr, prev, inverse = false }) => {
  if (!prev || prev === 0) return null
  const raw = ((curr - prev) / Math.abs(prev)) * 100
  const up  = inverse ? raw <= 0 : raw >= 0   // gastos: menos es mejor
  const abs = Math.abs(raw)
  if (abs < 1) return null
  return (
    <p className={`text-[9px] font-bold mt-0.5 ${up ? 'text-emerald-500' : 'text-rose-500'}`}>
      {up ? '▲' : '▼'} {abs.toFixed(0)}% vs mes ant.
    </p>
  )
}

// ── Util color helper ─────────────────────────────────────────────────────────
const utilStyle = (p) =>
  p >= 51 ? { text: '#E11D48', grad: 'linear-gradient(90deg,#E11D48,#F43F5E)' } :
  p >= 30 ? { text: '#D97706', grad: 'linear-gradient(90deg,#D97706,#F59E0B)' } :
            { text: '#059669', grad: 'linear-gradient(90deg,#059669,#22C55E)' }

// ── Section header ────────────────────────────────────────────────────────────
const SectionHead = ({ title, action, onAction }) => (
  <div className="flex justify-between items-center mb-3">
    <p className="text-sm font-bold" style={{ color: 'var(--t1)' }}>{title}</p>
    {action && (
      <button onClick={onAction}
        className="flex items-center gap-0.5 text-xs font-semibold"
        style={{ color: 'var(--accent)' }}>
        {action} <ChevronRight size={12} />
      </button>
    )}
  </div>
)

// ── Quick action button ───────────────────────────────────────────────────────
const QuickBtn = ({ emoji, label, onClick }) => (
  <button onClick={onClick}
    className="btn-press flex flex-col items-center gap-1.5 py-3.5 rounded-2xl"
    style={{ background: 'var(--s1)', border: '1px solid var(--border)', flex: 1,
      boxShadow: '0 1px 4px rgba(0,10,50,0.05)' }}>
    <span className="text-2xl leading-none">{emoji}</span>
    <span className="text-[11px] font-semibold" style={{ color: 'var(--t2)' }}>{label}</span>
  </button>
)

// ── Tx type metadata ──────────────────────────────────────────────────────────
const txMeta = (type) => ({
  ingreso:       { emoji: '💰', cls: 'text-emerald-600', sign: '+'  },
  bajoquinto:    { emoji: '🎸', cls: 'text-amber-600',   sign: '+'  },
  gasto:         { emoji: '💸', cls: 'text-rose-600',    sign: '-'  },
  pago_tarjeta:  { emoji: '💳', cls: 'text-violet-600',  sign: '-'  },
  transferencia: { emoji: '↔️', cls: 'text-blue-600',    sign: ''   },
  inversion:     { emoji: '📈', cls: 'text-indigo-600',  sign: '-'  },
}[type] ?? { emoji: '•', cls: 'text-slate-500', sign: '' })

// ── Per-investment calc ───────────────────────────────────────────────────────
const invCalc = (i) => {
  const qty  = Number(i.quantity  || 0)
  const buy  = Number(i.buyPrice  || 0)
  const curr = Number(i.currentPrice || i.buyPrice || 0)
  const mult = (i.type === 'call' || i.type === 'put') ? 100 : 1   // options ×100
  const cost = qty * buy  * mult
  const val  = qty * curr * mult
  const pct  = cost > 0 ? ((val - cost) / cost) * 100 : 0
  return { cost, val, gain: val - cost, pct }
}

// ── Priority actions engine ───────────────────────────────────────────────────
// Rules:
//   CRÍTICO   → utilización ≥ 90%  |  pago vencido (dueDay = hoy)
//   IMPORTANTE → pago próximo ≤ 7d  |  utilización ≥ 50%
//   NORMAL    → cobros CRM, metas clave, portafolio
// Max 5 acciones en total, grouped 1 per card.
const UGR = { critico: 0, importante: 1, normal: 2 }
const MAX_ACTIONS = 5

function buildActions({ cards, bajoquintos, investments, metas, stats, marketStatus, isFetching, openModal, setTab, onUpdate }) {
  const items    = []
  const now      = new Date()
  const todayDay = now.getDate()

  // ── 1. Cards — ONE entry per card (payment + utilization grouped) ────────────
  cards.forEach(c => {
    const bal = Number(c.balance || 0)
    const lim = Number(c.limit   || 0)
    if (bal <= 0 && lim <= 0) return

    const util   = lim > 0 ? (bal / lim) * 100 : 0
    const dueDay = Number(c.dueDay || 0)
    let   daysUntilDue = null

    if (bal > 0) {
      const dueDate2 = dueDay > todayDay
        ? new Date(now.getFullYear(), now.getMonth(), dueDay)
        : new Date(now.getFullYear(), now.getMonth() + 1, dueDay)
      daysUntilDue = Math.ceil((dueDate2 - now) / 86_400_000)
    }

    // Highest-priority rule wins
    let urgency
    if (util >= 90 || (daysUntilDue !== null && daysUntilDue === 0)) {
      urgency = 'critico'
    } else if ((daysUntilDue !== null && daysUntilDue <= 7) || util >= 50) {
      urgency = 'importante'
    } else if (util >= 30 || daysUntilDue !== null) {
      urgency = 'normal'
    } else {
      return  // tarjeta sana, sin pago próximo — omitir
    }

    // Subtitle: util • payment
    const parts = []
    if (lim > 0 && util > 0)       parts.push(`${util.toFixed(0)}% utilizado`)
    if (daysUntilDue === 0)        parts.push('¡Vence HOY!')
    else if (daysUntilDue === 1)   parts.push('Vence mañana')
    else if (daysUntilDue !== null) parts.push(`Vence en ${daysUntilDue} días`)

    const payNow = daysUntilDue !== null && daysUntilDue <= 7

    items.push({
      id:       `card-${c.id}`,
      urgency,
      icon:     util >= 90 ? '🚨' : payNow ? '💳' : '⚠️',
      title:    c.bankName || c.alias || 'Tarjeta',
      subtitle: parts.join(' • '),
      value:    bal > 0 ? fmx(bal) : null,
      action:   payNow ? 'Pagar' : 'Ver tarjeta',
      onAction: payNow ? () => openModal('payment', c) : () => setTab('cards'),
    })
  })

  // ── 2. CRM — pedidos retrasados (critico) ────────────────────────────────────
  bajoquintos
    .filter(b => b.dueDate && !['liquidado', 'entregado', 'testimonio'].includes(b.status))
    .forEach(b => {
      try {
        const late = Math.floor((now - new Date(b.dueDate + 'T00:00:00')) / 86_400_000)
        if (late > 0) items.push({
          id: `bq-late-${b.id}`, urgency: 'critico', icon: '⏰',
          title:    'Pedido retrasado',
          subtitle: `${b.client}${b.model ? ` · ${b.model}` : ''} · ${late}d tarde`,
          value: null, action: 'Ver', onAction: () => setTab('bajoquintos'),
        })
      } catch {}
    })

  // ── 3. CRM — cobros pendientes (normal, agrupados) ───────────────────────────
  const pendingCobros = bajoquintos
    .filter(b => ['apartado', 'en_fabricacion', 'terminado', 'cobrado'].includes(b.status))
    .map(b => {
      const paid    = Number(b.deposit || 0) + (b.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
      const pending = Math.max(0, Number(b.salePrice || 0) - paid)
      return pending > 0 ? { ...b, pending } : null
    })
    .filter(Boolean)

  if (pendingCobros.length === 1) {
    const bq = pendingCobros[0]
    items.push({
      id: `cobro-${bq.id}`, urgency: 'normal', icon: '💰',
      title:    'Cobro pendiente',
      subtitle: `${bq.client}${bq.model ? ` · ${bq.model}` : ''}`,
      value:    fmx(bq.pending),
      action:   'Cobrar', onAction: () => setTab('bajoquintos'),
    })
  } else if (pendingCobros.length > 1) {
    const total = pendingCobros.reduce((s, b) => s + b.pending, 0)
    const names = pendingCobros.slice(0, 2).map(b => b.client).join(' · ')
                + (pendingCobros.length > 2 ? ` +${pendingCobros.length - 2}` : '')
    items.push({
      id: 'cobros-multi', urgency: 'normal', icon: '💰',
      title:    `${pendingCobros.length} cobros pendientes`,
      subtitle: names,
      value:    fmx(total),
      action:   'Ver CRM', onAction: () => setTab('bajoquintos'),
    })
  }

  // ── 4. Portafolio (normal) ───────────────────────────────────────────────────
  if (investments.length > 0) {
    const isAuto    = (i) => ['accion', 'etf', 'cripto'].includes(i.type)
    const dayChange = investments.reduce((s, i) => {
      if (!isAuto(i) || !i.dayChange) return s
      return s + Number(i.dayChange) * Number(i.quantity || 1)
    }, 0)
    const hasDay = investments.some(i => isAuto(i) && i.priceUpdatedAt)
    const mLabel = {
      open: 'Mercado abierto ●', premarket: 'Pre-mercado',
      afterhours: 'After-hours', closed: 'Mercado cerrado',
    }[marketStatus] ?? 'Cerrado'
    const dayStr = hasDay && dayChange !== 0 ? ` · Hoy ${dayChange >= 0 ? '+' : ''}${fmx(dayChange)}` : ''
    items.push({
      id: 'portfolio', urgency: 'normal',
      icon:      dayChange < 0 ? '📉' : '📈',
      title:     'Portafolio',
      subtitle:  mLabel + dayStr,
      value:     null,
      action:    isFetching ? 'Actualizando…' : 'Actualizar',
      onAction:  isFetching ? null : onUpdate,
      isLoading: isFetching,
    })
  }

  // ── 5. Meta clave más urgente (normal, máx 1) ───────────────────────────────
  const KEY_META_IDS   = ['dm_emergency', 'dm_ibkr', 'dm_bajos']
  const completedBajos = bajoquintos.filter(b => ['entregado','liquidado'].includes(b.status)).length
  let   metaAdded      = 0
  metas
    .filter(m => KEY_META_IDS.includes(m.id) && Number(m.target || 0) > 0)
    .forEach(m => {
      if (metaAdded >= 1) return
      const cur = m.id === 'dm_emergency' ? stats.totalCash
                : m.id === 'dm_ibkr'      ? stats.investmentValue
                : m.id === 'dm_bajos'     ? completedBajos
                : Number(m.current || 0)
      const tgt = Number(m.target)
      const pct = Math.min(100, (cur / tgt) * 100)
      if (pct >= 100) return
      items.push({
        id: `meta-${m.id}`, urgency: 'normal',
        icon:     m.emoji || '🎯',
        title:    m.name,
        subtitle: m.unit === 'ventas' ? `${cur} de ${tgt} ventas` : `Faltan ${fmx(tgt - cur)}`,
        value:    `${pct.toFixed(0)}%`,
        action:   'Ver meta', onAction: () => setTab('metas'),
        progress: pct,
      })
      metaAdded++
    })

  // Sort crítico → importante → normal, cap at MAX_ACTIONS
  return items
    .sort((a, b) => UGR[a.urgency] - UGR[b.urgency])
    .slice(0, MAX_ACTIONS)
}

// ── ActionCard ────────────────────────────────────────────────────────────────
const URGENCY_STYLE = {
  critico:    { border: 'rgba(225,29,72,0.22)',  bg: 'rgba(225,29,72,0.05)',  btnClr: '#E11D48', btnBg: 'rgba(225,29,72,0.10)'  },
  importante: { border: 'rgba(217,119,6,0.22)',  bg: 'rgba(217,119,6,0.04)', btnClr: '#D97706', btnBg: 'rgba(217,119,6,0.10)'  },
  normal:     { border: 'var(--border)',          bg: 'var(--s1)',            btnClr: '#6366F1', btnBg: 'rgba(99,102,241,0.08)' },
}

function ActionCard({ item }) {
  const st = URGENCY_STYLE[item.urgency] ?? URGENCY_STYLE.normal
  return (
    <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl"
      style={{ background: st.bg, border: `1px solid ${st.border}` }}>
      <span className="text-xl shrink-0 leading-none">{item.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold leading-tight" style={{ color: 'var(--t1)' }}>
          {item.title}
        </p>
        <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--t3)' }}>
          {item.subtitle}
        </p>
        {item.progress !== undefined && (
          <div className="mt-1.5 rounded-full overflow-hidden" style={{ height: 3, background: 'var(--s3)' }}>
            <div className="h-full rounded-full"
              style={{
                width: `${item.progress}%`,
                background: item.progress >= 80 ? '#059669' : item.progress >= 40 ? '#4F46E5' : '#D97706',
                transition: 'width 0.4s',
              }} />
          </div>
        )}
      </div>
      {item.value && (
        <span className="text-sm font-black shrink-0" style={{ color: 'var(--t1)' }}>
          {item.value}
        </span>
      )}
      {item.action && (
        <button
          onClick={item.onAction ?? undefined}
          disabled={!item.onAction || item.isLoading}
          className="btn-press shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1"
          style={{ background: st.btnBg, color: st.btnClr }}>
          {item.isLoading && <Loader2 size={10} className="animate-spin" />}
          {item.action}
        </button>
      )}
    </div>
  )
}

const URGENCY_CFG = {
  critico:    { label: 'Crítico',    dot: '#E11D48', text: '#E11D48' },
  importante: { label: 'Importante', dot: '#D97706', text: '#D97706' },
  normal:     { label: 'Normal',     dot: '#6366F1', text: 'var(--t3)' },
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard({ openModal, setTab }) {
  const state = useFinanceStore()
  const { accounts, cards, transactions, investments, metas, subscriptions, bajoquintos, updateInvestment, networthHistory = [] } = state

  // ── Breakdown expand/collapse ─────────────────────────────────────────────
  const [showBD, setShowBD] = useState(false)
  const bd = useMemo(() => computeBreakdown(state), [state])

  // ── Portfolio price refresh ───────────────────────────────────────────────
  const [isFetchingPrices, setIsFetchingPrices] = useState(false)
  const [marketStatus,     setMarketStatus]     = useState(() => getMarketStatus())

  const handleUpdatePrices = async () => {
    setMarketStatus(getMarketStatus())
    if (!investments.length) return
    setIsFetchingPrices(true)
    try {
      const { prices, underlying, errors } = await fetchMarketPrices(investments)
      if (errors.includes('stock_no_key') && !hasApiKey()) {
        toast('Sin clave de API — solo criptos', { icon: '⚠️' })
      }
      let updated = 0
      investments.forEach(inv => {
        const sym   = inv.ticker?.toUpperCase()
        if (!sym) return
        const isOpt = inv.type === 'call' || inv.type === 'put'
        if (isOpt) {
          const ul = underlying[sym] || prices[sym]
          if (ul) { updateInvestment(inv.id, { underlyingPrice: ul.price, priceUpdatedAt: Date.now() }); updated++ }
        } else if (prices[sym]) {
          const p = prices[sym]
          updateInvestment(inv.id, {
            currentPrice: p.price, dayChange: p.change ?? 0,
            dayChangePct: p.changePct ?? 0, dayHigh: p.high ?? 0,
            dayLow: p.low ?? 0, priceUpdatedAt: Date.now(),
          })
          updated++
        }
      })
      if (updated > 0) toast.success(`${updated} precio${updated !== 1 ? 's' : ''} actualizados`)
      else if (!errors.includes('stock_no_key')) toast('Sin precios actualizables', { icon: 'ℹ️' })
    } catch {
      toast.error('Error al actualizar precios')
    } finally {
      setIsFetchingPrices(false)
    }
  }

  const stats    = useMemo(() => computeStats(state),         [state])
  const alertCnt = useMemo(() => computeAlerts(state).length, [state])
  const flowData = useMemo(() => computeMonthlyFlow(transactions), [transactions])

  // ── Priority action items ─────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const actionItems = useMemo(() => buildActions({
    cards, bajoquintos, investments, metas, stats,
    marketStatus, isFetching: isFetchingPrices,
    openModal, setTab, onUpdate: handleUpdatePrices,
  }), [cards, bajoquintos, investments, metas, stats, marketStatus, isFetchingPrices])

  // ── Approximate historical net worth from cumulative flow
  const nwHistory = useMemo(() =>
    flowData.map((_, i) => {
      const futureFlow = flowData.slice(i + 1).reduce((s, m) => s + m.net, 0)
      return stats.netWorth - futureFlow
    }), [flowData, stats.netWorth])

  // ── Real sparkline from stored snapshots (fallback to approximated flow)
  const nwPoints = useMemo(() => {
    const real = networthHistory.filter(h => h.netWorth !== undefined)
    if (real.length >= 2) {
      return [...real]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-6)
        .map(h => h.netWorth)
    }
    return nwHistory
  }, [networthHistory, nwHistory])
  const nwIsReal = networthHistory.length >= 2

  // ── Investment summary
  const invMetrics = useMemo(() => {
    if (!investments.length) return null
    let totalVal = 0, totalCost = 0
    const positions = investments.map(i => {
      const c = invCalc(i)
      totalVal  += c.val
      totalCost += c.cost
      return { ...i, ...c }
    })
    positions.sort((a, b) => b.pct - a.pct)
    const best  = positions[0]
    const worst = positions[positions.length - 1]
    const totalGain   = totalVal - totalCost
    const totalReturn = totalCost > 0 ? (totalGain / totalCost) * 100 : 0
    return { totalVal, totalCost, totalGain, totalReturn, best, worst }
  }, [investments])

  // ── Live meta values for auto-derived metas (matches computeMetaInsights logic)
  const completedBajosCount = useMemo(() =>
    bajoquintos.filter(b => ['entregado','liquidado'].includes(b.status)).length,
  [bajoquintos])
  const metaLiveValue = (m) =>
    m.id === 'dm_emergency' ? stats.totalCash
    : m.id === 'dm_ibkr'   ? stats.investmentValue
    : m.id === 'dm_bajos'  ? completedBajosCount
    : m.id === 'dm_networth' ? stats.netWorth
    : m.id === 'dm_tarjetas'
      ? (() => { const tgt = Number(m.target) || stats.totalCardDebt; return Math.max(0, tgt - stats.totalCardDebt) })()
    : Number(m.current || 0)

  // ── Top metas (incomplete, highest % first) — use live current values
  const topMetas = useMemo(() => {
    return metas
      .filter(m => Number(m.target || 0) > 0)
      .map(m => {
        const cur = metaLiveValue(m)
        const tgt = Number(m.target)
        const pct = Math.min(100, Math.max(0, (cur / tgt) * 100))
        return { ...m, current: cur, pct }
      })
      .filter(m => m.pct < 100)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metas, stats.totalCash, stats.investmentValue, stats.netWorth, stats.totalCardDebt, completedBajosCount])

  // ── Active subscriptions
  const activeSubs = useMemo(() =>
    subscriptions.filter(s => s.status !== 'cancelled' && s.isActive !== false),
    [subscriptions])
  const subsTotal = activeSubs.reduce((s, sub) => s + Number(sub.amount || 0), 0)

  // ── Combined upcoming payments (cards + subs)
  const upcoming = useMemo(() => [
    ...stats.upcomingCards.map(c => ({
      id: `c-${c.id}`, kind: 'card',
      name: c.bankName || c.alias || 'Tarjeta',
      amount: c.balance, days: c.daysUntilDue, ref: c,
    })),
    ...stats.upcomingSubs.map(s => ({
      id: `s-${s.id}`, kind: 'sub',
      name: s.name, amount: s.amount, days: s.daysUntil, ref: s,
    })),
  ].sort((a, b) => a.days - b.days), [stats])

  const recent       = transactions.slice(0, 5)
  const flowPositive = stats.monthFlow >= 0

  // ── 30-day cash flow projection (normal scenario, for Dashboard widget)
  const cf30 = useMemo(() => computeCashFlow(
    { accounts, cards, bajoquintos, subscriptions, cashflowItems: state.cashflowItems || [] },
    'normal', 30
  ), [accounts, cards, bajoquintos, subscriptions, state.cashflowItems])

  // ── Advisor score (for Dashboard widget)
  const advisorData = useMemo(() => computeAdvisorScore(state), [
    state.accounts, state.cards, state.investments,
    state.bajoquintos, state.metas, state.subscriptions,
    state.cashflowItems, state.transactions,
  ])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mb-nav">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-5 pt-14 pt-safe flex justify-between items-center mb-5">
        <div>
          <p className="text-xs font-semibold capitalize" style={{ color: 'var(--t3)' }}>
            {fmtMonth()}
          </p>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--t1)' }}>
            Real Advisor
          </h1>
        </div>
        <button onClick={() => setTab('alertas')}
          className="btn-press relative w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: 'var(--s1)', border: '1px solid var(--border)',
            boxShadow: '0 1px 4px rgba(0,10,50,0.06)' }}>
          <Bell size={18} color="var(--t2)" />
          {alertCnt > 0 && (
            <span className="absolute top-0 right-0 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
              style={{ background: '#E11D48' }}>
              {alertCnt}
            </span>
          )}
        </button>
      </div>

      {/* ── Acciones prioritarias ───────────────────────────────────────── */}
      {actionItems.length > 0 && (() => {
        const critico    = actionItems.filter(i => i.urgency === 'critico')
        const importante = actionItems.filter(i => i.urgency === 'importante')
        const normal     = actionItems.filter(i => i.urgency === 'normal')
        return (
          <div className="px-5 mb-4">
            {/* Section header */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-base leading-none">⚡</span>
              <p className="text-sm font-bold" style={{ color: 'var(--t1)' }}>
                Acciones prioritarias
              </p>
              {/* Per-category counters */}
              {critico.length > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(225,29,72,0.12)', color: '#E11D48' }}>
                  Críticas {critico.length}
                </span>
              )}
              {importante.length > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(217,119,6,0.10)', color: '#D97706' }}>
                  Imp. {importante.length}
                </span>
              )}
              {normal.length > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.10)', color: '#6366F1' }}>
                  Normal {normal.length}
                </span>
              )}
            </div>

            <div className="space-y-3">
              {/* Crítico band */}
              {critico.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: URGENCY_CFG.critico.dot }} />
                    <span className="text-[9px] font-bold uppercase tracking-widest"
                      style={{ color: URGENCY_CFG.critico.text }}>
                      {URGENCY_CFG.critico.label}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {critico.map(item => <ActionCard key={item.id} item={item} />)}
                  </div>
                </div>
              )}

              {/* Importante band */}
              {importante.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: URGENCY_CFG.importante.dot }} />
                    <span className="text-[9px] font-bold uppercase tracking-widest"
                      style={{ color: URGENCY_CFG.importante.text }}>
                      {URGENCY_CFG.importante.label}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {importante.map(item => <ActionCard key={item.id} item={item} />)}
                  </div>
                </div>
              )}

              {/* Normal band */}
              {normal.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: URGENCY_CFG.normal.dot }} />
                    <span className="text-[9px] font-bold uppercase tracking-widest"
                      style={{ color: URGENCY_CFG.normal.text }}>
                      {URGENCY_CFG.normal.label}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {normal.map(item => <ActionCard key={item.id} item={item} />)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Hero: Patrimonio Neto ────────────────────────────────────────── */}
      <div className="px-5 mb-4">
        <div className="relative overflow-hidden rounded-3xl px-5 pt-5 pb-4"
          style={{ background: 'linear-gradient(135deg,#1e1250 0%,#0d0d2b 55%,#0a1840 100%)' }}>

          {/* Glow orbs */}
          <div className="absolute -top-12 -right-12 w-52 h-52 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle,rgba(99,102,241,0.28),transparent)' }} />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle,rgba(79,70,229,0.18),transparent)' }} />

          <div className="relative">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: 'rgba(167,139,250,0.60)' }}>
              Patrimonio neto
            </p>

            {/* Amount + sparkline */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className={`text-4xl font-black tracking-tight leading-none mb-2 ${
                  stats.netWorth < 0 ? 'text-red-300' : 'text-white'}`}>
                  {fmxC(stats.netWorth)}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <div className="flex items-center gap-1">
                    <TrendingUp size={10} color="#4ADE80" />
                    <span className="text-[11px]" style={{ color: 'rgba(167,139,250,0.72)' }}>
                      Activos {fmxC(stats.totalAssets)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingDown size={10} color="#F87171" />
                    <span className="text-[11px]" style={{ color: 'rgba(167,139,250,0.72)' }}>
                      Pasivos {fmxC(stats.totalLiabilities)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Historical sparkline */}
              <div className="shrink-0 pt-1">
                <NWSparkline points={nwPoints} W={86} H={38} />
                <p className="text-[9px] text-center mt-0.5"
                  style={{ color: 'rgba(167,139,250,0.38)' }}>
                  {nwIsReal ? `${Math.min(networthHistory.length, 6)} cortes` : '6m aprox.'}
                </p>
              </div>
            </div>

            {/* Asset composition pills */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {stats.totalCash > 0 && (
                <div className="px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <span className="text-[10px]" style={{ color: 'rgba(167,139,250,0.78)' }}>
                    💵 {fmxC(stats.totalCash)}
                  </span>
                </div>
              )}
              {stats.investmentValue > 0 && (
                <div className="px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <span className="text-[10px]" style={{ color: 'rgba(167,139,250,0.78)' }}>
                    📈 {fmxC(stats.investmentValue)}
                  </span>
                </div>
              )}
              {stats.manualAssets > 0 && (
                <div className="px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <span className="text-[10px]" style={{ color: 'rgba(167,139,250,0.78)' }}>
                    🏠 {fmxC(stats.manualAssets)}
                  </span>
                </div>
              )}
              {stats.totalCardDebt > 0 && (
                <div className="px-2.5 py-1 rounded-full" style={{ background: 'rgba(225,29,72,0.15)' }}>
                  <span className="text-[10px]" style={{ color: 'rgba(248,113,113,0.9)' }}>
                    💳 -{fmxC(stats.totalCardDebt)}
                  </span>
                </div>
              )}
            </div>

            {/* Breakdown toggle */}
            <button
              onClick={() => setShowBD(v => !v)}
              className="btn-press mt-3 w-full flex items-center justify-between px-3 py-2 rounded-2xl text-[11px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(167,139,250,0.70)', border: '1px solid rgba(99,102,241,0.18)' }}>
              <span>🔍 Desglose patrimonial</span>
              <ChevronRight size={11}
                style={{ transform: showBD ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {/* Breakdown content */}
            {showBD && (() => {
              const ST = { fontSize:9, color:'rgba(167,139,250,0.38)', paddingLeft:18, marginTop:1 }
              const SRow = ({ label, value, dim }) => (
                <div className="flex justify-between items-center py-0.5 pl-5">
                  <span style={{ fontSize:10, color:'rgba(167,139,250,0.48)' }}>{label}</span>
                  <span style={{ fontSize:10, fontWeight:700, color: dim ? 'rgba(167,139,250,0.28)' : 'rgba(167,139,250,0.72)' }}>
                    {value}
                  </span>
                </div>
              )
              const Sep = () => <div style={{ height:1, background:'rgba(255,255,255,0.07)', margin:'5px 0' }} />
              return (
                <div className="mt-2 rounded-2xl px-3 py-3 fade-in space-y-0.5"
                  style={{ background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.07)' }}>

                  {/* ── ACTIVOS ─────────────────────────────────────── */}
                  <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em',
                    color:'rgba(167,139,250,0.45)', marginBottom:5 }}>
                    Activos · {fmxC(bd.totalAssets)}
                  </p>

                  {/* Efectivo */}
                  <BDRow emoji="💵" label="Efectivo" value={fmxC(bd.cash.total)}
                    color={bd.cash.total > 0 ? '#4ADE80' : 'rgba(167,139,250,0.35)'} />
                  {bd.cash.items.map(a => (
                    <SRow key={a.id} label={a.name} value={a.amount > 0 ? fmxC(a.amount) : '$0'} dim={a.amount === 0} />
                  ))}
                  {bd.cash.total === 0 && (
                    <p style={ST}>↓ Sube captura de BBVA · Revolut · Stori · Nu para actualizar saldo</p>
                  )}

                  {/* Inversiones */}
                  <BDRow emoji="📈" label="Inversiones" value={fmxC(bd.investments.total)}
                    color={bd.investments.total > 0 ? '#818CF8' : 'rgba(167,139,250,0.35)'} />
                  {bd.investments.ibkrNLV != null && bd.investments.ibkrNLV > 0 && (
                    <div className="pl-5">
                      <div className="flex justify-between items-center py-0.5">
                        <span style={{ fontSize:10, color:'rgba(167,139,250,0.48)' }}>IBKR NLV</span>
                        <span style={{ fontSize:10, fontWeight:700, color:'rgba(167,139,250,0.72)' }}>
                          {fmxC(bd.investments.ibkrNLV)}
                        </span>
                      </div>
                      {bd.investments.ibkrSyncedAt && (
                        <p style={{ fontSize:9, color:'rgba(167,139,250,0.32)', marginTop:1 }}>
                          {bd.investments.ibkrSource === 'capture' ? '📷 Captura OCR' :
                           bd.investments.ibkrSource === 'test'    ? '🧪 Datos de prueba' : '🔌 API IBKR'}
                          {' · '}{new Date(bd.investments.ibkrSyncedAt).toLocaleString('es-MX',
                            { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                        </p>
                      )}
                    </div>
                  )}
                  {bd.investments.positions.map(p => (
                    <SRow key={p.id} label={p.ticker} value={fmxC(p.amount)} />
                  ))}
                  {bd.investments.total === 0 && (
                    <p style={ST}>↓ Sube captura de IBKR para ver NLV · o agrega posiciones manualmente</p>
                  )}

                  {/* Por cobrar */}
                  {bd.receivables.total > 0 && (
                    <>
                      <BDRow emoji="🎸" label="Por cobrar" value={fmxC(bd.receivables.total)} color="#F59E0B" />
                      {bd.receivables.items.map(r => (
                        <SRow key={r.id} label={r.name + (r.model ? ' · ' + r.model : '')} value={fmxC(r.amount)} />
                      ))}
                    </>
                  )}

                  {/* Otros activos */}
                  {bd.manualAssets.total > 0 && (
                    <>
                      <BDRow emoji="🏠" label="Otros activos" value={fmxC(bd.manualAssets.total)} color="#60A5FA" />
                      {bd.manualAssets.items.map(a => (
                        <SRow key={a.id} label={a.name} value={fmxC(a.amount)} />
                      ))}
                    </>
                  )}

                  <Sep />
                  <div className="flex justify-between items-center">
                    <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.75)' }}>Total activos</span>
                    <span style={{ fontSize:11, fontWeight:700, color:'#4ADE80' }}>{fmxC(bd.totalAssets)}</span>
                  </div>

                  {/* ── PASIVOS ─────────────────────────────────────── */}
                  <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em',
                    color:'rgba(167,139,250,0.45)', marginTop:10, marginBottom:5 }}>
                    Pasivos · {fmxC(bd.totalLiabilities)}
                  </p>

                  <BDRow emoji="💳" label="Tarjetas" value={bd.cardDebt.total > 0 ? `−${fmxC(bd.cardDebt.total)}` : '$0'}
                    color={bd.cardDebt.total > 0 ? '#F87171' : 'rgba(167,139,250,0.35)'} />
                  {bd.cardDebt.items.map(c => (
                    <SRow key={c.id} label={c.name} value={c.amount > 0 ? fmxC(c.amount) : '$0'} dim={c.amount === 0} />
                  ))}
                  {bd.cardDebt.total === 0 && (
                    <p style={ST}>↓ Sube captura de Nu · BBVA · Stori · DiDi para actualizar saldo</p>
                  )}

                  {bd.manualLiabilities.total > 0 && (
                    <>
                      <BDRow emoji="📦" label="Otros pasivos" value={`−${fmxC(bd.manualLiabilities.total)}`} color="#F87171" />
                      {bd.manualLiabilities.items.map(l => (
                        <SRow key={l.id} label={l.name} value={fmxC(l.amount)} />
                      ))}
                    </>
                  )}

                  <Sep />
                  <div className="flex justify-between items-center">
                    <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.75)' }}>Total pasivos</span>
                    <span style={{ fontSize:11, fontWeight:700, color: bd.totalLiabilities > 0 ? '#F87171' : 'rgba(167,139,250,0.35)' }}>
                      {bd.totalLiabilities > 0 ? `−${fmxC(bd.totalLiabilities)}` : '$0'}
                    </span>
                  </div>

                  {/* ── FÓRMULA ─────────────────────────────────────── */}
                  <div className="mt-2 pt-2" style={{ borderTop:'1px solid rgba(255,255,255,0.10)' }}>
                    <p style={{ fontSize:9, color:'rgba(167,139,250,0.38)', marginBottom:3 }}>
                      Fórmula: activos − pasivos = patrimonio neto
                    </p>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize:10, color:'rgba(167,139,250,0.55)' }}>
                        {fmxC(bd.totalAssets)} − {fmxC(bd.totalLiabilities)} =
                      </span>
                      <span style={{ fontSize:16, fontWeight:900, color: bd.netWorth >= 0 ? '#4ADE80' : '#F87171' }}>
                        {fmxC(bd.netWorth)}
                      </span>
                    </div>
                    <p style={{ fontSize:8, color:'rgba(167,139,250,0.25)', marginTop:4, textAlign:'right' }}>
                      Calculado: {new Date(bd.computedAt).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Ver evolución button */}
            <button onClick={() => setTab('evolucion')}
              className="btn-press mt-2 w-full flex items-center justify-center gap-1 py-2 rounded-2xl text-[11px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(167,139,250,0.70)', border: '1px solid rgba(99,102,241,0.18)' }}>
              📊 Ver evolución patrimonial <ChevronRight size={11} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Flujo del mes ────────────────────────────────────────────────── */}
      <div className="px-5 mb-4">
        <div className="grid grid-cols-3 gap-2.5">

          <div className="stat-card">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center mb-2"
              style={{ background: 'rgba(5,150,105,0.10)' }}>
              <ArrowUpRight size={14} color="#059669" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5"
              style={{ color: 'var(--t3)' }}>Ingresos</p>
            <p className="text-sm font-black text-emerald-600">{fmxC(stats.monthIncome)}</p>
            <MoDelta curr={stats.monthIncome} prev={stats.prevMonthIncome} />
          </div>

          <div className="stat-card">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center mb-2"
              style={{ background: 'rgba(225,29,72,0.10)' }}>
              <ArrowDownRight size={14} color="#E11D48" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5"
              style={{ color: 'var(--t3)' }}>Gastos</p>
            <p className="text-sm font-black text-rose-600">{fmxC(stats.monthExpenses)}</p>
            <MoDelta curr={stats.monthExpenses} prev={stats.prevMonthExpenses} inverse />
          </div>

          <div className="stat-card">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center mb-2"
              style={{ background: flowPositive ? 'rgba(5,150,105,0.10)' : 'rgba(225,29,72,0.08)' }}>
              {flowPositive
                ? <ArrowUpRight  size={14} color="#059669" />
                : <ArrowDownRight size={14} color="#E11D48" />}
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5"
              style={{ color: 'var(--t3)' }}>Flujo</p>
            <p className={`text-sm font-black ${flowPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {fmxC(stats.monthFlow)}
            </p>
            <MoDelta curr={stats.monthFlow} prev={stats.prevMonthFlow} />
          </div>

        </div>
      </div>

      {/* ── Resumen patrimonial 2 × 2 ────────────────────────────────────── */}
      <div className="px-5 mb-4">
        <div className="grid grid-cols-2 gap-2.5">

          {/* Efectivo disponible */}
          <button onClick={() => setTab('cuentas')}
            className="stat-card btn-press text-left">
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(5,150,105,0.10)' }}>
                <Wallet size={13} color="#059669" />
              </div>
              <ChevronRight size={12} color="var(--t3)" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--t3)' }}>Efectivo</p>
            <p className="text-lg font-black text-emerald-600 mt-0.5 leading-tight">
              {fmxC(stats.totalCash)}
            </p>
            <p className="text-[10px] mt-0.5 font-medium" style={{ color: 'var(--t3)' }}>
              {accounts.length} cuenta{accounts.length !== 1 ? 's' : ''}
            </p>
          </button>

          {/* Tarjetas */}
          <button onClick={() => setTab('cards')}
            className="stat-card btn-press text-left">
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(225,29,72,0.08)' }}>
                <CreditCard size={13} color="#E11D48" />
              </div>
              <ChevronRight size={12} color="var(--t3)" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--t3)' }}>Tarjetas</p>
            <p className="text-lg font-black text-rose-600 mt-0.5 leading-tight">
              {fmxC(stats.totalCardDebt)}
            </p>
            {stats.totalCardLimit > 0 && (
              <p className="text-[10px] mt-0.5 font-medium" style={{ color: 'var(--t3)' }}>
                {stats.creditUtil.toFixed(0)}% utilizado
              </p>
            )}
          </button>

          {/* Inversiones */}
          <button onClick={() => setTab('inversiones')}
            className="stat-card btn-press text-left">
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(79,70,229,0.10)' }}>
                <TrendingUp size={13} color="var(--accent)" />
              </div>
              <ChevronRight size={12} color="var(--t3)" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--t3)' }}>Inversiones</p>
            <p className="text-lg font-black mt-0.5 leading-tight" style={{ color: 'var(--accent)' }}>
              {fmxC(stats.investmentValue)}
            </p>
            {stats.investmentPnL !== 0 && (
              <p className={`text-[10px] mt-0.5 font-semibold ${
                stats.investmentPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                P&L {stats.investmentPnL >= 0 ? '+' : ''}{fmxC(stats.investmentPnL)}
              </p>
            )}
          </button>

          {/* Por cobrar */}
          <button onClick={() => setTab('bajoquintos')}
            className="stat-card btn-press text-left">
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(217,119,6,0.10)' }}>
                <span className="text-sm leading-none">🎸</span>
              </div>
              <ChevronRight size={12} color="var(--t3)" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--t3)' }}>Por cobrar</p>
            <p className="text-lg font-black text-amber-600 mt-0.5 leading-tight">
              {fmxC(stats.bqStats.totalPending)}
            </p>
            {stats.bqStats.totalCollected > 0 && (
              <p className="text-[10px] mt-0.5 font-medium text-emerald-600">
                ✓ {fmxC(stats.bqStats.totalCollected)} cobrado
              </p>
            )}
            <p className="text-[10px] mt-0.5 font-medium" style={{ color: 'var(--t3)' }}>
              {stats.bqStats.pendingCount} cliente{stats.bqStats.pendingCount !== 1 ? 's' : ''} · {fmxC(stats.bqStats.totalSales)} ventas
            </p>
          </button>

        </div>
      </div>

      {/* ── Score Advisor widget ─────────────────────────────────────────── */}
      <div className="px-5 mb-4">
        <button onClick={() => setTab('advisor')} className="btn-press w-full text-left">
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
            style={{
              background: 'var(--s1)',
              border: `1px solid ${
                advisorData.total >= 70 ? 'rgba(34,197,94,0.25)' :
                advisorData.total >= 50 ? 'rgba(245,158,11,0.25)' :
                'rgba(239,68,68,0.25)'}`,
            }}>
            {/* Score bubble */}
            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: `${advisorData.labelColor}15`,
                border: `2px solid ${advisorData.labelColor}40`,
              }}>
              <span className="text-base font-black leading-none"
                style={{ color: advisorData.labelColor }}>
                {advisorData.total}
              </span>
            </div>
            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <BrainCircuit size={10} color="var(--t3)" />
                <p className="text-[10px] font-bold uppercase tracking-wide"
                  style={{ color: 'var(--t3)' }}>Score Financiero</p>
              </div>
              <p className="text-sm font-black" style={{ color: advisorData.labelColor }}>
                {advisorData.label}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--t3)' }}>
                {advisorData.insights.filter(i => i.priority === 'critico').length > 0
                  ? `⚠️ ${advisorData.insights.filter(i => i.priority === 'critico').length} situación crítica`
                  : advisorData.insights.filter(i => i.priority === 'importante').length > 0
                    ? `${advisorData.insights.filter(i => i.priority === 'importante').length} aspecto${advisorData.insights.filter(i => i.priority === 'importante').length !== 1 ? 's' : ''} por mejorar`
                    : 'Ver análisis completo →'}
              </p>
            </div>
            {/* Mini dimension bars */}
            <div className="shrink-0 flex flex-col gap-1.5" style={{ width: 48 }}>
              {advisorData.dimensions.slice(0, 5).map(d => (
                <div key={d.key}
                  style={{ height: 3, background: 'var(--s3)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(d.score / d.max) * 100}%`,
                    background:
                      d.status === 'green'  ? '#22C55E' :
                      d.status === 'yellow' ? '#F59E0B' :
                      d.status === 'orange' ? '#F97316' : '#EF4444',
                    borderRadius: 99,
                  }} />
                </div>
              ))}
            </div>
            <ChevronRight size={14} color="var(--t3)" />
          </div>
        </button>
      </div>

      {/* ── Reporte Ejecutivo banner ──────────────────────────────────────── */}
      <div className="px-5 mb-4">
        <button onClick={() => setTab('reporte')} className="btn-press w-full text-left">
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg,rgba(219,39,119,0.08),rgba(124,58,237,0.06))',
              border: '1px solid rgba(219,39,119,0.20)',
            }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(219,39,119,0.12)' }}>
              <span className="text-lg leading-none">📋</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5"
                style={{ color: 'var(--t3)' }}>Análisis mensual</p>
              <p className="text-sm font-black" style={{ color: 'var(--t1)' }}>Reporte Ejecutivo</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--t3)' }}>
                6 secciones · inversiones, metas, CRM, recomendaciones
              </p>
            </div>
            <ChevronRight size={14} color="var(--t3)" />
          </div>
        </button>
      </div>

      {/* ── Flujo de caja proyectado 30d ─────────────────────────────────── */}
      <div className="px-5 mb-4">
        <button className="btn-press w-full text-left" onClick={() => setTab('cashflow')}>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div className="flex justify-between items-center mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--t3)' }}>
                  Flujo proyectado · 30 días
                </p>
                <p className="text-xl font-black mt-0.5"
                  style={{ color: cf30.isSurplus ? '#059669' : '#E11D48' }}>
                  {fmxC(cf30.projectedBalance)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  style={{
                    background: cf30.isSurplus ? '#D1FAE5' : '#FEE2E2',
                    color:      cf30.isSurplus ? '#059669' : '#E11D48',
                  }}>
                  {cf30.isSurplus ? '▲' : '▼'} {fmxC(Math.abs(cf30.netFlow))}
                </div>
                <ChevronRight size={16} color="var(--t3)" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Hoy',      val: cf30.startCash,     color: 'var(--t2)' },
                { label: 'Entradas', val: cf30.totalInflows,  color: '#059669'   },
                { label: 'Salidas',  val: cf30.totalOutflows, color: '#E11D48'   },
              ].map(s => (
                <div key={s.label} className="rounded-xl px-2.5 py-2" style={{ background: 'var(--s2)' }}>
                  <p className="text-[9px] font-semibold uppercase mb-1" style={{ color: 'var(--t3)' }}>
                    {s.label}
                  </p>
                  <p className="text-sm font-black" style={{ color: s.color }}>
                    {fmxC(s.val)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </button>
      </div>

      {/* ── Tarjetas de crédito ──────────────────────────────────────────── */}
      {cards.length > 0 && stats.totalCardLimit > 0 && (
        <div className="px-5 mb-4">
          <SectionHead title="Tarjetas de crédito" action="Ver todas" onAction={() => setTab('cards')} />
          <div className="card">
            {/* Overall utilization */}
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-medium" style={{ color: 'var(--t2)' }}>
                Utilización total
              </span>
              <span className="text-sm font-black"
                style={{ color: utilStyle(stats.creditUtil).text }}>
                {stats.creditUtil.toFixed(0)}%
              </span>
            </div>
            <Bar pct={stats.creditUtil} gradient={utilStyle(stats.creditUtil).grad} h={6} />
            <p className="text-[11px] mt-1.5 mb-3 font-medium" style={{ color: 'var(--t3)' }}>
              {fmx(stats.totalCardDebt)} de {fmx(stats.totalCardLimit)} usado
            </p>

            {/* Per-card rows */}
            <div className="space-y-3">
              {cards.slice(0, 4).map(c => {
                const bal  = Number(c.balance || 0)
                const lim  = Number(c.limit || 0)
                const u    = lim > 0 ? (bal / lim) * 100 : 0
                const us   = utilStyle(u)
                return (
                  <div key={c.id}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold truncate"
                        style={{ color: 'var(--t1)', maxWidth: '55%' }}>
                        {c.bankName || c.alias}
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-bold" style={{ color: 'var(--t1)' }}>
                          {fmxC(bal)}
                        </span>
                        {lim > 0 && (
                          <span className="text-[10px] font-medium" style={{ color: 'var(--t3)' }}>
                            / {fmxC(lim)}
                          </span>
                        )}
                      </div>
                    </div>
                    {lim > 0 && <Bar pct={u} gradient={us.grad} h={4} />}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Portafolio de inversiones ────────────────────────────────────── */}
      {investments.length > 0 && invMetrics && (
        <div className="px-5 mb-4">
          <SectionHead title="Portafolio" action="Ver todo" onAction={() => setTab('inversiones')} />
          <div className="card">
            {/* 2 × 2 stats grid */}
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--t3)' }}>Valor</p>
                <p className="text-base font-black mt-0.5" style={{ color: 'var(--t1)' }}>
                  {fmxC(invMetrics.totalVal)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--t3)' }}>Capital</p>
                <p className="text-base font-black mt-0.5" style={{ color: 'var(--t1)' }}>
                  {fmxC(invMetrics.totalCost)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--t3)' }}>Ganancia</p>
                <p className={`text-base font-black mt-0.5 ${
                  invMetrics.totalGain >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {invMetrics.totalGain >= 0 ? '+' : ''}{fmxC(invMetrics.totalGain)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--t3)' }}>Retorno</p>
                <p className={`text-base font-black mt-0.5 ${
                  invMetrics.totalReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {invMetrics.totalReturn >= 0 ? '+' : ''}{invMetrics.totalReturn.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Best / Worst chips */}
            {invMetrics.best && (
              <div className="flex gap-2">
                <div className="flex-1 rounded-xl px-3 py-2"
                  style={{ background: 'rgba(5,150,105,0.08)' }}>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700 mb-0.5">
                    ↑ Mejor
                  </p>
                  <p className="text-sm font-black text-emerald-700 leading-tight">
                    {invMetrics.best.ticker}
                  </p>
                  <p className="text-[10px] text-emerald-600 font-semibold">
                    {invMetrics.best.pct >= 0 ? '+' : ''}{invMetrics.best.pct.toFixed(1)}%
                  </p>
                </div>
                {invMetrics.worst && invMetrics.worst.id !== invMetrics.best.id && (
                  <div className="flex-1 rounded-xl px-3 py-2"
                    style={{ background: 'rgba(225,29,72,0.07)' }}>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-rose-600 mb-0.5">
                      ↓ Peor
                    </p>
                    <p className="text-sm font-black text-rose-600 leading-tight">
                      {invMetrics.worst.ticker}
                    </p>
                    <p className="text-[10px] text-rose-500 font-semibold">
                      {invMetrics.worst.pct >= 0 ? '+' : ''}{invMetrics.worst.pct.toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Metas financieras ────────────────────────────────────────────── */}
      {topMetas.length > 0 && (
        <div className="px-5 mb-4">
          <SectionHead title="Metas financieras" action="Ver todas" onAction={() => setTab('metas')} />
          <div className="space-y-2.5">
            {topMetas.map(m => {
              const cur = Number(m.current || 0)
              const tgt = Number(m.target  || 1)
              const pct = Math.min(100, (cur / tgt) * 100)
              const c   = pct >= 80 ? '#059669' : pct >= 40 ? '#4F46E5' : '#D97706'
              const grad = pct >= 80
                ? 'linear-gradient(90deg,#059669,#22C55E)'
                : pct >= 40
                  ? 'linear-gradient(90deg,#4F46E5,#6366F1)'
                  : 'linear-gradient(90deg,#D97706,#F59E0B)'
              return (
                <div key={m.id} className="card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl leading-none">{m.emoji || '🎯'}</span>
                      <div>
                        <p className="text-sm font-bold" style={{ color: 'var(--t1)' }}>
                          {m.name}
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--t3)' }}>
                          {fmx(cur)} de {fmx(tgt)}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-black" style={{ color: c }}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <Bar pct={pct} gradient={grad} h={5} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Acciones rápidas ─────────────────────────────────────────────── */}
      <div className="px-5 mb-4">
        <p className="text-[11px] font-bold mb-3 uppercase tracking-wide"
          style={{ color: 'var(--t3)' }}>
          Acciones rápidas
        </p>
        <div className="flex gap-2">
          <QuickBtn emoji="💸" label="Gasto"   onClick={() => openModal('transaction', { type: 'gasto'   })} />
          <QuickBtn emoji="💰" label="Ingreso" onClick={() => openModal('transaction', { type: 'ingreso' })} />
          <QuickBtn emoji="💳" label="Pago"    onClick={() => openModal('payment', null)} />
          <QuickBtn emoji="🎸" label="Venta"   onClick={() => openModal('bajoquinto', null)} />
        </div>
      </div>

      {/* ── Próximos cobros (cards + subs) ───────────────────────────────── */}
      {upcoming.length > 0 && (
        <div className="px-5 mb-4">
          <SectionHead title="Próximos cobros" />
          <div className="space-y-2">
            {upcoming.map(item => {
              const urgent  = item.days <= 2
              const daysLbl = item.days === 0 ? '¡Hoy!'
                            : item.days === 1 ? 'Mañana'
                            : `En ${item.days} días`
              return (
                <div key={item.id} className="card flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                    style={{ background: item.kind === 'card'
                      ? 'rgba(225,29,72,0.08)' : 'rgba(79,70,229,0.08)' }}>
                    {item.kind === 'card' ? '💳' : '📱'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--t1)' }}>
                      {item.name}
                    </p>
                    <p className="text-[11px] font-medium"
                      style={{ color: urgent ? '#E11D48' : 'var(--t3)' }}>
                      {daysLbl}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black" style={{ color: 'var(--t1)' }}>
                      {fmx(item.amount)}
                    </p>
                    {item.kind === 'card' && (
                      <button onClick={() => openModal('payment', item.ref)}
                        className="text-[10px] font-bold"
                        style={{ color: 'var(--accent)' }}>
                        Pagar →
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Suscripciones ────────────────────────────────────────────────── */}
      {activeSubs.length > 0 && (
        <div className="px-5 mb-4">
          <SectionHead title="Suscripciones" action="Ver todas" onAction={() => setTab('suscripciones')} />
          <div className="card flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-1">
                <p className="text-lg font-black" style={{ color: 'var(--t1)' }}>
                  {fmxC(subsTotal)}
                </p>
                <span className="text-xs font-semibold" style={{ color: 'var(--t3)' }}>/mes</span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--t3)' }}>
                {activeSubs.length} activa{activeSubs.length !== 1 ? 's' : ''}
              </p>
            </div>
            {/* Avatar stack */}
            <div className="flex -space-x-1.5">
              {activeSubs.slice(0, 5).map((s, i) => (
                <div key={s.id}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2"
                  style={{
                    background: 'var(--s2)',
                    borderColor: 'var(--s1)',
                    zIndex: 5 - i,
                    fontSize: 14,
                  }}>
                  📱
                </div>
              ))}
              {activeSubs.length > 5 && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold border-2"
                  style={{ background: 'var(--s3)', borderColor: 'var(--s1)',
                    color: 'var(--t3)', zIndex: 0 }}>
                  +{activeSubs.length - 5}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Flujo mensual ─────────────────────────────────────────────────── */}
      <div className="px-5 mb-4">
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-bold" style={{ color: 'var(--t1)' }}>Flujo mensual</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm" style={{ background: '#059669' }} />
                <span className="text-[10px]" style={{ color: 'var(--t3)' }}>Ingresos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm" style={{ background: '#E11D48' }} />
                <span className="text-[10px]" style={{ color: 'var(--t3)' }}>Gastos</span>
              </div>
            </div>
          </div>
          <div style={{ height: 76, overflow: 'hidden' }}>
            <FlowChart data={flowData} />
          </div>
        </div>
      </div>

      {/* ── Mis cuentas ──────────────────────────────────────────────────── */}
      {accounts.length > 0 && (
        <div className="px-5 mb-4">
          <SectionHead title="Mis cuentas" action="Ver todas" onAction={() => setTab('cuentas')} />
          <div className="space-y-2">
            {accounts.slice(0, 3).map(a => (
              <div key={a.id}
                className={`rounded-2xl px-4 py-3 flex justify-between items-center bg-gradient-to-r ${getAccountGradient(a.colorIndex)}`}>
                <div>
                  <p className="text-white font-semibold text-sm">{a.name}</p>
                  <p className="text-white/55 text-xs">{a.institution}</p>
                </div>
                <p className="text-white font-black text-base">{fmxC(a.balance)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Últimas transacciones ─────────────────────────────────────────── */}
      <div className="px-5">
        <SectionHead
          title="Últimas transacciones"
          action="Libro Mayor"
          onAction={() => setTab('libro')}
        />
        {recent.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-3xl mb-3">📊</p>
            <p className="text-sm font-medium" style={{ color: 'var(--t2)' }}>
              Sin movimientos aún
            </p>
            <button onClick={() => openModal('transaction', { type: 'ingreso' })}
              className="mt-4 btn-press px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              Registrar primer ingreso
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {recent.map(tx => {
              const m = txMeta(tx.type)
              return (
                <div key={tx.id} className="card flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                    style={{ background: 'var(--s2)' }}>
                    {m.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--t1)' }}>
                      {tx.description}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--t3)' }}>{tx.date}</p>
                  </div>
                  <p className={`font-bold text-sm shrink-0 ${m.cls}`}>
                    {m.sign}{fmx(tx.amount)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

import { useMemo, useState } from 'react'
import { Share2, Printer, FileText, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import useFinanceStore        from '../store/useFinanceStore.js'
import { computeStats, computeMetaInsights, computePlannerData } from '../store/selectors.js'
import { getMarketStatus }    from '../lib/priceApi.js'
import { fmx, fmxC, fmtMonth } from '../lib/formatters.js'
import { PROSPECT_STATUSES, CLOSED_STATUSES } from '../store/defaultData.js'
import { openPrintReport }    from '../lib/pdfReport.js'
import toast from 'react-hot-toast'

const num = (n) => Number(n) || 0

// ── UI primitives ──────────────────────────────────────────────────────────────
function SecCard({ children, style }) {
  return (
    <div className="rounded-3xl px-4 py-4 mb-4"
      style={{ background: 'var(--s1)', border: '1px solid var(--border)', ...style }}>
      {children}
    </div>
  )
}

function SecHead({ emoji, title, badge, badgeColor = '#6366F1' }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base leading-none">{emoji}</span>
      <p className="text-sm font-black" style={{ color: 'var(--t1)' }}>{title}</p>
      {badge !== undefined && (
        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${badgeColor}18`, color: badgeColor }}>
          {badge}
        </span>
      )}
    </div>
  )
}

function Row({ label, value, color, sub, last = false }) {
  return (
    <div className="flex items-center justify-between py-2.5"
      style={{ borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <span className="text-[11px] font-semibold" style={{ color: 'var(--t3)' }}>{label}</span>
      <div className="text-right">
        <p className="text-sm font-black" style={{ color: color || 'var(--t1)' }}>{value}</p>
        {sub && <p className="text-[9px] mt-0.5" style={{ color: 'var(--t3)' }}>{sub}</p>}
      </div>
    </div>
  )
}

function Pill({ label, color = '#6366F1' }) {
  return (
    <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mr-1"
      style={{ background: `${color}18`, color }}>
      {label}
    </span>
  )
}

// ── Priority styles ────────────────────────────────────────────────────────────
const REC_STYLE = {
  critico:    { bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.22)',  dot: '#EF4444', lbl: 'Crítico'    },
  importante: { bg: 'rgba(249,115,22,0.05)', border: 'rgba(249,115,22,0.22)', dot: '#F97316', lbl: 'Importante' },
  normal:     { bg: 'var(--s2)',              border: 'var(--border)',          dot: '#6366F1', lbl: 'Sugerido'   },
}

// ── Recommendations engine ─────────────────────────────────────────────────────
function buildRecs({ stats, cards, investments, metaList, bajoquintos, subscriptions, networthHistory }) {
  const recs = []
  const now  = new Date()

  // 1 · Deuda crítica
  if (stats.creditUtil > 50) {
    recs.push({
      priority: 'critico', icon: '💳',
      title: 'Pagar deuda de tarjetas',
      desc: `Utilizas el ${stats.creditUtil.toFixed(0)}% de tu crédito (límite saludable: 30%). Prioriza liquidar ${fmxC(stats.totalCardDebt)}.`,
      action: 'tarjetas',
    })
  } else if (stats.creditUtil > 30) {
    recs.push({
      priority: 'importante', icon: '💳',
      title: 'Reducir uso de tarjetas',
      desc: `${stats.creditUtil.toFixed(0)}% utilizado — por encima del 30% recomendado. Paga más del mínimo.`,
      action: 'tarjetas',
    })
  }

  // 2 · Patrimonio negativo
  if (stats.netWorth < 0) {
    recs.push({
      priority: 'critico', icon: '⚠️',
      title: 'Patrimonio neto negativo',
      desc: `Tus pasivos superan tus activos por ${fmxC(Math.abs(stats.netWorth))}. Enfócate en reducir deudas antes de invertir.`,
      action: 'activos',
    })
  }

  // 3 · Cobrar clientes
  const pendingBqs = bajoquintos.filter(b => {
    const paid    = num(b.deposit) + (b.payments || []).reduce((s, p) => s + num(p.amount), 0)
    const pending = num(b.salePrice) - paid
    return pending > 0 && ['terminado', 'apartado', 'en_fabricacion', 'enviado'].includes(b.status)
  })
  const totalPending = pendingBqs.reduce((s, b) => {
    const paid = num(b.deposit) + (b.payments || []).reduce((a, p) => a + num(p.amount), 0)
    return s + Math.max(0, num(b.salePrice) - paid)
  }, 0)
  if (totalPending > 0) {
    recs.push({
      priority: 'importante', icon: '🎸',
      title: 'Cobrar a clientes',
      desc: `Tienes ${fmxC(totalPending)} pendientes en ${pendingBqs.length} cliente${pendingBqs.length !== 1 ? 's' : ''}. Contáctalos esta semana.`,
      action: 'bajoquintos',
    })
  }

  // 4 · Fondo de emergencia bajo
  const emergency = metaList.find(m => m.id === 'dm_emergency')
  if (emergency && !emergency.isDone) {
    const urgency = emergency.pct < 20 ? 'critico' : emergency.pct < 60 ? 'importante' : 'normal'
    recs.push({
      priority: urgency, icon: '🛡️',
      title: 'Fortalecer fondo de emergencia',
      desc: `Solo tienes el ${emergency.pct.toFixed(0)}% de tu meta de emergencia (${fmxC(emergency.current)} de ${fmxC(emergency.target)}). Aparta ${fmxC(Math.min(emergency.remaining, stats.totalCash * 0.1))} este mes.`,
      action: 'metas',
    })
  }

  // 5 · Flujo positivo → invertir excedente
  if (stats.monthFlow > 3000 && stats.creditUtil < 40) {
    const sugerido = stats.monthFlow * 0.4
    recs.push({
      priority: 'normal', icon: '📈',
      title: 'Invertir el excedente del mes',
      desc: `Tu flujo neto este mes es +${fmxC(stats.monthFlow)}. Considera invertir al menos ${fmxC(sugerido)} para hacer crecer tu patrimonio.`,
      action: 'inversiones',
    })
  }

  // 6 · Suscripciones altas
  const activeSubs  = subscriptions.filter(s => s.status !== 'cancelled' && s.isActive !== false)
  const subsTotal   = activeSubs.reduce((s, sub) => s + num(sub.amount), 0)
  if (subsTotal > 800) {
    recs.push({
      priority: 'normal', icon: '📱',
      title: 'Revisar suscripciones recurrentes',
      desc: `Pagas ${fmxC(subsTotal)}/mes en ${activeSubs.length} suscripciones. Evalúa cuáles no usas y cancélalas.`,
      action: 'suscripciones',
    })
  }

  // 7 · Sin inversiones con mucho efectivo
  if (investments.length === 0 && stats.totalCash > 20000) {
    recs.push({
      priority: 'normal', icon: '💡',
      title: 'Empieza a invertir',
      desc: `Tienes ${fmxC(stats.totalCash)} en efectivo. El dinero parado pierde valor. Considera CETES, ETFs o acciones.`,
      action: 'inversiones',
    })
  }

  // 8 · Seguimientos CRM vencidos
  const overdueFollowups = bajoquintos.filter(b => {
    if (!PROSPECT_STATUSES.includes(b.status)) return false
    if (b.nextFollowUp) {
      try { return new Date(b.nextFollowUp + 'T00:00:00') <= now } catch { return false }
    }
    const ref = b.lastContact ? new Date(b.lastContact + 'T00:00:00')
              : b.createdAt ? new Date(b.createdAt) : null
    return ref ? Math.floor((now - ref) / 86_400_000) >= 3 : false
  })
  if (overdueFollowups.length > 0) {
    recs.push({
      priority: 'importante', icon: '💬',
      title: 'Contactar prospectos',
      desc: `${overdueFollowups.length} prospecto${overdueFollowups.length !== 1 ? 's' : ''} sin seguimiento. Cada día sin contacto reduce la probabilidad de venta.`,
      action: 'bajoquintos',
    })
  }

  // 9 · Flujo negativo → reducir gastos
  if (stats.monthFlow < -1000) {
    recs.push({
      priority: 'critico', icon: '✂️',
      title: 'Reducir gastos inmediatamente',
      desc: `Tu flujo este mes es ${fmxC(stats.monthFlow)}. Estás gastando más de lo que entra. Revisa y recorta gastos no esenciales.`,
      action: 'movimientos',
    })
  }

  // Sort by priority
  const ORDER = { critico: 0, importante: 1, normal: 2 }
  return recs.sort((a, b) => ORDER[a.priority] - ORDER[b.priority])
}

// ── Risk level ─────────────────────────────────────────────────────────────────
function calcRisk({ stats, criticalCount }) {
  let score = 0
  if (stats.creditUtil > 50)      score += 3
  else if (stats.creditUtil > 30) score += 1
  if (stats.netWorth < 0)         score += 3
  if (stats.monthFlow < 0)        score += 2
  if (criticalCount > 0)          score += criticalCount
  if (score >= 5) return { label: 'Alto', color: '#EF4444' }
  if (score >= 2) return { label: 'Medio', color: '#F97316' }
  return { label: 'Bajo', color: '#22C55E' }
}

// ── Export: generate text report ───────────────────────────────────────────────
function generateTextReport({ stats, invMetrics, bqMetrics, metaList, recs, networthHistory }) {
  const sep  = '─'.repeat(40)
  const now  = format(new Date(), "d 'de' MMMM yyyy", { locale: es })

  const nwChange = (() => {
    const sorted = [...(networthHistory || [])].sort((a, b) => a.date.localeCompare(b.date))
    if (sorted.length < 2) return null
    const prev = sorted[sorted.length - 2]
    const curr = sorted[sorted.length - 1]
    return curr.netWorth - prev.netWorth
  })()

  const lines = [
    '╔══════════════════════════════════════╗',
    `║   REPORTE EJECUTIVO MENSUAL          ║`,
    `║   ${fmtMonth().toUpperCase().padEnd(36)}║`,
    '╚══════════════════════════════════════╝',
    '',
    '── RESUMEN FINANCIERO ──',
    `Patrimonio neto:       ${fmx(stats.netWorth)}`,
    nwChange !== null ? `Cambio mensual:        ${nwChange >= 0 ? '+' : ''}${fmx(nwChange)}` : '',
    `Ingresos del mes:      ${fmx(stats.monthIncome)}`,
    `Gastos del mes:        ${fmx(stats.monthExpenses)}`,
    `Flujo neto:            ${fmx(stats.monthFlow)}`,
    `Efectivo disponible:   ${fmx(stats.totalCash)}`,
    `Deuda tarjetas:        ${fmx(stats.totalCardDebt)}`,
    `Utilización crédito:   ${stats.creditUtil.toFixed(0)}%`,
    '',
    '── INVERSIONES ──',
    invMetrics
      ? [
          `Valor del portafolio:  ${fmx(invMetrics.totalVal)}`,
          `Capital invertido:     ${fmx(invMetrics.totalCost)}`,
          `P&L total:             ${invMetrics.totalGain >= 0 ? '+' : ''}${fmx(invMetrics.totalGain)} (${invMetrics.totalReturn >= 0 ? '+' : ''}${invMetrics.totalReturn.toFixed(1)}%)`,
          invMetrics.best  ? `Mejor posición:        ${invMetrics.best.ticker} (${invMetrics.best.pct >= 0 ? '+' : ''}${invMetrics.best.pct.toFixed(1)}%)` : '',
          invMetrics.worst && invMetrics.worst.id !== invMetrics.best?.id
            ? `Peor posición:         ${invMetrics.worst.ticker} (${invMetrics.worst.pct >= 0 ? '+' : ''}${invMetrics.worst.pct.toFixed(1)}%)` : '',
        ].filter(Boolean).join('\n')
      : 'Sin posiciones abiertas.',
    '',
    '── LOS PRIMOS BAJOQUINTOS ──',
    `Ventas totales:        ${fmx(stats.bqStats.totalSales)}`,
    `Utilidad estimada:     ${fmx(bqMetrics.totalUtility)}`,
    `Cobrado:               ${fmx(stats.bqStats.totalCollected)}`,
    `Pendiente por cobrar:  ${fmx(stats.bqStats.totalPending)}`,
    `Clientes activos:      ${bqMetrics.activeCount}`,
    `Seguimientos vencidos: ${bqMetrics.overdueFollowupsCount}`,
    '',
    '── METAS FINANCIERAS ──',
    ...metaList.slice(0, 5).map(m =>
      `${m.name.padEnd(22)} ${m.pct.toFixed(0).padStart(3)}%  ${m.isDone ? '✓ Completada' : `Faltan ${fmx(m.remaining)}`}`
    ),
    '',
    '── RECOMENDACIONES ──',
    ...recs.map((r, i) => `${i + 1}. [${r.priority.toUpperCase()}] ${r.title}\n   ${r.desc}`),
    '',
    sep,
    `Generado por Real Advisor · ${now}`,
  ].filter(s => s !== undefined)

  return lines.join('\n')
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ReporteEjecutivo({ setTab }) {
  const state = useFinanceStore()
  const {
    accounts, cards, transactions, investments, bajoquintos,
    metas, subscriptions, assets, liabilities, networthHistory = [],
    cashflowItems,
  } = state

  const [exporting, setExporting] = useState(false)

  // ── Core stats ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => computeStats(state), [
    accounts, cards, transactions, investments, bajoquintos,
    metas, subscriptions, assets, liabilities,
  ])

  // ── Meta insights ────────────────────────────────────────────────────────────
  const metaList = useMemo(() => computeMetaInsights(state), [
    metas, accounts, cards, investments, bajoquintos,
    subscriptions, cashflowItems, assets, liabilities, transactions,
  ])

  // ── Planner data ──────────────────────────────────────────────────────────────
  const plannerData = useMemo(() => computePlannerData(state), [
    cards, bajoquintos, accounts, investments, subscriptions,
    cashflowItems, metas, transactions, assets, liabilities,
  ])

  // ── Investment metrics ────────────────────────────────────────────────────────
  const invMetrics = useMemo(() => {
    if (!investments.length) return null
    let totalVal = 0, totalCost = 0
    const isOpt = (t) => t === 'call' || t === 'put'
    const positions = investments.map(inv => {
      const qty  = num(inv.quantity)
      const buy  = num(inv.buyPrice)
      const curr = num(inv.currentPrice || inv.buyPrice)
      const mult = isOpt(inv.type) ? 100 : 1   // ×100 multiplier for options contracts
      const cost = qty * buy  * mult
      const val  = qty * curr * mult
      const pct  = cost > 0 ? ((val - cost) / cost) * 100 : 0
      totalVal  += val
      totalCost += cost
      return { ...inv, cost, val, gain: val - cost, pct }
    })
    positions.sort((a, b) => b.pct - a.pct)
    const totalGain   = totalVal - totalCost
    const totalReturn = totalCost > 0 ? (totalGain / totalCost) * 100 : 0
    return {
      totalVal, totalCost, totalGain, totalReturn, count: positions.length,
      best:  positions[0],
      worst: positions[positions.length - 1],
    }
  }, [investments])

  // ── Bajoquinto metrics ────────────────────────────────────────────────────────
  const bqMetrics = useMemo(() => {
    const now    = new Date()
    const active = bajoquintos.filter(b => !CLOSED_STATUSES.includes(b.status))
    const totalUtility = bajoquintos.reduce((s, b) => {
      return s + (num(b.salePrice) - num(b.cost))
    }, 0)
    const overdueFollowupsCount = bajoquintos.filter(b => {
      if (!PROSPECT_STATUSES.includes(b.status)) return false
      if (b.nextFollowUp) {
        try { return new Date(b.nextFollowUp + 'T00:00:00') <= now } catch { return false }
      }
      const ref = b.lastContact ? new Date(b.lastContact + 'T00:00:00')
                : b.createdAt  ? new Date(b.createdAt) : null
      return ref ? Math.floor((now - ref) / 86_400_000) >= 3 : false
    }).length
    return { activeCount: active.length, totalUtility, overdueFollowupsCount }
  }, [bajoquintos])

  // ── Net worth MoM change ──────────────────────────────────────────────────────
  const nwChange = useMemo(() => {
    const sorted = [...networthHistory].sort((a, b) => a.date.localeCompare(b.date))
    if (sorted.length < 2) return null
    const prev = sorted[sorted.length - 2]
    const curr = sorted[sorted.length - 1]
    return { delta: curr.netWorth - prev.netWorth, fromLabel: prev.label || prev.date }
  }, [networthHistory])

  // ── Auto-recommendations ──────────────────────────────────────────────────────
  const recs = useMemo(() => buildRecs({
    stats, cards, investments, metaList, bajoquintos, subscriptions, networthHistory,
  }), [stats, cards, investments, metaList, bajoquintos, subscriptions, networthHistory])

  // ── Risk level ────────────────────────────────────────────────────────────────
  const criticalCount = recs.filter(r => r.priority === 'critico').length
  const risk          = calcRisk({ stats, criticalCount })

  // ── Market status ─────────────────────────────────────────────────────────────
  const marketStatus = getMarketStatus()
  const marketLabel  = {
    open:       'Mercado abierto 🟢',
    premarket:  'Pre-mercado 🟡',
    afterhours: 'After-hours 🟠',
    closed:     'Mercado cerrado ⚫',
  }[marketStatus] ?? 'Desconocido'

  // ── Export text / share ───────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true)
    const text = generateTextReport({ stats, invMetrics, bqMetrics, metaList, recs, networthHistory })
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Reporte Ejecutivo · ${fmtMonth()}`,
          text,
        })
        toast.success('📤 Reporte compartido')
      } else {
        await navigator.clipboard.writeText(text)
        toast.success('📋 Reporte copiado al portapapeles')
      }
    } catch {
      window.print()
    } finally {
      setExporting(false)
    }
  }

  // ── Export PDF ────────────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    const opened = openPrintReport({
      stats, cards, bajoquintos, metaList,
      invMetrics, bqMetrics, recs, risk,
      nwChange, plannerData,
    })
    if (!opened) {
      toast.error('El navegador bloqueó la ventana. Permite pop-ups para este sitio.')
    } else {
      toast.success('📄 Reporte abierto — Ctrl+P / ⌘P para guardar como PDF')
    }
  }

  // ── Best/most-behind meta ─────────────────────────────────────────────────────
  const incomplete    = metaList.filter(m => !m.isDone && m.target > 0)
  const mostBehind    = [...incomplete].sort((a, b) => a.pct - b.pct)[0]
  const mostAhead     = [...incomplete].filter(m => m.pct > 0).sort((a, b) => b.pct - a.pct)[0]
  const totalNeeded   = incomplete.reduce((s, m) => s + (m.monthlyNeeded > 0 ? m.monthlyNeeded : 0), 0)

  // ── Top planner priorities ────────────────────────────────────────────────────
  const topPriorities = plannerData.priorities
    .filter(p => p.priority === 'critico' || p.priority === 'importante')
    .slice(0, 5)

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="mb-nav">

      {/* ── Header ── */}
      <div className="px-5 pt-14 pt-safe pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1"
          style={{ color: 'var(--t3)' }}>ANÁLISIS</p>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--t1)' }}>
              Reporte Ejecutivo
            </h1>
            <p className="text-sm mt-0.5 capitalize" style={{ color: 'var(--t3)' }}>
              {fmtMonth()} · Riesgo{' '}
              <span className="font-bold" style={{ color: risk.color }}>{risk.label}</span>
            </p>
          </div>
          <button onClick={handleExportPDF}
            className="btn-press shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-[11px] font-bold"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            <FileText size={13} />
            PDF
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECCIÓN 1 · RESUMEN FINANCIERO
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="px-5">
        <SecCard>
          <SecHead emoji="💼" title="Resumen Financiero"
            badge={stats.netWorth >= 0 ? `+${fmxC(stats.netWorth)}` : fmxC(stats.netWorth)}
            badgeColor={stats.netWorth >= 0 ? '#059669' : '#EF4444'} />

          {/* Patrimonio hero */}
          <div className="rounded-2xl px-4 py-3 mb-3"
            style={{
              background: stats.netWorth >= 0
                ? 'linear-gradient(135deg,rgba(5,150,105,0.12),rgba(5,150,105,0.04))'
                : 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.04))',
              border: `1px solid ${stats.netWorth >= 0 ? 'rgba(5,150,105,0.20)' : 'rgba(239,68,68,0.20)'}`,
            }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
              style={{ color: 'var(--t3)' }}>Patrimonio neto</p>
            <p className="text-2xl font-black"
              style={{ color: stats.netWorth >= 0 ? '#059669' : '#EF4444' }}>
              {fmx(stats.netWorth)}
            </p>
            {nwChange && (
              <p className="text-xs font-semibold mt-0.5"
                style={{ color: nwChange.delta >= 0 ? '#059669' : '#EF4444' }}>
                {nwChange.delta >= 0 ? '▲' : '▼'} {fmxC(Math.abs(nwChange.delta))} vs {nwChange.fromLabel}
              </p>
            )}
          </div>

          <Row label="Ingresos del mes"     value={fmx(stats.monthIncome)}   color="#059669" />
          <Row label="Gastos del mes"       value={fmx(stats.monthExpenses)}  color="#E11D48" />
          <Row label="Flujo neto"           value={(stats.monthFlow >= 0 ? '+' : '') + fmx(stats.monthFlow)}
                                            color={stats.monthFlow >= 0 ? '#059669' : '#E11D48'} />
          <Row label="Efectivo disponible"  value={fmx(stats.totalCash)} />
          <Row label="Deuda total"          value={fmx(stats.totalCardDebt)}  color={stats.totalCardDebt > 0 ? '#E11D48' : '#059669'} />
          <Row label="Activos totales"      value={fmx(stats.totalAssets)} />
          <Row label="Utilización crédito"
               value={`${stats.creditUtil.toFixed(0)}%`}
               color={stats.creditUtil > 50 ? '#EF4444' : stats.creditUtil > 30 ? '#F97316' : '#059669'}
               sub={stats.creditUtil > 30 ? 'Objetivo: menos del 30%' : 'En rango saludable'}
               last />
        </SecCard>

        {/* ═══════════════════════════════════════════════════════════════════════
            SECCIÓN 2 · INVERSIONES
        ═══════════════════════════════════════════════════════════════════════ */}
        <SecCard>
          <SecHead emoji="📈" title="Inversiones"
            badge={invMetrics ? fmxC(invMetrics.totalVal) : 'Sin posiciones'}
            badgeColor="#2563EB" />

          {invMetrics ? (
            <>
              <Row label="Valor del portafolio" value={fmx(invMetrics.totalVal)} />
              <Row label="Capital invertido"    value={fmx(invMetrics.totalCost)} />
              <Row label="P&L total"
                   value={`${invMetrics.totalGain >= 0 ? '+' : ''}${fmx(invMetrics.totalGain)}`}
                   color={invMetrics.totalGain >= 0 ? '#059669' : '#E11D48'}
                   sub={`${invMetrics.totalReturn >= 0 ? '+' : ''}${invMetrics.totalReturn.toFixed(1)}% retorno total`} />
              {invMetrics.best && (
                <Row label="Mejor posición"
                     value={invMetrics.best.ticker}
                     color="#059669"
                     sub={`${invMetrics.best.pct >= 0 ? '+' : ''}${invMetrics.best.pct.toFixed(1)}%`} />
              )}
              {invMetrics.worst && invMetrics.worst.id !== invMetrics.best?.id && (
                <Row label="Peor posición"
                     value={invMetrics.worst.ticker}
                     color={invMetrics.worst.pct < 0 ? '#E11D48' : '#059669'}
                     sub={`${invMetrics.worst.pct >= 0 ? '+' : ''}${invMetrics.worst.pct.toFixed(1)}%`} />
              )}
              <Row label="Posiciones abiertas"  value={String(invMetrics.count)} />
              <Row label="Mercado"              value={marketLabel} last />
            </>
          ) : (
            <div className="py-4 text-center">
              <p className="text-2xl mb-1">📊</p>
              <p className="text-xs font-medium" style={{ color: 'var(--t3)' }}>
                Sin posiciones abiertas. Ve a Inversiones para agregar.
              </p>
              <button onClick={() => setTab('inversiones')}
                className="btn-press mt-2 px-4 py-1.5 rounded-xl text-xs font-bold"
                style={{ background: 'rgba(37,99,235,0.10)', color: '#2563EB' }}>
                Ir a Inversiones →
              </button>
            </div>
          )}
        </SecCard>

        {/* ═══════════════════════════════════════════════════════════════════════
            SECCIÓN 3 · LOS PRIMOS BAJOQUINTOS
        ═══════════════════════════════════════════════════════════════════════ */}
        <SecCard>
          <SecHead emoji="🎸" title="Los Primos Bajoquintos"
            badge={`${bajoquintos.length} pedidos`}
            badgeColor="#D97706" />

          <Row label="Ventas totales"           value={fmx(stats.bqStats.totalSales)} />
          <Row label="Utilidad estimada"         value={fmx(bqMetrics.totalUtility)}
                                                 color={bqMetrics.totalUtility >= 0 ? '#059669' : '#E11D48'} />
          <Row label="Cobrado"                   value={fmx(stats.bqStats.totalCollected)} color="#059669" />
          <Row label="Pendiente por cobrar"      value={fmx(stats.bqStats.totalPending)}
                                                 color={stats.bqStats.totalPending > 0 ? '#D97706' : 'var(--t1)'}
                                                 sub={stats.bqStats.pendingCount > 0 ? `${stats.bqStats.pendingCount} cliente${stats.bqStats.pendingCount !== 1 ? 's' : ''}` : undefined} />
          <Row label="Clientes activos"          value={String(bqMetrics.activeCount)} />
          <Row label="Seguimientos vencidos"     value={String(bqMetrics.overdueFollowupsCount)}
                                                 color={bqMetrics.overdueFollowupsCount > 0 ? '#E11D48' : '#059669'}
                                                 last />
        </SecCard>

        {/* ═══════════════════════════════════════════════════════════════════════
            SECCIÓN 4 · METAS
        ═══════════════════════════════════════════════════════════════════════ */}
        <SecCard>
          <SecHead emoji="🎯" title="Metas Financieras"
            badge={`${metaList.filter(m => m.isDone).length}/${metaList.length} completadas`}
            badgeColor="#7C3AED" />

          {/* Progress bars for each meta */}
          {metaList.slice(0, 5).map((m, i) => {
            const pct  = Math.min(100, m.pct)
            const clr  = m.isDone ? '#059669' : pct >= 60 ? '#6366F1' : pct >= 30 ? '#F59E0B' : '#EF4444'
            return (
              <div key={m.id} className="mb-3"
                style={{ borderBottom: i < Math.min(metaList.length, 5) - 1 ? '1px solid var(--border)' : 'none',
                  paddingBottom: i < Math.min(metaList.length, 5) - 1 ? 12 : 0 }}>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm leading-none">{m.emoji || '🎯'}</span>
                    <p className="text-[12px] font-bold" style={{ color: 'var(--t1)' }}>{m.name}</p>
                  </div>
                  <p className="text-[11px] font-black" style={{ color: clr }}>
                    {m.isDone ? '✓' : `${pct.toFixed(0)}%`}
                  </p>
                </div>
                <div className="rounded-full overflow-hidden mb-1"
                  style={{ height: 4, background: 'var(--s3)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: clr }} />
                </div>
                {!m.isDone && (
                  <p className="text-[9px]" style={{ color: 'var(--t3)' }}>
                    Faltan {m.unit === 'ventas' ? `${m.remaining} ventas` : fmx(m.remaining)}
                    {m.estimatedDate ? ` · ETA: ${m.estimatedDate instanceof Date ? m.estimatedDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : m.estimatedDate}` : ''}
                    {m.probability ? ` · ${m.probability}% prob.` : ''}
                  </p>
                )}
              </div>
            )
          })}

          {/* Summary rows */}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}>
            {mostBehind && (
              <Row label="Meta más atrasada"
                   value={mostBehind.name}
                   color="#EF4444"
                   sub={`${mostBehind.pct.toFixed(0)}% completada`} />
            )}
            {mostAhead && mostAhead.id !== mostBehind?.id && (
              <Row label="Meta más cercana"
                   value={mostAhead.name}
                   color="#059669"
                   sub={`${mostAhead.pct.toFixed(0)}% completada`} />
            )}
            {totalNeeded > 0 && (
              <Row label="Aportación mensual sugerida"
                   value={fmx(totalNeeded)}
                   color="#6366F1"
                   sub="Para todas las metas activas"
                   last />
            )}
          </div>
        </SecCard>

        {/* ═══════════════════════════════════════════════════════════════════════
            SECCIÓN 5 · PLANNER
        ═══════════════════════════════════════════════════════════════════════ */}
        <SecCard>
          <SecHead emoji="⚡" title="Planner — Acciones Clave"
            badge={`${plannerData.priorities.length} pendientes`}
            badgeColor={criticalCount > 0 ? '#EF4444' : '#6366F1'} />

          {/* Top priorities */}
          {topPriorities.length > 0 ? (
            <div className="space-y-2 mb-3">
              {topPriorities.map(p => {
                const st = REC_STYLE[p.priority] ?? REC_STYLE.normal
                return (
                  <div key={p.id} className="flex items-start gap-2.5 rounded-2xl px-3 py-2.5"
                    style={{ background: st.bg, border: `1px solid ${st.border}` }}>
                    <span className="text-base leading-none shrink-0 mt-0.5">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold leading-tight" style={{ color: 'var(--t1)' }}>
                        {p.title}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--t3)' }}>{p.desc}</p>
                    </div>
                    {p.amount > 0 && (
                      <p className="text-[11px] font-black shrink-0" style={{ color: st.dot }}>
                        {fmx(p.amount)}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-center py-3" style={{ color: 'var(--t3)' }}>
              ✅ Sin acciones urgentes esta semana
            </p>
          )}

          {/* Week payments */}
          {plannerData.weekPayments.length > 0 && (
            <Row label="Pagos próximos (7d)"
                 value={`${plannerData.weekPayments.length} tarjeta${plannerData.weekPayments.length !== 1 ? 's' : ''}`}
                 color="#E11D48"
                 sub={`Total: ${fmx(plannerData.weekPayments.reduce((s, c) => s + num(c.balance), 0))}`} />
          )}
          {/* Week collections */}
          {plannerData.weekCollections.length > 0 && (
            <Row label="Cobros pendientes"
                 value={`${plannerData.weekCollections.length} cliente${plannerData.weekCollections.length !== 1 ? 's' : ''}`}
                 color="#D97706"
                 sub={`Total: ${fmx(plannerData.weekCollections.reduce((s, b) => s + num(b.pending), 0))}`} />
          )}
          {/* Risk */}
          <Row label="Nivel de riesgo financiero"
               value={risk.label}
               color={risk.color}
               sub={criticalCount > 0 ? `${criticalCount} situación${criticalCount !== 1 ? 'es' : ''} crítica${criticalCount !== 1 ? 's' : ''}` : 'Sin situaciones críticas'}
               last />
        </SecCard>

        {/* ═══════════════════════════════════════════════════════════════════════
            SECCIÓN 6 · RECOMENDACIONES AUTOMÁTICAS
        ═══════════════════════════════════════════════════════════════════════ */}
        <SecCard>
          <SecHead emoji="🧠" title="Recomendaciones Automáticas"
            badge={`${recs.length} acción${recs.length !== 1 ? 'es' : ''}`}
            badgeColor="#7C3AED" />

          {recs.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-sm font-bold" style={{ color: 'var(--t1)' }}>¡Finanzas en orden!</p>
              <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
                No hay acciones urgentes este mes. Sigue así.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recs.map((rec, i) => {
                const st = REC_STYLE[rec.priority] ?? REC_STYLE.normal
                return (
                  <div key={i} className="rounded-2xl px-3.5 py-3"
                    style={{ background: st.bg, border: `1px solid ${st.border}` }}>
                    <div className="flex items-start gap-2.5">
                      <span className="text-lg leading-none shrink-0 mt-0.5">{rec.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className="text-[12px] font-black" style={{ color: 'var(--t1)' }}>
                            {rec.title}
                          </p>
                          <Pill label={st.lbl} color={st.dot} />
                        </div>
                        <p className="text-[11px] leading-snug" style={{ color: 'var(--t3)' }}>
                          {rec.desc}
                        </p>
                      </div>
                      {rec.action && (
                        <button onClick={() => setTab(rec.action)}
                          className="btn-press shrink-0 px-2.5 py-1 rounded-xl text-[10px] font-bold"
                          style={{ background: `${st.dot}15`, color: st.dot, whiteSpace: 'nowrap' }}>
                          Ver →
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SecCard>

        {/* ── Footer / export ── */}
        <div className="rounded-3xl p-4 mb-6"
          style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-bold" style={{ color: 'var(--t1)' }}>
                Exportar reporte completo
              </p>
              <p className="text-[10px]" style={{ color: 'var(--t3)' }}>
                PDF profesional con todas las secciones
              </p>
            </div>
            <FileText size={18} color="var(--t3)" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleExport} disabled={exporting}
              className="btn-press py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5"
              style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--border)' }}>
              <Share2 size={12} />
              {exporting ? 'Exportando…' : 'Compartir texto'}
            </button>
            <button onClick={handleExportPDF}
              className="btn-press py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              <FileText size={12} />
              Exportar PDF
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

import { useMemo, useEffect, useRef, useState } from 'react'
import { TrendingUp, TrendingDown, Plus, Trash2, BookmarkCheck } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import useFinanceStore from '../store/useFinanceStore.js'
import { computeStats } from '../store/selectors.js'
import { fmx } from '../lib/formatters.js'
import toast from 'react-hot-toast'

const num = (n) => Number(n) || 0

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtMonth = (dateStr) => {
  try {
    const [y, m] = dateStr.split('-')
    return format(new Date(+y, +m - 1, 1), 'MMM yy', { locale: es })
  } catch { return dateStr }
}

const sign = (n) => n >= 0 ? '+' : ''

// ── SVG Area Chart ────────────────────────────────────────────────────────────
function NWChart({ history }) {
  if (!history?.length) return (
    <div className="flex items-center justify-center" style={{ height: 140 }}>
      <p className="text-xs" style={{ color: 'var(--t3)' }}>Sin datos para graficar</p>
    </div>
  )
  if (history.length === 1) return (
    <div className="flex items-center justify-center" style={{ height: 140 }}>
      <p className="text-xs" style={{ color: 'var(--t3)' }}>Agrega al menos 2 cortes para ver la gráfica</p>
    </div>
  )

  const values = history.map(h => h.netWorth)
  const min    = Math.min(...values)
  const max    = Math.max(...values)
  const range  = max - min || Math.abs(max) || 1

  const W   = 340
  const H   = 110
  const PAD = { t: 12, r: 8, b: 28, l: 8 }
  const CW  = W - PAD.l - PAD.r
  const CH  = H - PAD.t - PAD.b

  const px = (i) => PAD.l + (i / (history.length - 1)) * CW
  const py = (v) => PAD.t + CH - ((v - min) / range) * CH

  const pts     = history.map((h, i) => ({ x: px(i), y: py(h.netWorth), val: h.netWorth }))
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${H - PAD.b} L ${pts[0].x.toFixed(1)} ${H - PAD.b} Z`

  const isUp = values[values.length - 1] >= values[0]
  const col  = isUp ? '#22C55E' : '#EF4444'

  // Zero line (if range spans negative)
  const hasNeg = min < 0 && max > 0
  const zeroY  = hasNeg ? py(0) : null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 140 }}
      preserveAspectRatio="none">
      <defs>
        <linearGradient id="nwAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={col} stopOpacity="0.30" />
          <stop offset="100%" stopColor={col} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Zero line */}
      {hasNeg && zeroY !== null && (
        <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY}
          stroke="rgba(255,255,255,0.20)" strokeWidth="1" strokeDasharray="3,3" />
      )}

      {/* Area fill */}
      <path d={areaPath} fill="url(#nwAreaGrad)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke={col} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Data points */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3"
          fill={col} stroke="var(--s2)" strokeWidth="1.5" />
      ))}

      {/* Month labels */}
      {history.map((h, i) => {
        const show = history.length <= 6 || i % Math.ceil(history.length / 6) === 0 || i === history.length - 1
        if (!show) return null
        return (
          <text key={`lbl-${i}`}
            x={px(i).toFixed(1)} y={H - 4}
            textAnchor="middle" fontSize="8"
            fill="rgba(255,255,255,0.35)" fontFamily="system-ui,sans-serif">
            {fmtMonth(h.date)}
          </text>
        )
      })}
    </svg>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, emoji }) {
  return (
    <div className="rounded-2xl px-3.5 py-3"
      style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>
      <p className="text-[9px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--t3)' }}>
        {emoji && <span className="mr-0.5">{emoji}</span>}{label}
      </p>
      <p className="text-base font-black leading-tight" style={{ color: color || 'var(--t1)' }}>
        {value}
      </p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--t3)' }}>{sub}</p>}
    </div>
  )
}

// ── History row ───────────────────────────────────────────────────────────────
function HistoryRow({ snap, prev, onDelete }) {
  const change    = prev !== undefined ? snap.netWorth - prev.netWorth : null
  const changePct = prev !== undefined && prev.netWorth !== 0
    ? ((snap.netWorth - prev.netWorth) / Math.abs(prev.netWorth)) * 100
    : null
  const isUp = change === null ? true : change >= 0

  return (
    <div className="flex items-center gap-3 py-3"
      style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Month label */}
      <div className="w-12 shrink-0 text-center">
        <p className="text-[11px] font-bold" style={{ color: 'var(--t2)' }}>
          {fmtMonth(snap.date)}
        </p>
        {snap.isAuto && (
          <p className="text-[8px]" style={{ color: 'var(--t3)' }}>auto</p>
        )}
      </div>

      {/* Net worth */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black" style={{ color: 'var(--t1)' }}>
          {fmx(snap.netWorth)}
        </p>
        {snap.note && (
          <p className="text-[10px] truncate" style={{ color: 'var(--t3)' }}>
            {snap.note}
          </p>
        )}
        <p className="text-[9px]" style={{ color: 'var(--t3)' }}>
          Activos {fmx(snap.totalAssets)} · Pasivos {fmx(snap.totalLiabilities)}
        </p>
      </div>

      {/* Change */}
      {change !== null && (
        <div className={`text-right shrink-0 ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>
          <p className="text-[11px] font-black">
            {sign(change)}{fmx(change)}
          </p>
          {changePct !== null && (
            <p className="text-[10px] font-semibold">
              {sign(changePct)}{changePct.toFixed(1)}%
            </p>
          )}
        </div>
      )}

      {/* Delete */}
      <button onClick={() => onDelete(snap)}
        className="btn-press w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'rgba(225,29,72,0.06)' }}>
        <Trash2 size={11} color="#E11D48" />
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function EvolucionPatrimonial() {
  const state = useFinanceStore()
  const { networthHistory = [], addNetworthSnapshot, deleteNetworthSnapshot } = state
  const [noteInput, setNoteInput] = useState('')
  const autoSnapDone = useRef(false)

  // Compute current stats
  const stats = useMemo(() => computeStats(state), [
    state.accounts, state.cards, state.investments,
    state.assets, state.liabilities, state.transactions,
  ])

  // ── Auto-snapshot on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (autoSnapDone.current) return
    autoSnapDone.current = true
    const now      = new Date()
    const monthKey = format(now, 'yyyy-MM')
    const exists   = networthHistory.some(h => h.date === monthKey)
    if (!exists) {
      addNetworthSnapshot({
        id:               `snap_${monthKey}_auto`,
        date:             monthKey,
        label:            format(now, "MMMM yyyy", { locale: es }),
        timestamp:        Date.now(),
        netWorth:         stats.netWorth,
        totalAssets:      stats.totalAssets,
        totalLiabilities: stats.totalLiabilities,
        totalCash:        stats.totalCash,
        investmentValue:  stats.investmentValue,
        totalCardDebt:    stats.totalCardDebt,
        isAuto:           true,
        note:             null,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Manual snapshot ───────────────────────────────────────────────────────
  const handleManualSnap = () => {
    const now      = new Date()
    const monthKey = format(now, 'yyyy-MM')
    addNetworthSnapshot({
      id:               `snap_${monthKey}_${Date.now()}`,
      date:             monthKey,
      label:            format(now, "MMMM yyyy", { locale: es }),
      timestamp:        Date.now(),
      netWorth:         stats.netWorth,
      totalAssets:      stats.totalAssets,
      totalLiabilities: stats.totalLiabilities,
      totalCash:        stats.totalCash,
      investmentValue:  stats.investmentValue,
      totalCardDebt:    stats.totalCardDebt,
      isAuto:           false,
      note:             noteInput.trim() || null,
    })
    setNoteInput('')
    toast.success('📊 Corte mensual guardado')
  }

  // ── Delete snapshot ───────────────────────────────────────────────────────
  const handleDelete = (snap) => {
    deleteNetworthSnapshot(snap.id)
    toast.success('Corte eliminado')
  }

  // ── History sorted + limited to last 12 ──────────────────────────────────
  const sorted  = useMemo(() =>
    [...networthHistory].sort((a, b) => a.date.localeCompare(b.date)).slice(-12),
    [networthHistory]
  )

  // ── Stats ─────────────────────────────────────────────────────────────────
  const histStats = useMemo(() => {
    if (sorted.length < 2) return null
    const first = sorted[0]
    const last  = sorted[sorted.length - 1]

    const totalGrowth = last.netWorth - first.netWorth
    const totalPct    = first.netWorth !== 0
      ? (totalGrowth / Math.abs(first.netWorth)) * 100
      : totalGrowth > 0 ? 100 : 0
    const monthsCount = sorted.length - 1
    const monthlyAvg  = monthsCount > 0 ? totalGrowth / monthsCount : 0

    let bestMonth  = null
    let worstMonth = null
    for (let i = 1; i < sorted.length; i++) {
      const change = sorted[i].netWorth - sorted[i - 1].netWorth
      const label  = fmtMonth(sorted[i].date)
      if (!bestMonth  || change > bestMonth.change)  bestMonth  = { label, change }
      if (!worstMonth || change < worstMonth.change) worstMonth = { label, change }
    }

    return { first, last, totalGrowth, totalPct, monthlyAvg, bestMonth, worstMonth, monthsCount }
  }, [sorted])

  const isPositive = histStats ? histStats.totalGrowth >= 0 : stats.netWorth >= 0
  const heroGrad   = isPositive
    ? 'linear-gradient(135deg,#064e3b 0%,#065f46 50%,#047857 100%)'
    : 'linear-gradient(135deg,#450a0a 0%,#7f1d1d 55%,#991b1b 100%)'

  return (
    <div className="mb-nav">

      {/* ── Header ── */}
      <div className="px-5 pt-14 pt-safe pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1"
          style={{ color: 'var(--t3)' }}>RIQUEZA PERSONAL</p>
        <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--t1)' }}>
          Evolución Patrimonial
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--t3)' }}>
          {sorted.length} corte{sorted.length !== 1 ? 's' : ''} registrado{sorted.length !== 1 ? 's' : ''}
          {histStats ? ` · ${histStats.monthsCount} mes${histStats.monthsCount !== 1 ? 'es' : ''} de historial` : ''}
        </p>
      </div>

      {/* ── Hero chart card ── */}
      <div className="px-5 mb-5">
        <div className="relative rounded-3xl overflow-hidden" style={{ background: heroGrad }}>
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle,rgba(255,255,255,0.08),transparent)' }} />
          <div className="relative px-4 pt-4 pb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1"
              style={{ color: 'rgba(255,255,255,0.50)' }}>Patrimonio neto actual</p>
            <p className={`text-3xl font-black text-white leading-none mb-1`}>
              {fmx(stats.netWorth)}
            </p>
            {histStats && (
              <p className="text-sm font-semibold mb-3"
                style={{ color: isPositive ? '#86EFAC' : '#FCA5A5' }}>
                {sign(histStats.totalGrowth)}{fmx(histStats.totalGrowth)}
                {' '}({sign(histStats.totalPct)}{histStats.totalPct.toFixed(1)}%)
                {' '}desde {fmtMonth(histStats.first.date)}
              </p>
            )}

            {/* Chart */}
            <div style={{ marginLeft: -4, marginRight: -4 }}>
              <NWChart history={sorted} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats grid ── */}
      {histStats && (
        <div className="px-5 mb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
            style={{ color: 'var(--t3)' }}>Análisis histórico</p>
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label="Patrimonio inicial"
              value={fmx(histStats.first.netWorth)}
              sub={fmtMonth(histStats.first.date)}
              emoji="📍"
            />
            <StatCard
              label="Crecimiento total $"
              value={`${sign(histStats.totalGrowth)}${fmx(histStats.totalGrowth)}`}
              sub={`${sign(histStats.totalPct)}${histStats.totalPct.toFixed(1)}%`}
              color={histStats.totalGrowth >= 0 ? '#22C55E' : '#EF4444'}
              emoji={histStats.totalGrowth >= 0 ? '📈' : '📉'}
            />
            <StatCard
              label="Promedio mensual"
              value={`${sign(histStats.monthlyAvg)}${fmx(histStats.monthlyAvg)}`}
              sub={`${histStats.monthsCount} mes${histStats.monthsCount !== 1 ? 'es' : ''} medidos`}
              color={histStats.monthlyAvg >= 0 ? '#22C55E' : '#EF4444'}
              emoji="📊"
            />
            <StatCard
              label="Activos totales"
              value={fmx(stats.totalAssets)}
              sub={`Pasivos: ${fmx(stats.totalLiabilities)}`}
              emoji="🏦"
            />
            {histStats.bestMonth && (
              <StatCard
                label="Mejor mes"
                value={`+${fmx(histStats.bestMonth.change)}`}
                sub={histStats.bestMonth.label}
                color="#22C55E"
                emoji="🏆"
              />
            )}
            {histStats.worstMonth && (
              <StatCard
                label="Peor mes"
                value={`${sign(histStats.worstMonth.change)}${fmx(histStats.worstMonth.change)}`}
                sub={histStats.worstMonth.label}
                color={histStats.worstMonth.change < 0 ? '#EF4444' : '#F59E0B'}
                emoji="⚠️"
              />
            )}
          </div>
        </div>
      )}

      {/* ── Guardar corte ── */}
      <div className="px-5 mb-5">
        <div className="rounded-3xl p-4"
          style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-bold mb-3" style={{ color: 'var(--t2)' }}>
            💾 Guardar corte mensual
          </p>
          <p className="text-[11px] mb-3" style={{ color: 'var(--t3)' }}>
            Captura el patrimonio actual: <strong style={{ color: 'var(--t1)' }}>{fmx(stats.netWorth)}</strong>
          </p>
          <input
            type="text"
            placeholder="Nota opcional (ej: Recibí bono, compré inversión…)"
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            className="mb-3"
            style={{ fontSize: 13 }}
          />
          <button onClick={handleManualSnap}
            className="btn-press w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
            <BookmarkCheck size={15} /> Guardar corte — {fmx(stats.netWorth)}
          </button>
        </div>
      </div>

      {/* ── Historia ── */}
      {sorted.length > 0 && (
        <div className="px-5 mb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1"
            style={{ color: 'var(--t3)' }}>
            Historial · últimos {sorted.length} cortes
          </p>
          <div className="rounded-3xl overflow-hidden"
            style={{ background: 'var(--s1)', border: '1px solid var(--border)', padding: '0 16px' }}>
            {[...sorted].reverse().map((snap, i, arr) => {
              const prevInOriginal = sorted[sorted.length - 1 - i - 1]
              return (
                <HistoryRow
                  key={snap.id}
                  snap={snap}
                  prev={prevInOriginal}
                  onDelete={handleDelete}
                />
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}

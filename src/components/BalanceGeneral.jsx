import { useMemo } from 'react'
import useFinanceStore from '../store/useFinanceStore.js'
import { computeStats, computeMonthlyFlow } from '../store/selectors.js'
import { fmx, fmxC } from '../lib/formatters.js'

// ── Mini sparkline ────────────────────────────────────────────────────────────
function Sparkline({ points, W = 260, H = 44 }) {
  if (!points?.length || points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const rng = max - min || 1
  const pad = H * 0.12
  const xs  = points.map((_, i) => (i / (points.length - 1)) * W)
  const ys  = points.map(v => H - pad - ((v - min) / rng) * (H - pad * 2))
  const line = xs.map((x, i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ')
  const area = `${line} L ${W} ${H} L 0 ${H} Z`
  const up   = points[points.length - 1] >= points[0]
  const c    = up ? '#4ADE80' : '#F87171'
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{ display: 'block' }}>
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={c} stopOpacity="0.30" />
          <stop offset="100%" stopColor={c} stopOpacity="0"    />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#bgGrad)" />
      <path d={line} fill="none" stroke={c} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Proportional bar segment ──────────────────────────────────────────────────
function SegBar({ segments }) {
  // segments: [{pct, color, label, value}]
  const total = segments.reduce((s, sg) => s + sg.pct, 0)
  if (total === 0) return null
  return (
    <div className="rounded-full overflow-hidden flex" style={{ height: 8, background: 'var(--s3)' }}>
      {segments.map((sg, i) => (
        <div key={i} className={`h-full ${sg.color} transition-all duration-500`}
          style={{ width: `${Math.min(100, (sg.pct / total) * 100)}%` }} />
      ))}
    </div>
  )
}

// ── Balance row ───────────────────────────────────────────────────────────────
const Row = ({ label, value, color, indent = false, bold = false, separator = false }) => (
  <>
    {separator && <div className="my-2" style={{ height: 1, background: 'var(--border)' }} />}
    <div className={`flex justify-between items-center py-1.5 ${indent ? 'pl-3' : ''}`}>
      <p className={`text-sm ${bold ? 'font-bold' : 'font-medium'}`}
        style={{ color: bold ? 'var(--t1)' : 'var(--t2)' }}>
        {label}
      </p>
      <p className={`text-sm font-bold ${color ?? ''}`}
        style={!color ? { color: 'var(--t1)' } : undefined}>
        {value}
      </p>
    </div>
  </>
)

// ── Month flow bar chart ──────────────────────────────────────────────────────
function FlowBars({ data }) {
  const H   = 46
  const max = Math.max(...data.map(d => Math.max(d.income, d.expense, 1)))
  const bW  = 8
  const gap = 2
  const grW = bW * 2 + gap + 10
  const W   = grW * data.length

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 16}`} preserveAspectRatio="none"
      style={{ display: 'block' }}>
      {data.map((d, i) => {
        const x   = i * grW
        const iH  = Math.max(2, (d.income  / max) * H)
        const eH  = Math.max(2, (d.expense / max) * H)
        const last = i === data.length - 1
        return (
          <g key={i}>
            <rect x={x}       y={H - iH} width={bW} height={iH} rx={2} fill="#059669" opacity={last ? 1 : 0.5} />
            <rect x={x+bW+gap} y={H - eH} width={bW} height={eH} rx={2} fill="#E11D48" opacity={last ? 0.85 : 0.4} />
            <text x={x + bW + gap / 2 + 0.5} y={H + 12} textAnchor="middle"
              fontSize={7} fill="#8B91B0" fontFamily="system-ui,sans-serif">
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function BalanceGeneral({ setTab }) {
  const state = useFinanceStore()
  const stats = useMemo(() => computeStats(state), [state])
  const { accounts, investments, assets, cards, liabilities, transactions } = state

  const flowData = useMemo(() => computeMonthlyFlow(transactions), [transactions])

  // ── 6-month NW history approximated from cumulative flow
  const nwHistory = useMemo(() =>
    flowData.map((_, i) => {
      const futureFlow = flowData.slice(i + 1).reduce((s, m) => s + m.net, 0)
      return stats.netWorth - futureFlow
    }), [flowData, stats.netWorth])

  const totalCash    = accounts.reduce((s, a) => s + Number(a.balance || 0), 0)
  const invValue     = stats.investmentValue
  const manualAssets = stats.manualAssets
  const totalAssets  = stats.totalAssets
  const cardDebt     = stats.totalCardDebt
  const manualLibs   = stats.manualLiabilities
  const totalLibs    = stats.totalLiabilities
  const netWorth     = stats.netWorth
  const nwPositive   = netWorth >= 0
  const debtRatio    = totalAssets > 0 ? (totalLibs / totalAssets) * 100 : 0

  // Asset composition segments
  const assetSegs = [
    { pct: totalCash,    color: 'bg-sky-500',     label: 'Cuentas',      value: totalCash    },
    { pct: invValue,     color: 'bg-violet-500',  label: 'Inversiones',  value: invValue     },
    { pct: manualAssets, color: 'bg-emerald-500', label: 'Otros activos', value: manualAssets },
  ].filter(s => s.pct > 0)

  const liabSegs = [
    { pct: cardDebt,   color: 'bg-rose-500', label: 'Tarjetas', value: cardDebt   },
    { pct: manualLibs, color: 'bg-red-700',  label: 'Deudas',   value: manualLibs },
  ].filter(s => s.pct > 0)

  // Month-over-month deltas
  const prevFlow = stats.prevMonthFlow ?? 0
  const currFlow = stats.monthFlow
  const flowDelta = prevFlow !== 0 ? ((currFlow - prevFlow) / Math.abs(prevFlow)) * 100 : null

  return (
    <div className="mb-nav">
      <div className="px-5 pt-14 pt-safe mb-4">
        <h1 className="text-2xl font-black mb-5" style={{ color: 'var(--t1)' }}>Balance General</h1>

        {/* ── Patrimonio hero ──────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl p-5 mb-4"
          style={{ background: nwPositive
            ? 'linear-gradient(135deg, #052e16, #0a3d22)'
            : 'linear-gradient(135deg, #2d0a14, #3d0a1a)' }}>
          <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full opacity-20"
            style={{ background: `radial-gradient(circle, ${nwPositive ? '#22C55E' : '#F43F5E'}, transparent)` }} />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1"
              style={{ color: nwPositive ? 'rgba(74,222,128,0.7)' : 'rgba(248,113,113,0.7)' }}>
              Patrimonio neto
            </p>
            <p className={`text-4xl font-black tracking-tight ${nwPositive ? 'text-emerald-300' : 'text-red-300'}`}>
              {fmx(netWorth)}
            </p>
            <p className="text-xs mt-1.5 mb-4"
              style={{ color: nwPositive ? 'rgba(74,222,128,0.55)' : 'rgba(248,113,113,0.55)' }}>
              Ratio deuda/activos: {debtRatio.toFixed(1)}%
            </p>

            {/* 6-month sparkline */}
            <div style={{ height: 44, marginBottom: 4 }}>
              <Sparkline points={nwHistory} W={260} H={44} />
            </div>
            <div className="flex justify-between text-[9px]" style={{ color: 'rgba(255,255,255,0.30)' }}>
              {flowData.map((m, i) => <span key={i}>{m.label}</span>)}
            </div>
          </div>
        </div>

        {/* ── Flujo vs mes anterior ────────────────────────────── */}
        <div className="card mb-4">
          <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--t3)' }}>
            Flujo del mes
          </p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { label: 'Ingresos',  val: stats.monthIncome,   prev: stats.prevMonthIncome,   color: 'text-emerald-600', inv: false },
              { label: 'Gastos',    val: stats.monthExpenses,  prev: stats.prevMonthExpenses,  color: 'text-rose-600',    inv: true  },
              { label: 'Flujo net', val: stats.monthFlow,      prev: stats.prevMonthFlow,      color: stats.monthFlow >= 0 ? 'text-emerald-600' : 'text-rose-600', inv: false },
            ].map(({ label, val, prev, color, inv }) => {
              const delta = prev && prev !== 0 ? ((val - prev) / Math.abs(prev)) * 100 : null
              const up    = delta !== null ? (inv ? delta <= 0 : delta >= 0) : null
              return (
                <div key={label}>
                  <p className="text-[10px] font-semibold mb-0.5" style={{ color: 'var(--t3)' }}>{label}</p>
                  <p className={`text-sm font-black ${color}`}>{fmxC(val)}</p>
                  {delta !== null && Math.abs(delta) >= 1 && (
                    <p className={`text-[9px] font-bold mt-0.5 ${up ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {up ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          {/* Monthly bar chart */}
          <div style={{ height: 62 }}>
            <FlowBars data={flowData} />
          </div>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm bg-emerald-500" />
              <span className="text-[10px]" style={{ color: 'var(--t3)' }}>Ingresos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm bg-rose-500" />
              <span className="text-[10px]" style={{ color: 'var(--t3)' }}>Gastos</span>
            </div>
          </div>
        </div>

        {/* ── Asset composition visual ─────────────────────────── */}
        {assetSegs.length > 0 && (
          <div className="card mb-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--t3)' }}>
                Composición de activos
              </p>
              <p className="text-sm font-black text-emerald-600">{fmxC(totalAssets)}</p>
            </div>
            <SegBar segments={assetSegs} />
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
              {assetSegs.map((sg, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${sg.color}`} />
                  <span className="text-xs font-medium" style={{ color: 'var(--t2)' }}>
                    {sg.label}
                  </span>
                  <span className="text-xs font-bold" style={{ color: 'var(--t1)' }}>
                    {fmxC(sg.value)}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--t3)' }}>
                    ({totalAssets > 0 ? ((sg.value / totalAssets) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Pasivos composition ──────────────────────────────── */}
        {liabSegs.length > 0 && (
          <div className="card mb-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--t3)' }}>
                Composición de pasivos
              </p>
              <p className="text-sm font-black text-rose-600">{fmxC(totalLibs)}</p>
            </div>
            <SegBar segments={liabSegs} />
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
              {liabSegs.map((sg, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${sg.color}`} />
                  <span className="text-xs font-medium" style={{ color: 'var(--t2)' }}>
                    {sg.label}
                  </span>
                  <span className="text-xs font-bold" style={{ color: 'var(--t1)' }}>
                    {fmxC(sg.value)}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--t3)' }}>
                    ({totalLibs > 0 ? ((sg.value / totalLibs) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Assets detail ────────────────────────────────────── */}
        <div className="card mb-3">
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--t3)' }}>
            ACTIVOS
          </p>
          {accounts.length > 0 && (
            <>
              <Row label="Efectivo y cuentas" value={fmx(totalCash)} bold />
              {accounts.map(a => (
                <Row key={a.id} label={`  ${a.name}`} value={fmx(a.balance)} indent color="text-emerald-600" />
              ))}
            </>
          )}
          {investments.length > 0 && (
            <>
              <Row label="Inversiones" value={fmx(invValue)} bold separator={accounts.length > 0} />
              {investments.map(i => {
                const val = Number(i.currentPrice || i.buyPrice || 0) * Number(i.quantity || 1)
                return <Row key={i.id} label={`  ${i.ticker || i.asset}`} value={fmx(val)} indent color="text-indigo-600" />
              })}
            </>
          )}
          {assets.filter(a => a.isActive !== false).length > 0 && (
            <>
              <Row label="Activos físicos" value={fmx(manualAssets)} bold separator />
              {assets.filter(a => a.isActive !== false).map(a => (
                <Row key={a.id} label={`  ${a.name}`} value={fmx(a.value)} indent color="text-blue-600" />
              ))}
            </>
          )}
          {(accounts.length === 0 && investments.length === 0 && assets.length === 0) && (
            <p className="text-sm py-2" style={{ color: 'var(--t3)' }}>Sin activos registrados</p>
          )}
          <Row label="TOTAL ACTIVOS" value={fmx(totalAssets)} color="text-emerald-600" bold separator />
        </div>

        {/* ── Liabilities detail ───────────────────────────────── */}
        <div className="card mb-3">
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--t3)' }}>
            PASIVOS
          </p>
          {cards.length > 0 && (
            <>
              <Row label="Tarjetas de crédito" value={fmx(cardDebt)} bold />
              {cards.map(c => (
                <Row key={c.id} label={`  ${c.bankName}`} value={fmx(c.balance)} indent color="text-rose-600" />
              ))}
            </>
          )}
          {liabilities.filter(l => l.isActive !== false).length > 0 && (
            <>
              <Row label="Deudas manuales" value={fmx(manualLibs)} bold separator={cards.length > 0} />
              {liabilities.filter(l => l.isActive !== false).map(l => (
                <Row key={l.id} label={`  ${l.name}`} value={fmx(l.amount)} indent color="text-rose-600" />
              ))}
            </>
          )}
          {(cards.length === 0 && liabilities.length === 0) && (
            <p className="text-sm py-2" style={{ color: 'var(--t3)' }}>Sin pasivos registrados</p>
          )}
          <Row label="TOTAL PASIVOS" value={fmx(totalLibs)} color="text-rose-600" bold separator />
        </div>

        {/* ── Net worth summary ────────────────────────────────── */}
        <div className="card mb-5"
          style={{ border: `1px solid ${nwPositive ? 'rgba(5,150,105,0.2)' : 'rgba(225,29,72,0.2)'}` }}>
          <div className="flex justify-between items-center">
            <p className="text-base font-black" style={{ color: 'var(--t1)' }}>PATRIMONIO NETO</p>
            <p className={`text-xl font-black ${nwPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {fmx(netWorth)}
            </p>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
            {fmx(totalAssets)} activos − {fmx(totalLibs)} pasivos
          </p>
        </div>

        {/* ── Quick actions ────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: '+ Activo',    action: () => setTab('activos')     },
            { label: '+ Pasivo',    action: () => setTab('activos')     },
            { label: '+ Inversión', action: () => setTab('inversiones') },
            { label: '+ Cuenta',   action: () => setTab('cuentas')     },
          ].map(b => (
            <button key={b.label} onClick={b.action}
              className="btn-press py-3 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(79,70,229,0.06)', color: 'var(--accent)', border: '1px solid rgba(79,70,229,0.12)' }}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

import { useMemo } from 'react'
import { BrainCircuit } from 'lucide-react'
import useFinanceStore from '../store/useFinanceStore.js'
import { computeAdvisorScore } from '../store/selectors.js'

// ── Score Arc (270° gauge) ────────────────────────────────────────────────────
function ScoreArc({ score, size = 110 }) {
  const sw  = 9
  const r   = (size - sw * 2) / 2
  const cx  = size / 2
  const cy  = size / 2
  const C   = 2 * Math.PI * r
  const pct  = Math.max(0, Math.min(100, score)) / 100
  const arcLen = C * 0.75           // 270° arc
  const filled = pct * arcLen
  const offset = C * 0.625         // start at bottom-left (225°)

  const color =
    score >= 85 ? '#22C55E' :
    score >= 70 ? '#4ADE80' :
    score >= 50 ? '#F59E0B' :
    score >= 30 ? '#F97316' : '#EF4444'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="rgba(255,255,255,0.12)" strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${arcLen} ${C - arcLen}`}
        strokeDashoffset={offset}
      />
      {/* Progress */}
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${C - filled}`}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dasharray 0.7s ease' }}
      />
      {/* Score */}
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize={26} fontWeight="900"
        fill="white" fontFamily="system-ui,sans-serif">
        {score}
      </text>
      <text x={cx} y={cy + 20} textAnchor="middle" fontSize={8}
        fill="rgba(255,255,255,0.45)" fontFamily="system-ui,sans-serif">
        /100
      </text>
    </svg>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_COLOR = {
  green:  '#22C55E',
  yellow: '#F59E0B',
  orange: '#F97316',
  red:    '#EF4444',
}

const PCFG = {
  critico:    { dot: '#EF4444', text: '#EF4444', bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.22)'  },
  importante: { dot: '#F97316', text: '#F97316', bg: 'rgba(249,115,22,0.05)', border: 'rgba(249,115,22,0.22)' },
  normal:     { dot: '#6366F1', text: 'var(--t3)', bg: 'var(--s1)',           border: 'var(--border)'          },
}

// ── Dimension card (2-col grid) ───────────────────────────────────────────────
function DimCard({ dim }) {
  const barColor = STATUS_COLOR[dim.status] ?? '#6366F1'
  const pct      = (dim.score / dim.max) * 100
  return (
    <div className="rounded-2xl p-3.5"
      style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl leading-none">{dim.icon}</span>
        <span className="text-sm font-black" style={{ color: barColor }}>
          {dim.score}
          <span className="text-[10px] font-semibold opacity-50">/{dim.max}</span>
        </span>
      </div>
      <p className="text-[12px] font-bold mb-1.5" style={{ color: 'var(--t1)' }}>
        {dim.label}
      </p>
      <div style={{ height: 4, background: 'var(--s3)', borderRadius: 99, overflow: 'hidden', marginBottom: 5 }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: barColor, borderRadius: 99,
          transition: 'width 0.6s ease',
        }} />
      </div>
      <p className="text-[10px] leading-tight" style={{ color: 'var(--t3)' }}>
        {dim.detail}
      </p>
    </div>
  )
}

// ── Insight card ──────────────────────────────────────────────────────────────
function InsightCard({ item, setTab }) {
  const cfg = PCFG[item.priority] ?? PCFG.normal
  return (
    <div className="rounded-2xl px-3.5 py-3"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <div className="flex items-start gap-2.5">
        <span className="text-xl leading-none shrink-0 mt-0.5">{item.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5"
            style={{ color: cfg.text }}>
            {item.category}
          </p>
          <p className="text-[13px] font-bold leading-tight mb-1"
            style={{ color: 'var(--t1)' }}>
            {item.title}
          </p>
          <p className="text-[11px] leading-snug" style={{ color: 'var(--t3)' }}>
            {item.desc}
          </p>
        </div>
        {item.action && item.tab && (
          <button
            onClick={() => setTab(item.tab)}
            className="btn-press shrink-0 ml-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
            style={{
              background: `${cfg.dot}18`,
              color: cfg.text,
              border: `1px solid ${cfg.border}`,
              whiteSpace: 'nowrap',
            }}>
            {item.action}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Priority group header ─────────────────────────────────────────────────────
function GroupHead({ label, count, color }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
        {label}
      </span>
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
        style={{ background: `${color}18`, color }}>
        {count}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Advisor({ setTab }) {
  const state = useFinanceStore()

  const advisor = useMemo(() => computeAdvisorScore(state), [
    state.accounts, state.cards, state.investments,
    state.bajoquintos, state.metas, state.subscriptions,
    state.cashflowItems, state.transactions,
  ])

  const { total, label, labelColor, dimensions, insights } = advisor

  const criticals  = insights.filter(i => i.priority === 'critico')
  const importants = insights.filter(i => i.priority === 'importante')
  const normals    = insights.filter(i => i.priority === 'normal')

  const heroGrad =
    total >= 70 ? 'linear-gradient(135deg,#064e3b 0%,#065f46 50%,#047857 100%)' :
    total >= 50 ? 'linear-gradient(135deg,#451a03 0%,#78350f 55%,#92400e 100%)' :
                  'linear-gradient(135deg,#450a0a 0%,#7f1d1d 55%,#991b1b 100%)'

  const summaryText =
    criticals.length > 0
      ? `${criticals.length} situación${criticals.length !== 1 ? 'es' : ''} crítica${criticals.length !== 1 ? 's' : ''} · atención inmediata`
      : importants.length > 0
        ? `${importants.length} aspecto${importants.length !== 1 ? 's' : ''} por mejorar`
        : '¡Sin alertas críticas! Estás en buen camino.'

  return (
    <div className="mb-nav">

      {/* ── Header ── */}
      <div className="px-5 pt-14 pt-safe mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1"
          style={{ color: 'var(--t3)' }}>ANÁLISIS INTELIGENTE</p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--t1)' }}>
            Advisor
          </h1>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{
              background: `${labelColor}18`,
              border: `1px solid ${labelColor}35`,
            }}>
            <BrainCircuit size={13} color={labelColor} />
            <span className="text-xs font-bold" style={{ color: labelColor }}>{label}</span>
          </div>
        </div>
        <p className="text-sm mt-0.5" style={{ color: 'var(--t3)' }}>
          Score financiero actualizado en tiempo real
        </p>
      </div>

      {/* ── Hero Score card ── */}
      <div className="px-5 mb-5">
        <div className="relative overflow-hidden rounded-3xl px-5 py-5"
          style={{ background: heroGrad }}>
          {/* Glows */}
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle,rgba(255,255,255,0.09),transparent)' }} />
          <div className="absolute -bottom-12 -left-8 w-36 h-36 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle,rgba(255,255,255,0.05),transparent)' }} />

          <div className="relative flex items-center gap-4">
            {/* Gauge */}
            <div className="shrink-0">
              <ScoreArc score={total} size={110} />
            </div>

            {/* Right side */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: 'rgba(255,255,255,0.50)' }}>Score Financiero</p>
              <p className="text-2xl font-black text-white leading-tight mb-1">{label}</p>
              <p className="text-[11px] leading-snug"
                style={{ color: 'rgba(255,255,255,0.62)' }}>
                {summaryText}
              </p>

              {/* Mini dimension bars */}
              <div className="mt-3 space-y-1.5">
                {dimensions.map(d => (
                  <div key={d.key} className="flex items-center gap-2">
                    <span className="text-[11px] shrink-0 leading-none" style={{ width: 16 }}>
                      {d.icon}
                    </span>
                    <div className="flex-1 rounded-full overflow-hidden"
                      style={{ height: 3, background: 'rgba(255,255,255,0.12)' }}>
                      <div style={{
                        height: '100%',
                        width: `${(d.score / d.max) * 100}%`,
                        background: STATUS_COLOR[d.status] ?? '#6366F1',
                        borderRadius: 99,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                    <span className="text-[9px] font-semibold shrink-0"
                      style={{ color: 'rgba(255,255,255,0.42)', width: 22, textAlign: 'right' }}>
                      {d.score}/{d.max}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dimensiones 2-col grid ── */}
      <div className="px-5 mb-5">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
          style={{ color: 'var(--t3)' }}>Dimensiones · {dimensions.reduce((s, d) => s + d.score, 0)}/100</p>
        <div className="grid grid-cols-2 gap-2.5">
          {dimensions.map(d => <DimCard key={d.key} dim={d} />)}
        </div>
      </div>

      {/* ── Recomendaciones grouped by priority ── */}
      {insights.length > 0 && (
        <div className="px-5 mb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
            style={{ color: 'var(--t3)' }}>
            Recomendaciones · {insights.length}
          </p>
          <div className="space-y-4">
            {criticals.length > 0 && (
              <div>
                <GroupHead label="Crítico" count={criticals.length} color="#EF4444" />
                <div className="space-y-2">
                  {criticals.map(i => <InsightCard key={i.id} item={i} setTab={setTab} />)}
                </div>
              </div>
            )}
            {importants.length > 0 && (
              <div>
                <GroupHead label="Importante" count={importants.length} color="#F97316" />
                <div className="space-y-2">
                  {importants.map(i => <InsightCard key={i.id} item={i} setTab={setTab} />)}
                </div>
              </div>
            )}
            {normals.length > 0 && (
              <div>
                <GroupHead label="Normal" count={normals.length} color="#6366F1" />
                <div className="space-y-2">
                  {normals.map(i => <InsightCard key={i.id} item={i} setTab={setTab} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

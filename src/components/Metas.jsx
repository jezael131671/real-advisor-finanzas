import { useMemo } from 'react'
import { Plus, Pencil, Trash2, Zap, TrendingUp, Calendar, RefreshCw } from 'lucide-react'
import useFinanceStore from '../store/useFinanceStore.js'
import { computeMetaInsights } from '../store/selectors.js'
import { fmx } from '../lib/formatters.js'
import { META_CATEGORIES } from '../store/defaultData.js'
import toast from 'react-hot-toast'

const num = (n) => Number(n) || 0

const catInfo = (key) => META_CATEGORIES.find(c => c.key === key) ?? { label: key, emoji: '🎯' }

const BAR_COLORS = {
  emergencia: ['#3B82F6', '#06B6D4'],
  inversion:  ['#6366F1', '#8B5CF6'],
  deuda:      ['#F43F5E', '#FB7185'],
  ahorro:     ['#10B981', '#34D399'],
  negocio:    ['#F59E0B', '#FBBF24'],
  viaje:      ['#0EA5E9', '#38BDF8'],
  educacion:  ['#8B5CF6', '#A78BFA'],
  otro:       ['#64748B', '#94A3B8'],
}

// ── Probability badge ─────────────────────────────────────────────────────────
function ProbBadge({ prob, isDone }) {
  if (isDone) return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(5,150,105,0.12)', color: '#059669' }}>
      ✅ Completada
    </span>
  )
  if (prob === null) return null
  const cfg =
    prob >= 80 ? { label: `Alta ${prob}%`,    bg: 'rgba(5,150,105,0.12)',  color: '#059669' } :
    prob >= 55 ? { label: `Media ${prob}%`,   bg: 'rgba(234,179,8,0.12)',  color: '#CA8A04' } :
    prob >= 30 ? { label: `Posible ${prob}%`, bg: 'rgba(249,115,22,0.10)', color: '#EA580C' } :
                 { label: `Baja ${prob}%`,    bg: 'rgba(239,68,68,0.10)',  color: '#DC2626' }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: cfg.bg, color: cfg.color }}>
      🎯 {cfg.label}
    </span>
  )
}

// ── ETA chip ─────────────────────────────────────────────────────────────────
function ETAChip({ estimatedDate, dueDate }) {
  const ref = estimatedDate || (dueDate ? new Date(dueDate + 'T00:00:00') : null)
  if (!ref) return null
  const now    = new Date()
  const diffMs = ref - now
  if (diffMs < 0) return (
    <span className="text-[10px] font-semibold" style={{ color: '#DC2626' }}>⚠️ Vencida</span>
  )
  const months = Math.round(diffMs / (30 * 86_400_000))
  let label
  if (months === 0)     label = 'Este mes'
  else if (months < 12) label = `${months} mes${months !== 1 ? 'es' : ''}`
  else {
    const y = Math.floor(months / 12)
    const m = months % 12
    label = m === 0 ? `${y} año${y !== 1 ? 's' : ''}` : `${y}a ${m}m`
  }
  return (
    <span className="text-[10px] font-semibold" style={{ color: 'var(--t3)' }}>
      📅 En {label}
    </span>
  )
}

// ── Metric cell ───────────────────────────────────────────────────────────────
function MCell({ label, value, color, sub }) {
  return (
    <div className="flex flex-col">
      <p className="text-[9px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--t3)' }}>
        {label}
      </p>
      <p className="text-sm font-black leading-tight" style={{ color: color || 'var(--t1)' }}>
        {value}
      </p>
      {sub && <p className="text-[9px] mt-0.5" style={{ color: 'var(--t3)' }}>{sub}</p>}
    </div>
  )
}

// ── Meta card ─────────────────────────────────────────────────────────────────
function MetaCard({ meta, openModal, onDelete }) {
  const ci      = catInfo(meta.category)
  const isUnit  = meta.unit && meta.unit !== 'MXN'
  const colors  = BAR_COLORS[meta.category] ?? BAR_COLORS.otro
  const barGrad = `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`

  const fmtVal  = (v) => isUnit ? `${v} ${meta.unit}` : fmx(v)
  const pct     = meta.pct

  return (
    <div className="rounded-3xl overflow-hidden fade-up"
      style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>

      {/* ── Card header ── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-2.5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0"
              style={{ background: meta.isDone ? 'rgba(5,150,105,0.12)' : `${colors[0]}18` }}>
              {meta.isDone ? '✅' : (meta.emoji || ci.emoji)}
            </div>
            <div className="min-w-0">
              <p className="font-black text-sm leading-snug" style={{ color: 'var(--t1)' }}>
                {meta.name}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--s2)', color: 'var(--t3)', border: '1px solid var(--border)' }}>
                  {ci.emoji} {ci.label}
                </span>
                {meta.autoUpdated && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                    style={{ background: 'rgba(99,102,241,0.10)', color: '#6366F1', border: '1px solid rgba(99,102,241,0.20)' }}>
                    <RefreshCw size={7} /> Auto
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-1.5 shrink-0 ml-2">
            <span className="text-2xl font-black" style={{ color: meta.isDone ? '#059669' : colors[0] }}>
              {pct.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="rounded-full overflow-hidden mb-1" style={{ height: 6, background: 'var(--s3)' }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: barGrad }} />
        </div>
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px]" style={{ color: 'var(--t3)' }}>
            {fmtVal(meta.current)}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--t3)' }}>
            {fmtVal(meta.target)}
          </span>
        </div>

        {/* ── Metrics grid ── */}
        <div className="grid grid-cols-3 gap-x-3 gap-y-3 mb-3 pt-2"
          style={{ borderTop: '1px solid var(--border)' }}>
          <MCell
            label="Actual"
            value={fmtVal(meta.current)}
            color={meta.isDone ? '#059669' : 'var(--t1)'}
          />
          <MCell
            label="Objetivo"
            value={fmtVal(meta.target)}
          />
          <MCell
            label="Faltante"
            value={meta.isDone ? '¡Listo!' : fmtVal(meta.remaining)}
            color={meta.isDone ? '#059669' : '#D97706'}
          />
          {!isUnit && meta.monthlyNeeded !== null && (
            <MCell
              label="Mensual sugerido"
              value={fmx(meta.monthlyNeeded)}
              color="#6366F1"
              sub={meta.monthlyAvailable > 0 ? `Disponible: ${fmx(meta.monthlyAvailable)}` : undefined}
            />
          )}
          {isUnit && meta.monthlyNeeded !== null && (
            <MCell
              label="Ritmo mensual"
              value={`${meta.monthlyNeeded.toFixed(1)} ${meta.unit}`}
              color="#6366F1"
            />
          )}
          {meta.monthsToComplete !== null && !meta.isDone && (
            <MCell
              label="Tiempo estimado"
              value={
                meta.monthsToComplete < 12
                  ? `${meta.monthsToComplete} mes${meta.monthsToComplete !== 1 ? 'es' : ''}`
                  : `${Math.floor(meta.monthsToComplete / 12)}a ${meta.monthsToComplete % 12}m`
              }
              color="var(--t2)"
            />
          )}
        </div>

        {/* ── Bottom row: ETA + Probability ── */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <ETAChip estimatedDate={meta.estimatedDate} dueDate={meta.dueDate} />
          </div>
          <ProbBadge prob={meta.probability} isDone={meta.isDone} />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-2 px-4 pb-4">
        <button onClick={() => openModal('meta', meta)}
          className="btn-press flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold"
          style={{ background: 'var(--s2)', color: 'var(--t1)', border: '1px solid var(--border)' }}>
          <Pencil size={12} /> Editar
        </button>
        {!meta.isDefault && (
          <button onClick={() => onDelete(meta)}
            className="btn-press w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(225,29,72,0.08)' }}>
            <Trash2 size={13} color="#E11D48" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Hero dashboard ─────────────────────────────────────────────────────────────
function HeroDashboard({ enriched, monthlyAvailable }) {
  const total     = enriched.length
  const done      = enriched.filter(m => m.isDone).length
  const inProg    = total - done
  const avgProb   = enriched.length
    ? Math.round(enriched.reduce((s, m) => s + (m.probability ?? 50), 0) / enriched.length)
    : 0
  const totalNeed = enriched
    .filter(m => !m.isDone && !m.unit)
    .reduce((s, m) => s + (m.monthlyNeeded ?? 0), 0)
  const coverage  = totalNeed > 0 ? Math.min(100, (monthlyAvailable / totalNeed) * 100) : 100
  const surplus   = monthlyAvailable - totalNeed

  const probColor =
    avgProb >= 80 ? '#059669' :
    avgProb >= 55 ? '#CA8A04' :
    avgProb >= 30 ? '#EA580C' : '#DC2626'

  return (
    <div className="mx-5 mb-5 rounded-3xl overflow-hidden relative"
      style={{ background: 'linear-gradient(135deg, #0D0821 0%, #1E1050 55%, #0F1530 100%)' }}>
      {/* Glow */}
      <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle,rgba(99,102,241,0.25),transparent)', filter: 'blur(30px)' }} />

      <div className="relative px-5 pt-5 pb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1"
          style={{ color: 'rgba(255,255,255,0.45)' }}>Centro de metas</p>
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-3xl font-black text-white leading-none">
              {done}/{total}
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.50)' }}>
              metas completadas
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black leading-none" style={{ color: probColor }}>
              {avgProb}%
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              prob. promedio
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { label: 'En progreso',       value: inProg,                            color: '#A5B4FC' },
            { label: 'Cobertura mensual', value: `${coverage.toFixed(0)}%`,         color: coverage >= 80 ? '#34D399' : coverage >= 50 ? '#FCD34D' : '#F87171' },
            { label: 'Mensual necesario', value: fmx(totalNeed),                    color: 'rgba(255,255,255,0.80)' },
            { label: 'Mensual disponible', value: fmx(monthlyAvailable),            color: monthlyAvailable >= totalNeed ? '#34D399' : '#F87171' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl px-3 py-2.5"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-[9px] uppercase tracking-wide mb-1"
                style={{ color: 'rgba(255,255,255,0.40)' }}>{label}</p>
              <p className="text-sm font-black" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Coverage bar */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Cobertura de metas activas
            </span>
            <span className="text-[10px] font-bold" style={{ color: coverage >= 80 ? '#34D399' : '#FCD34D' }}>
              {surplus >= 0 ? `+${fmx(surplus)} sobrante` : `${fmx(Math.abs(surplus))} faltante`}
            </span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'rgba(255,255,255,0.12)' }}>
            <div className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, coverage)}%`,
                background: coverage >= 80
                  ? 'linear-gradient(90deg,#10B981,#34D399)'
                  : coverage >= 50
                    ? 'linear-gradient(90deg,#F59E0B,#FCD34D)'
                    : 'linear-gradient(90deg,#EF4444,#F87171)',
              }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Metas({ openModal }) {
  const state = useFinanceStore()
  const { deleteMeta } = state

  const enriched = useMemo(() => computeMetaInsights(state), [
    state.metas, state.accounts, state.cards, state.investments,
    state.bajoquintos, state.subscriptions, state.cashflowItems,
    state.assets, state.liabilities, state.transactions,
  ])

  const monthlyAvailable = enriched[0]?.monthlyAvailable ?? 0

  const handleDelete = (meta) => {
    if (meta.isDefault) { toast.error('No puedes eliminar metas predeterminadas'); return }
    deleteMeta(meta.id)
    toast.success('Meta eliminada')
  }

  const done    = enriched.filter(m => m.isDone)
  const inProg  = enriched.filter(m => !m.isDone)

  return (
    <div className="mb-nav">

      {/* ── Header ── */}
      <div className="px-5 pt-14 pt-safe pb-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: 'var(--t3)' }}>FINANZAS PERSONALES</p>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--t1)' }}>
              Centro de Metas
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--t3)' }}>
              Proyecciones en tiempo real
            </p>
          </div>
          <button onClick={() => openModal('meta', null)}
            className="btn-press flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', boxShadow: '0 4px 14px rgba(99,102,241,0.30)' }}>
            <Plus size={15} strokeWidth={2.5} /> Nueva
          </button>
        </div>
      </div>

      {/* ── Hero dashboard ── */}
      {enriched.length > 0 && (
        <HeroDashboard enriched={enriched} monthlyAvailable={monthlyAvailable} />
      )}

      {enriched.length === 0 ? (
        <div className="px-5">
          <div className="rounded-3xl p-10 text-center"
            style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>
            <p className="text-5xl mb-4">🎯</p>
            <p className="font-bold mb-1" style={{ color: 'var(--t1)' }}>Sin metas definidas</p>
            <p className="text-sm mb-6" style={{ color: 'var(--t3)' }}>
              Define tus objetivos financieros
            </p>
            <button onClick={() => openModal('meta', null)}
              className="btn-press inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
              <Plus size={14} /> Crear primera meta
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── In progress ── */}
          {inProg.length > 0 && (
            <div className="px-5 mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
                style={{ color: 'var(--t3)' }}>
                En progreso · {inProg.length}
              </p>
              <div className="space-y-3">
                {inProg.map(meta => (
                  <MetaCard
                    key={meta.id}
                    meta={meta}
                    openModal={openModal}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Completed ── */}
          {done.length > 0 && (
            <div className="px-5 mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
                style={{ color: 'var(--t3)' }}>
                Completadas · {done.length}
              </p>
              <div className="space-y-3">
                {done.map(meta => (
                  <MetaCard
                    key={meta.id}
                    meta={meta}
                    openModal={openModal}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

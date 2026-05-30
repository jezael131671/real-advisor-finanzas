import { useState, useMemo } from 'react'
import { Calendar, TrendingUp, TrendingDown, Zap, ChevronRight, ArrowUpRight, ArrowDownRight, BookOpen } from 'lucide-react'
import useFinanceStore from '../store/useFinanceStore.js'
import { computePlannerData } from '../store/selectors.js'
import { fmx } from '../lib/formatters.js'

const num = (n) => Number(n) || 0

// ── Priority config ───────────────────────────────────────────────────────────
const PCFG = {
  critico:    { dot: '#EF4444', text: '#EF4444', bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.22)'   },
  importante: { dot: '#F97316', text: '#F97316', bg: 'rgba(249,115,22,0.05)',  border: 'rgba(249,115,22,0.22)'  },
  normal:     { dot: '#6366F1', text: 'var(--t3)', bg: 'var(--s1)',            border: 'var(--border)'           },
}

// ── Tab selector ─────────────────────────────────────────────────────────────
function TabBar({ active, setActive }) {
  const tabs = [
    { key: 'semana',       label: 'Esta semana', icon: '📅' },
    { key: 'mes',          label: 'Este mes',    icon: '📊' },
    { key: 'prioridades',  label: 'Prioridades', icon: '⚡' },
  ]
  return (
    <div className="flex gap-1.5 px-5 mb-5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => setActive(t.key)}
          className="btn-press shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition-all"
          style={{
            background: active === t.key ? 'rgba(99,102,241,0.18)' : 'var(--s1)',
            color:      active === t.key ? '#A5B4FC' : 'var(--t3)',
            border:     active === t.key ? '1px solid rgba(99,102,241,0.35)' : '1px solid var(--border)',
          }}>
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function Empty({ emoji, text }) {
  return (
    <div className="py-5 text-center">
      <p className="text-2xl mb-1.5">{emoji}</p>
      <p className="text-xs" style={{ color: 'var(--t3)' }}>{text}</p>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
function SHead({ label, count }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--t3)' }}>
        {label}
      </p>
      {count > 0 && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: 'var(--s2)', color: 'var(--t3)', border: '1px solid var(--border)' }}>
          {count}
        </span>
      )}
    </div>
  )
}

// ── Priority action card ──────────────────────────────────────────────────────
function ActionCard({ item, setTab }) {
  const cfg = PCFG[item.priority] ?? PCFG.normal
  return (
    <div className="rounded-2xl px-3.5 py-3 mb-2"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <div className="flex items-start gap-2.5">
        <span className="text-lg leading-none shrink-0 mt-0.5">{item.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: cfg.text }}>
            {item.category}
          </p>
          <p className="text-[13px] font-bold leading-tight mb-0.5" style={{ color: 'var(--t1)' }}>
            {item.title}
          </p>
          <p className="text-[11px] leading-snug" style={{ color: 'var(--t3)' }}>
            {item.desc}
          </p>
          {(item.amount || item.date) && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {item.amount > 0 && (
                <span className="text-[11px] font-black" style={{ color: cfg.dot }}>
                  {fmx(item.amount)}
                </span>
              )}
              {item.date && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: `${cfg.dot}18`, color: cfg.dot }}>
                  {item.date}
                </span>
              )}
            </div>
          )}
        </div>
        {item.action && item.tab && (
          <button onClick={() => setTab(item.tab)}
            className="btn-press shrink-0 ml-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
            style={{ background: `${cfg.dot}18`, color: cfg.text, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>
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
    <div className="flex items-center gap-2 mb-2 mt-4">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
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
// TAB: ESTA SEMANA
// ─────────────────────────────────────────────────────────────────────────────
function TabSemana({ data, setTab }) {
  const { weekPayments, weekCollections, weekFollowups, weekMetas } = data
  const hasContent = weekPayments.length || weekCollections.length ||
                     weekFollowups.length || weekMetas.length

  if (!hasContent) return (
    <div className="px-5">
      <div className="rounded-3xl p-8 text-center"
        style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>
        <p className="text-4xl mb-3">🎉</p>
        <p className="font-bold mb-1" style={{ color: 'var(--t1)' }}>¡Semana tranquila!</p>
        <p className="text-sm" style={{ color: 'var(--t3)' }}>Sin pagos, cobros ni seguimientos urgentes esta semana.</p>
      </div>
    </div>
  )

  return (
    <div className="px-5 space-y-5">

      {/* Pagos próximos */}
      {weekPayments.length > 0 && (
        <div>
          <SHead label="Pagos próximos" count={weekPayments.length} />
          <div className="space-y-2">
            {weekPayments.map(c => (
              <div key={c.id} className="rounded-2xl px-3.5 py-3 flex items-center gap-3"
                style={{
                  background: c.daysUntil <= 2 ? 'rgba(239,68,68,0.06)' : 'var(--s1)',
                  border: `1px solid ${c.daysUntil <= 2 ? 'rgba(239,68,68,0.22)' : 'var(--border)'}`,
                }}>
                <span className="text-xl shrink-0">💳</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold" style={{ color: 'var(--t1)' }}>
                    {c.bankName || c.alias || 'Tarjeta'}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--t3)' }}>
                    {c.daysUntil === 0 ? '¡Vence HOY!'
                      : c.daysUntil === 1 ? 'Vence mañana'
                      : `Vence en ${c.daysUntil} días`}
                    {' · '}{fmx(c.balance)}
                  </p>
                </div>
                <button onClick={() => setTab('cards')}
                  className="btn-press shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
                  style={{ background: 'rgba(239,68,68,0.10)', color: '#DC2626' }}>
                  Pagar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cobros pendientes */}
      {weekCollections.length > 0 && (
        <div>
          <SHead label="Cobros pendientes" count={weekCollections.length} />
          <div className="space-y-2">
            {weekCollections.map(bq => (
              <div key={bq.id} className="rounded-2xl px-3.5 py-3 flex items-center gap-3"
                style={{
                  background: bq.isOverdue ? 'rgba(239,68,68,0.06)' : 'var(--s1)',
                  border: `1px solid ${bq.isOverdue ? 'rgba(239,68,68,0.22)' : 'var(--border)'}`,
                }}>
                <span className="text-xl shrink-0">🎸</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold" style={{ color: 'var(--t1)' }}>
                    {bq.client}
                    {bq.isOverdue && <span className="ml-1 text-[10px] font-bold text-red-500">VENCIDO</span>}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--t3)' }}>
                    {bq.model || 'Bajoquinto'} · {fmx(bq.pending)} pendiente
                  </p>
                </div>
                <button onClick={() => setTab('bajoquintos')}
                  className="btn-press shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
                  style={{ background: 'rgba(5,150,105,0.10)', color: '#059669' }}>
                  Cobrar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seguimientos CRM */}
      {weekFollowups.length > 0 && (
        <div>
          <SHead label="Seguimientos CRM" count={weekFollowups.length} />
          <div className="space-y-2">
            {weekFollowups.map(bq => (
              <div key={bq.id} className="rounded-2xl px-3.5 py-3 flex items-center gap-3"
                style={{
                  background: bq.urgency === 'critico' ? 'rgba(239,68,68,0.06)' : 'var(--s1)',
                  border: `1px solid ${bq.urgency === 'critico' ? 'rgba(239,68,68,0.22)' : 'var(--border)'}`,
                }}>
                <span className="text-xl shrink-0">💬</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold" style={{ color: 'var(--t1)' }}>
                    {bq.client}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--t3)' }}>
                    {bq.model || 'Prospecto'} · {bq.daysSinceContact}d sin contacto
                    {bq.followUpNote ? ` · "${bq.followUpNote.slice(0, 30)}${bq.followUpNote.length > 30 ? '…' : ''}"` : ''}
                  </p>
                </div>
                <button onClick={() => setTab('bajoquintos')}
                  className="btn-press shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
                  style={{ background: 'rgba(99,102,241,0.10)', color: '#6366F1' }}>
                  Ver
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metas sugeridas */}
      {weekMetas.length > 0 && (
        <div>
          <SHead label="Metas · aporte sugerido" count={weekMetas.length} />
          <div className="space-y-2">
            {weekMetas.map(m => (
              <div key={m.id} className="rounded-2xl px-3.5 py-3 flex items-center gap-3"
                style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>
                <span className="text-xl shrink-0">{m.emoji || '🎯'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold" style={{ color: 'var(--t1)' }}>{m.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 rounded-full overflow-hidden"
                      style={{ height: 3, background: 'var(--s3)' }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${m.pct}%`, background: '#6366F1' }} />
                    </div>
                    <span className="text-[10px] font-bold shrink-0" style={{ color: '#6366F1' }}>
                      {m.pct.toFixed(0)}%
                    </span>
                  </div>
                  {m.suggested > 0 && (
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--t3)' }}>
                      Sugerido: <span className="font-bold" style={{ color: '#6366F1' }}>{fmx(m.suggested)}</span>
                    </p>
                  )}
                </div>
                <button onClick={() => setTab('metas')}
                  className="btn-press shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] font-bold"
                  style={{ background: 'rgba(99,102,241,0.10)', color: '#6366F1' }}>
                  Ver
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: ESTE MES
// ─────────────────────────────────────────────────────────────────────────────
function TabMes({ data, setTab, networthHistory }) {
  const { thisMonth } = data
  const { projectedIncome, projectedExpenses, potentialSavings, netFlow,
          startCash, projectedBalance, inflows, outflows, isSurplus } = thisMonth

  return (
    <div className="px-5 space-y-5">

      {/* Hero card */}
      <div className="relative rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#0D0821 0%,#1E1050 55%,#0F1530 100%)' }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle,rgba(99,102,241,0.25),transparent)', filter: 'blur(30px)' }} />
        <div className="relative p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1"
            style={{ color: 'rgba(255,255,255,0.45)' }}>Proyección 30 días</p>

          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-[11px] mb-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Flujo neto esperado</p>
              <p className="text-3xl font-black leading-none"
                style={{ color: isSurplus ? '#34D399' : '#F87171' }}>
                {isSurplus ? '+' : ''}{fmx(netFlow)}
              </p>
            </div>
            {isSurplus
              ? <TrendingUp  size={36} color="#34D399" strokeWidth={1.5} className="opacity-60" />
              : <TrendingDown size={36} color="#F87171" strokeWidth={1.5} className="opacity-60" />}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Saldo actual',        value: fmx(startCash),         color: 'rgba(255,255,255,0.80)' },
              { label: 'Saldo proyectado',     value: fmx(projectedBalance),  color: projectedBalance >= startCash ? '#34D399' : '#F87171' },
              { label: 'Ingresos esperados',   value: fmx(projectedIncome),   color: '#34D399' },
              { label: 'Gastos proyectados',   value: fmx(projectedExpenses), color: '#F87171' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-[9px] uppercase tracking-wide mb-1"
                  style={{ color: 'rgba(255,255,255,0.40)' }}>{label}</p>
                <p className="text-sm font-black" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          {potentialSavings > 0 && (
            <div className="mt-3 rounded-2xl px-3 py-2.5"
              style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.20)' }}>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Ahorro potencial este mes
              </p>
              <p className="text-lg font-black" style={{ color: '#34D399' }}>+{fmx(potentialSavings)}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Patrimonio trend ── */}
      {networthHistory && networthHistory.length >= 2 && (() => {
        const sorted  = [...networthHistory].sort((a, b) => a.date.localeCompare(b.date))
        const prev    = sorted[sorted.length - 2]
        const curr    = sorted[sorted.length - 1]
        const change  = num(curr.netWorth) - num(prev.netWorth)
        const pct     = num(prev.netWorth) !== 0
          ? (change / Math.abs(num(prev.netWorth))) * 100 : 0
        const isUp    = change >= 0
        return (
          <button onClick={() => setTab('evolucion')} className="btn-press w-full text-left">
            <div className="rounded-3xl px-4 py-4"
              style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm leading-none">💎</span>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--t3)' }}>
                    Patrimonio neto · tendencia
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: isUp ? 'rgba(5,150,105,0.10)' : 'rgba(239,68,68,0.08)',
                    color: isUp ? '#059669' : '#EF4444',
                  }}>
                  {isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
                </span>
              </div>
              <p className="text-2xl font-black leading-tight mb-0.5" style={{ color: 'var(--t1)' }}>
                {fmx(curr.netWorth)}
              </p>
              <p className="text-xs font-semibold" style={{ color: isUp ? '#059669' : '#EF4444' }}>
                {isUp ? '+' : ''}{fmx(change)} vs {curr.label !== prev.label ? (prev.label || prev.date) : prev.date}
              </p>
              <p className="text-[10px] mt-2 font-semibold" style={{ color: 'rgba(99,102,241,0.70)' }}>
                Ver evolución mensual →
              </p>
            </div>
          </button>
        )
      })()}

      {/* Ingresos proyectados */}
      {inflows.length > 0 && (
        <div>
          <SHead label="Ingresos proyectados" count={inflows.length} />
          <div className="space-y-2">
            {inflows.map((item, i) => (
              <div key={item.id || i} className="rounded-2xl px-3.5 py-3 flex items-center gap-3"
                style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(5,150,105,0.10)' }}>
                  <ArrowUpRight size={14} color="#059669" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold truncate" style={{ color: 'var(--t1)' }}>{item.label}</p>
                  <p className="text-[10px]" style={{ color: 'var(--t3)' }}>{item.dateStr}</p>
                </div>
                <p className="text-sm font-black shrink-0" style={{ color: '#059669' }}>
                  +{fmx(item.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gastos proyectados */}
      {outflows.length > 0 && (
        <div>
          <SHead label="Gastos proyectados" count={outflows.length} />
          <div className="space-y-2">
            {outflows.map((item, i) => (
              <div key={item.id || i} className="rounded-2xl px-3.5 py-3 flex items-center gap-3"
                style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(239,68,68,0.08)' }}>
                  <ArrowDownRight size={14} color="#EF4444" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold truncate" style={{ color: 'var(--t1)' }}>{item.label}</p>
                  <p className="text-[10px]" style={{ color: 'var(--t3)' }}>
                    {item.source === 'tarjeta' ? '💳 Tarjeta' : item.source === 'suscripcion' ? '📱 Suscripción' : '📝 Programado'}
                    {' · '}{item.dateStr}
                  </p>
                </div>
                <p className="text-sm font-black shrink-0" style={{ color: '#EF4444' }}>
                  -{fmx(item.amount)}
                </p>
              </div>
            ))}
          </div>
          <button onClick={() => setTab('cashflow')}
            className="btn-press w-full mt-2 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5"
            style={{ background: 'var(--s1)', color: 'var(--t3)', border: '1px solid var(--border)' }}>
            Ver flujo completo <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* Ver libro mayor */}
      <button onClick={() => setTab('libro')}
        className="btn-press w-full py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2"
        style={{ background: 'var(--s1)', color: 'var(--t3)', border: '1px solid var(--border)' }}>
        <BookOpen size={13} />
        Ver libro mayor completo
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: PRIORIDADES
// ─────────────────────────────────────────────────────────────────────────────
function TabPrioridades({ data, setTab }) {
  const { priorities } = data
  if (!priorities.length) return (
    <div className="px-5">
      <div className="rounded-3xl p-8 text-center"
        style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>
        <p className="text-4xl mb-3">✅</p>
        <p className="font-bold mb-1" style={{ color: 'var(--t1)' }}>¡Sin acciones urgentes!</p>
        <p className="text-sm" style={{ color: 'var(--t3)' }}>Tus finanzas están al día.</p>
      </div>
    </div>
  )

  const criticals  = priorities.filter(p => p.priority === 'critico')
  const importants = priorities.filter(p => p.priority === 'importante')
  const normals    = priorities.filter(p => p.priority === 'normal')

  return (
    <div className="px-5">
      {criticals.length > 0 && (
        <>
          <GroupHead label="Crítico" count={criticals.length} color="#EF4444" />
          {criticals.map(item => <ActionCard key={item.id} item={item} setTab={setTab} />)}
        </>
      )}
      {importants.length > 0 && (
        <>
          <GroupHead label="Importante" count={importants.length} color="#F97316" />
          {importants.map(item => <ActionCard key={item.id} item={item} setTab={setTab} />)}
        </>
      )}
      {normals.length > 0 && (
        <>
          <GroupHead label="Normal" count={normals.length} color="#6366F1" />
          {normals.map(item => <ActionCard key={item.id} item={item} setTab={setTab} />)}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function Planner({ setTab }) {
  const state = useFinanceStore()
  const { networthHistory = [] } = state
  const [activeTab, setActiveTab] = useState('prioridades')

  const data = useMemo(() => computePlannerData(state), [
    state.cards, state.bajoquintos, state.accounts, state.investments,
    state.subscriptions, state.cashflowItems, state.metas, state.transactions,
    state.assets, state.liabilities,
  ])

  const critCount = data.priorities.filter(p => p.priority === 'critico').length
  const totalActions = data.priorities.length

  return (
    <div className="mb-nav">

      {/* ── Header ── */}
      <div className="px-5 pt-14 pt-safe pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1"
          style={{ color: 'var(--t3)' }}>FINANZAS PERSONALES</p>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--t1)' }}>
              Planner
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--t3)' }}>
              {critCount > 0
                ? `${critCount} acción${critCount !== 1 ? 'es' : ''} crítica${critCount !== 1 ? 's' : ''} hoy`
                : totalActions > 0
                  ? `${totalActions} acciones planificadas`
                  : 'Todo al día · sin urgencias'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{
              background: critCount > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(99,102,241,0.10)',
              border: critCount > 0 ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(99,102,241,0.25)',
            }}>
            <Zap size={13} color={critCount > 0 ? '#EF4444' : '#6366F1'} />
            <span className="text-xs font-bold" style={{ color: critCount > 0 ? '#EF4444' : '#6366F1' }}>
              {totalActions} acciones
            </span>
          </div>
        </div>
      </div>

      {/* ── Tab selector ── */}
      <TabBar active={activeTab} setActive={setActiveTab} />

      {/* ── Tab content ── */}
      {activeTab === 'semana'      && <TabSemana      data={data} setTab={setTab} />}
      {activeTab === 'mes'         && <TabMes         data={data} setTab={setTab} networthHistory={networthHistory} />}
      {activeTab === 'prioridades' && <TabPrioridades data={data} setTab={setTab} />}

    </div>
  )
}

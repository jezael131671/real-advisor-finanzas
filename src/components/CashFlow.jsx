import { useState, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, Plus, Trash2,
  ChevronDown, ChevronUp, ShieldCheck, BarChart2,
  Rocket, CreditCard, Repeat, Guitar, Calendar, X,
} from 'lucide-react'
import useFinanceStore           from '../store/useFinanceStore.js'
import { computeCashFlow }       from '../store/selectors.js'
import { fmx, fmxC, fmtDate, today } from '../lib/formatters.js'
import toast                     from 'react-hot-toast'

// ── Constants ─────────────────────────────────────────────────────────────────
const SCENARIOS = [
  { key: 'conservador', label: 'Conservador', icon: ShieldCheck, desc: '50% cobros · +10% gastos', color: '#D97706' },
  { key: 'normal',      label: 'Normal',      icon: BarChart2,   desc: '75% cobros · estimado',   color: '#4F46E5' },
  { key: 'optimista',   label: 'Optimista',   icon: Rocket,      desc: '100% cobros · -10% gst',  color: '#059669' },
]
const HORIZONS = [
  { days: 30, label: '30 días' },
  { days: 60, label: '60 días' },
  { days: 90, label: '90 días' },
]
const SOURCE_META = {
  crm:         { icon: Guitar,     color: '#D97706', label: 'CRM'           },
  manual:      { icon: Calendar,   color: '#7C3AED', label: 'Programado'    },
  tarjeta:     { icon: CreditCard, color: '#E11D48', label: 'Tarjeta'       },
  suscripcion: { icon: Repeat,     color: '#0891B2', label: 'Suscripción'   },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => fmxC(Math.abs(n))
const labelDate = (dateStr) => {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return fmtDate(dateStr, 'd MMM')
  } catch { return dateStr }
}

// ── Item row ─────────────────────────────────────────────────────────────────
function CashItem({ item, onDelete }) {
  const meta = SOURCE_META[item.source] || SOURCE_META.manual
  const Icon = meta.icon
  return (
    <div className="flex items-center gap-3 py-2.5"
      style={{ borderBottom: '1px solid var(--s3)' }}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${meta.color}18` }}>
        <Icon size={15} color={meta.color} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--t1)' }}>
          {item.label}
        </p>
        <p className="text-[11px]" style={{ color: 'var(--t3)' }}>
          {labelDate(item.dateStr)} · {meta.label}
          {item.source === 'crm' && item.rawAmount !== item.amount &&
            ` · ${Math.round((item.amount / item.rawAmount) * 100)}% esperado`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-black" style={{ color: 'var(--t1)' }}>{fmx(item.amount)}</p>
        {item.rawAmount && item.rawAmount !== item.amount &&
          <p className="text-[10px]" style={{ color: 'var(--t3)' }}>de {fmx(item.rawAmount)}</p>}
      </div>
      {onDelete && (
        <button onClick={onDelete}
          className="btn-press w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ml-1"
          style={{ background: 'var(--s3)' }}>
          <Trash2 size={11} color="var(--t3)" />
        </button>
      )}
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────
function Section({ title, total, items, kind, expanded, onToggle, onDelete, onAdd, accentColor }) {
  return (
    <div className="card mb-3">
      {/* Header */}
      <button className="w-full flex justify-between items-center"
        onClick={onToggle}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
          <p className="text-sm font-bold" style={{ color: 'var(--t1)' }}>{title}</p>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${accentColor}15`, color: accentColor }}>
            {items.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm font-black" style={{ color: accentColor }}>
            {kind === 'ingreso' ? '+' : '-'}{fmx(total)}
          </p>
          {expanded ? <ChevronUp size={16} color="var(--t3)" /> : <ChevronDown size={16} color="var(--t3)" />}
        </div>
      </button>

      {/* Items */}
      {expanded && (
        <div className="mt-3">
          {items.length === 0 ? (
            <p className="text-xs text-center py-3" style={{ color: 'var(--t3)' }}>
              {kind === 'ingreso' ? 'Sin entradas esperadas en este periodo' : 'Sin salidas en este periodo'}
            </p>
          ) : (
            items.map(item => (
              <CashItem
                key={item.id}
                item={item}
                onDelete={item.source === 'manual' ? () => onDelete(item.id) : null}
              />
            ))
          )}
          {/* Add button */}
          <button onClick={onAdd}
            className="btn-press mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: `${accentColor}12`, color: accentColor, border: `1px dashed ${accentColor}40` }}>
            <Plus size={15} />
            Agregar {kind === 'ingreso' ? 'ingreso' : 'gasto'} esperado
          </button>
        </div>
      )}
    </div>
  )
}

// ── Add Item Form ─────────────────────────────────────────────────────────────
function AddItemForm({ defaultKind, onSave, onCancel }) {
  const [form, setForm] = useState({
    kind:   defaultKind || 'ingreso',
    label:  '',
    amount: '',
    date:   today(),
    note:   '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.label.trim()) return toast.error('Escribe una descripción')
    if (!Number(form.amount) || Number(form.amount) <= 0) return toast.error('Monto inválido')
    if (!form.date) return toast.error('Selecciona una fecha')
    onSave(form)
  }

  return (
    <div className="card mb-3" style={{ border: '1px solid var(--accent)', borderStyle: 'dashed' }}>
      {/* Kind toggle */}
      <div className="flex gap-2 mb-4">
        {['ingreso', 'gasto'].map(k => (
          <button key={k} onClick={() => set('kind', k)}
            className="btn-press flex-1 py-2 rounded-xl text-sm font-bold"
            style={{
              background: form.kind === k
                ? k === 'ingreso' ? '#059669' : '#E11D48'
                : 'var(--s2)',
              color: form.kind === k ? '#fff' : 'var(--t2)',
              border: '1px solid var(--border)',
            }}>
            {k === 'ingreso' ? '↑ Ingreso' : '↓ Gasto'}
          </button>
        ))}
      </div>

      {/* Fields */}
      <div className="space-y-3">
        <div>
          <label className="form-label">Descripción *</label>
          <input className="input-field" placeholder="Ej. Pago cliente, Renta, Freelance..."
            value={form.label} onChange={e => set('label', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Monto (MXN) *</label>
            <input className="input-field" type="number" placeholder="0"
              value={form.amount} onChange={e => set('amount', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Fecha esperada *</label>
            <input className="input-field" type="date"
              value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="form-label">Nota (opcional)</label>
          <input className="input-field" placeholder="Contexto adicional..."
            value={form.note} onChange={e => set('note', e.target.value)} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button onClick={onCancel}
          className="btn-press flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--border)' }}>
          Cancelar
        </button>
        <button onClick={handleSave}
          className="btn-press flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#4F46E5,#6366F1)' }}>
          Guardar
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CashFlow({ setTab }) {
  const state = useFinanceStore()
  const { addCashflowItem, deleteCashflowItem } = state

  const [scenario,     setScenario]     = useState('normal')
  const [horizon,      setHorizon]      = useState(30)
  const [expandIn,     setExpandIn]     = useState(true)
  const [expandOut,    setExpandOut]    = useState(true)
  const [addingKind,   setAddingKind]   = useState(null) // 'ingreso' | 'gasto' | null

  const cf = useMemo(() => computeCashFlow(state, scenario, horizon), [
    state.accounts, state.cards, state.bajoquintos,
    state.subscriptions, state.cashflowItems,
    scenario, horizon,
  ])

  const scenarioMeta = SCENARIOS.find(s => s.key === scenario)
  const ScenIcon     = scenarioMeta.icon

  const handleSaveItem = (form) => {
    addCashflowItem({
      kind:   form.kind,
      label:  form.label.trim(),
      amount: Number(form.amount),
      date:   form.date,
      note:   form.note.trim(),
    })
    setAddingKind(null)
    toast.success(`${form.kind === 'ingreso' ? 'Ingreso' : 'Gasto'} agregado`)
  }

  const handleDelete = (id) => {
    deleteCashflowItem(id)
    toast('Entrada eliminada', { icon: '🗑️' })
  }

  return (
    <div className="pb-28">
      {/* ── Header ── */}
      <div className="px-5 pt-6 pb-4">
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
          FINANZAS
        </p>
        <h1 className="text-2xl font-black" style={{ color: 'var(--t1)' }}>Flujo de Caja</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--t3)' }}>
          Proyección financiera · {scenarioMeta.label}
        </p>
      </div>

      {/* ── Scenario switcher ── */}
      <div className="px-5 mb-4">
        <div className="grid grid-cols-3 gap-2">
          {SCENARIOS.map(sc => {
            const Icon = sc.icon
            const active = scenario === sc.key
            return (
              <button key={sc.key} onClick={() => setScenario(sc.key)}
                className="btn-press flex flex-col items-center gap-1.5 py-3 rounded-2xl"
                style={{
                  background: active ? `${sc.color}18` : 'var(--s1)',
                  border: `1.5px solid ${active ? sc.color : 'var(--border)'}`,
                }}>
                <Icon size={18} color={active ? sc.color : 'var(--t3)'} strokeWidth={2} />
                <p className="text-[11px] font-bold leading-tight text-center"
                  style={{ color: active ? sc.color : 'var(--t2)' }}>
                  {sc.label}
                </p>
                <p className="text-[9px] leading-tight text-center" style={{ color: 'var(--t3)' }}>
                  {sc.desc}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Horizon tabs ── */}
      <div className="px-5 mb-4">
        <div className="seg-wrap">
          {HORIZONS.map(h => (
            <button key={h.days} onClick={() => setHorizon(h.days)}
              className={`seg-item${horizon === h.days ? ' seg-active' : ''}`}>
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Hero projection card ── */}
      <div className="px-5 mb-4">
        <div className="rounded-3xl p-5 relative overflow-hidden"
          style={{
            background: cf.isSurplus
              ? 'linear-gradient(135deg,#064E3B,#065F46)'
              : 'linear-gradient(135deg,#7F1D1D,#991B1B)',
          }}>
          {/* Decorative blob */}
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10"
            style={{ background: '#fff' }} />

          <p className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: 'rgba(255,255,255,0.6)' }}>
            Saldo proyectado · {horizon} días
          </p>

          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-3xl font-black text-white leading-none">
                {fmxC(cf.projectedBalance)}
              </p>
              <p className="text-sm mt-1.5 font-semibold"
                style={{ color: cf.isSurplus ? '#86EFAC' : '#FCA5A5' }}>
                {cf.isSurplus ? '▲ Superávit ' : '▼ Déficit '}
                {fmx(Math.abs(cf.netFlow))}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              {cf.isSurplus
                ? <TrendingUp size={24} color="#fff" />
                : <TrendingDown size={24} color="#fff" />}
            </div>
          </div>

          {/* Flow breakdown */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Efectivo hoy',  value: cf.startCash,    color: 'rgba(255,255,255,0.7)'  },
              { label: 'Entradas',      value: cf.totalInflows,  color: '#86EFAC', prefix: '+' },
              { label: 'Salidas',       value: cf.totalOutflows, color: '#FCA5A5', prefix: '-' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-2.5"
                style={{ background: 'rgba(255,255,255,0.08)' }}>
                <p className="text-[9px] font-bold uppercase tracking-wide mb-1"
                  style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {s.label}
                </p>
                <p className="text-sm font-black" style={{ color: s.color }}>
                  {s.prefix || ''}{fmxC(s.value)}
                </p>
              </div>
            ))}
          </div>

          {/* Progress bar: inflows vs outflows */}
          {(cf.totalInflows + cf.totalOutflows) > 0 && (
            <div className="mt-4">
              <div className="flex rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.12)' }}>
                <div style={{
                  width: `${Math.min(100, (cf.totalInflows / (cf.totalInflows + cf.totalOutflows)) * 100)}%`,
                  background: '#4ADE80',
                }} />
              </div>
              <div className="flex justify-between mt-1">
                <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Entradas {cf.totalInflows > 0 ? Math.round((cf.totalInflows / (cf.totalInflows + cf.totalOutflows)) * 100) : 0}%
                </p>
                <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Salidas {cf.totalOutflows > 0 ? Math.round((cf.totalOutflows / (cf.totalInflows + cf.totalOutflows)) * 100) : 0}%
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Add form (inline) ── */}
      {addingKind && (
        <div className="px-5 mb-2">
          <AddItemForm
            defaultKind={addingKind}
            onSave={handleSaveItem}
            onCancel={() => setAddingKind(null)}
          />
        </div>
      )}

      {/* ── Entradas section ── */}
      <div className="px-5">
        <Section
          title="Entradas esperadas"
          total={cf.totalInflows}
          items={cf.inflows}
          kind="ingreso"
          expanded={expandIn}
          onToggle={() => setExpandIn(v => !v)}
          onDelete={handleDelete}
          onAdd={() => { setAddingKind('ingreso'); setExpandIn(true) }}
          accentColor="#059669"
        />

        {/* ── Salidas section ── */}
        <Section
          title="Salidas esperadas"
          total={cf.totalOutflows}
          items={cf.outflows}
          kind="gasto"
          expanded={expandOut}
          onToggle={() => setExpandOut(v => !v)}
          onDelete={handleDelete}
          onAdd={() => { setAddingKind('gasto'); setExpandOut(true) }}
          accentColor="#E11D48"
        />
      </div>

      {/* ── Source legend ── */}
      <div className="px-5 mt-2">
        <div className="card">
          <p className="text-[11px] font-bold mb-3 uppercase tracking-wide" style={{ color: 'var(--t3)' }}>
            Fuentes incluidas
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(SOURCE_META).map(([key, meta]) => {
              const Icon = meta.icon
              return (
                <div key={key} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: `${meta.color}18` }}>
                    <Icon size={12} color={meta.color} />
                  </div>
                  <p className="text-xs font-medium" style={{ color: 'var(--t2)' }}>{meta.label}</p>
                </div>
              )
            })}
          </div>
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--s3)' }}>
            <p className="text-[10px]" style={{ color: 'var(--t3)' }}>
              Escenario <strong>{scenarioMeta.label}</strong>: {scenarioMeta.desc}.
              Los cobros CRM sin fecha de compromiso se proyectan a 20 días.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

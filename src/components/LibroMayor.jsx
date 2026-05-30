import { useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import useFinanceStore from '../store/useFinanceStore.js'
import { fmx, fmxC } from '../lib/formatters.js'

const num = (n) => Number(n) || 0

// ── Transaction type config ────────────────────────────────────────────────────
const TX_CFG = {
  ingreso:      { label: 'Ingreso',       emoji: '💰', color: '#059669', bg: 'rgba(5,150,105,0.10)',   sign: +1 },
  bajoquinto:   { label: 'Abono CRM',     emoji: '🎸', color: '#D97706', bg: 'rgba(217,119,6,0.10)',   sign: +1 },
  gasto:        { label: 'Gasto',         emoji: '💸', color: '#E11D48', bg: 'rgba(225,29,72,0.09)',   sign: -1 },
  pago_tarjeta: { label: 'Pago tarjeta',  emoji: '💳', color: '#7C3AED', bg: 'rgba(124,58,237,0.09)',  sign: -1 },
  inversion:    { label: 'Inversión',     emoji: '📈', color: '#2563EB', bg: 'rgba(37,99,235,0.09)',   sign: -1 },
  transferencia:{ label: 'Transferencia', emoji: '↔️', color: '#0891B2', bg: 'rgba(8,145,178,0.09)',   sign:  0 },
}

// ── Filter definitions ─────────────────────────────────────────────────────────
const FILTERS = [
  { key: 'todos',          label: 'Todos',          types: null,               isSubs: false },
  { key: 'ingresos',       label: 'Ingresos',       types: ['ingreso'],        isSubs: false },
  { key: 'gastos',         label: 'Gastos',         types: ['gasto'],          isSubs: false },
  { key: 'tarjetas',       label: 'Tarjetas',       types: ['pago_tarjeta'],   isSubs: false },
  { key: 'bajoquintos',    label: 'Bajoquintos',    types: ['bajoquinto'],     isSubs: false },
  { key: 'inversiones',    label: 'Inversiones',    types: ['inversion'],      isSubs: false },
  { key: 'transferencias', label: 'Transferencias', types: ['transferencia'],  isSubs: false },
  { key: 'suscripciones',  label: 'Suscripciones',  types: null,               isSubs: true  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────
const getMonthKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const fmtDateLabel = (dateStr) => {
  if (!dateStr || dateStr === 'Sin fecha') return 'Sin fecha'
  try {
    const today = format(new Date(), 'yyyy-MM-dd')
    const yest  = format(new Date(Date.now() - 86_400_000), 'yyyy-MM-dd')
    if (dateStr === today) return 'Hoy'
    if (dateStr === yest)  return 'Ayer'
    const [y, m, d] = dateStr.split('-')
    return format(new Date(+y, +m - 1, +d), "d 'de' MMM", { locale: es })
  } catch { return dateStr }
}

const searchMatches = (tx, q, lkp) => {
  if (!q) return true
  const lo = q.toLowerCase().replace(/[$,]/g, '')
  const checks = [
    tx.description,
    tx.note,
    String(num(tx.amount)),
    lkp.accounts.find(a => a.id === tx.accountId)?.name,
    lkp.accounts.find(a => a.id === tx.accountId)?.institution,
    lkp.accounts.find(a => a.id === tx.targetAccountId)?.name,
    lkp.cards.find(c => c.id === tx.cardId)?.bankName,
    lkp.cards.find(c => c.id === tx.cardId)?.alias,
    lkp.categories.find(c => c.id === tx.category)?.name,
    lkp.bajoquintos.find(b => b.id === tx.bajoquintoId)?.client,
    lkp.bajoquintos.find(b => b.id === tx.bajoquintoId)?.model,
    TX_CFG[tx.type]?.label,
  ]
  return checks.some(v => v?.toLowerCase().includes(lo))
}

// ── Transaction row ────────────────────────────────────────────────────────────
function TxRow({ tx, onClick, lkp }) {
  const cfg   = TX_CFG[tx.type] ?? { label: tx.type, emoji: '•', color: 'var(--t2)', bg: 'var(--s2)', sign: 0 }
  const acc   = lkp.accounts.find(a => a.id === tx.accountId)
  const card  = lkp.cards.find(c => c.id === tx.cardId)
  const cat   = lkp.categories.find(c => c.id === tx.category)
  const bq    = lkp.bajoquintos.find(b => b.id === tx.bajoquintoId)

  const subtitle = [
    bq?.client ?? acc?.name ?? card?.bankName ?? card?.alias,
    cat?.name,
  ].filter(Boolean).join(' · ')

  const amtStr = cfg.sign === 0
    ? fmx(tx.amount)
    : `${cfg.sign > 0 ? '+' : '-'}${fmx(tx.amount)}`

  return (
    <button
      onClick={() => onClick(tx)}
      className="btn-press w-full flex items-center gap-3 px-4 py-3.5 text-left"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-lg leading-none"
        style={{ background: cfg.bg }}>
        {cfg.emoji}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold leading-tight truncate" style={{ color: 'var(--t1)' }}>
          {tx.description || cfg.label}
        </p>
        {subtitle && (
          <p className="text-[10px] font-medium mt-0.5 truncate" style={{ color: 'var(--t3)' }}>
            {subtitle}
          </p>
        )}
      </div>

      <div className="text-right shrink-0">
        <p className="text-[13px] font-black" style={{ color: cfg.color }}>{amtStr}</p>
        <p className="text-[9px] mt-0.5" style={{ color: 'var(--t3)' }}>{cfg.label}</p>
      </div>
    </button>
  )
}

// ── Date separator ─────────────────────────────────────────────────────────────
function DateSep({ dateStr, dayTotal }) {
  const isPos = dayTotal >= 0
  return (
    <div className="flex items-center justify-between px-4 py-2"
      style={{ background: 'var(--s2)', borderBottom: '1px solid var(--border)' }}>
      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--t3)' }}>
        {fmtDateLabel(dateStr)}
      </span>
      {dayTotal !== 0 && (
        <span className="text-[10px] font-bold" style={{ color: isPos ? '#059669' : '#E11D48' }}>
          {isPos ? '+' : ''}{fmx(dayTotal)}
        </span>
      )}
    </div>
  )
}

// ── Detail modal ───────────────────────────────────────────────────────────────
function TxDetailModal({ tx, onClose, lkp }) {
  const cfg   = TX_CFG[tx.type] ?? { label: tx.type, emoji: '•', color: 'var(--t2)', bg: 'var(--s2)', sign: 0 }
  const acc   = lkp.accounts.find(a => a.id === tx.accountId)
  const toAcc = lkp.accounts.find(a => a.id === tx.targetAccountId)
  const card  = lkp.cards.find(c => c.id === tx.cardId)
  const cat   = lkp.categories.find(c => c.id === tx.category)
  const bq    = lkp.bajoquintos.find(b => b.id === tx.bajoquintoId)

  const amtStr = cfg.sign === 0
    ? fmx(tx.amount)
    : `${cfg.sign > 0 ? '+' : '-'}${fmx(tx.amount)}`

  const origen = bq
    ? `CRM · ${bq.client}${bq.model ? ' · ' + bq.model : ''}`
    : card
      ? `Tarjeta · ${card.bankName || card.alias || ''}`
      : 'Manual'

  const rows = [
    { lbl: '📅 Fecha',       val: tx.date ? `${fmtDateLabel(tx.date)} (${tx.date})` : '—' },
    { lbl: '🏷️ Tipo',        val: cfg.label },
    acc   ? { lbl: '🏦 Cuenta',     val: [acc.name, acc.institution].filter(Boolean).join(' · ') } : null,
    toAcc ? { lbl: '→ Destino',     val: toAcc.name } : null,
    card  ? { lbl: '💳 Tarjeta',    val: card.bankName || card.alias } : null,
    cat   ? { lbl: '📂 Categoría',  val: cat.name } : null,
    bq    ? { lbl: '🎸 Bajoquinto', val: [bq.client, bq.model].filter(Boolean).join(' · ') } : null,
    tx.note ? { lbl: '📝 Nota',     val: tx.note } : null,
    { lbl: '🔗 Origen',      val: origen },
    tx.labels?.length > 0 ? { lbl: '🏷 Etiquetas', val: tx.labels.join(', ') } : null,
  ].filter(Boolean)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center fade-in">
      <div className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onClick={onClose} />

      <div className="relative w-full max-w-lg slide-up"
        style={{
          background: 'var(--s1)',
          borderRadius: '28px 28px 0 0',
          borderTop: '1px solid var(--border)',
          paddingBottom: 'env(safe-area-inset-bottom, 20px)',
          boxShadow: '0 -8px 40px rgba(0,10,50,0.18)',
          maxHeight: '82vh',
          overflowY: 'auto',
        }}>

        <div className="drag-handle" />

        {/* ── Amount + type header ── */}
        <div className="px-5 pt-2 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                style={{ background: cfg.bg }}>
                {cfg.emoji}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
                  style={{ color: 'var(--t3)' }}>
                  {cfg.label}
                </p>
                <p className="text-2xl font-black leading-tight" style={{ color: cfg.color }}>
                  {amtStr}
                </p>
              </div>
            </div>
            <button onClick={onClose}
              className="btn-press shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1"
              style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
              <X size={15} color="var(--t2)" />
            </button>
          </div>

          {tx.description && (
            <p className="mt-3 text-sm font-bold" style={{ color: 'var(--t1)' }}>
              {tx.description}
            </p>
          )}
        </div>

        {/* ── Detail rows ── */}
        <div className="px-5 py-1">
          {rows.map((row, i) => (
            <div key={i}
              className="flex items-start justify-between gap-4 py-3"
              style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span className="text-[11px] font-semibold shrink-0 mt-0.5" style={{ color: 'var(--t3)' }}>
                {row.lbl}
              </span>
              <span className="text-[12px] font-bold text-right leading-snug flex-1" style={{ color: 'var(--t1)' }}>
                {row.val}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Subscriptions view ─────────────────────────────────────────────────────────
function SubsView({ subscriptions }) {
  const active = subscriptions.filter(s => s.status !== 'cancelled' && s.isActive !== false)
  const total  = active.reduce((s, sub) => s + num(sub.amount), 0)

  if (!active.length) return (
    <div className="px-5 py-16 text-center">
      <p className="text-4xl mb-3">📱</p>
      <p className="text-sm font-semibold" style={{ color: 'var(--t2)' }}>Sin suscripciones activas</p>
    </div>
  )

  return (
    <div className="px-5 space-y-3">
      <div className="rounded-2xl px-4 py-3 flex justify-between items-center"
        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.22)' }}>
        <p className="text-xs font-bold" style={{ color: '#6366F1' }}>
          {active.length} activa{active.length !== 1 ? 's' : ''} · recurrentes
        </p>
        <p className="text-base font-black" style={{ color: '#6366F1' }}>-{fmxC(total)}/mes</p>
      </div>
      <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>
        {active.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3.5"
            style={{ borderBottom: i < active.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0"
              style={{ background: 'rgba(99,102,241,0.09)' }}>
              {s.emoji || '📱'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold" style={{ color: 'var(--t1)' }}>{s.name}</p>
              <p className="text-[10px] font-medium" style={{ color: 'var(--t3)' }}>
                {s.billingCycle === 'yearly' ? 'Anual' : 'Mensual'}
                {s.nextBillingDate ? ` · Próximo ${s.nextBillingDate}` : ''}
                {s.category ? ` · ${s.category}` : ''}
              </p>
            </div>
            <p className="text-sm font-black shrink-0" style={{ color: '#6366F1' }}>
              -{fmx(num(s.amount))}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function LibroMayor({ openModal }) {
  const state = useFinanceStore()
  const { transactions, accounts, cards, categories, bajoquintos, subscriptions } = state

  const [filter,   setFilter]   = useState('todos')
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState(null) // tx for detail modal

  const activeFilt = FILTERS.find(f => f.key === filter)

  // Lookup map passed to sub-components to avoid prop drilling
  const lkp = useMemo(
    () => ({ accounts, cards, categories, bajoquintos }),
    [accounts, cards, categories, bajoquintos]
  )

  // ── Month metrics (always current month, always all tx) ────────────────────
  const mk = getMonthKey()
  const monthMetrics = useMemo(() => {
    const mtxs = transactions.filter(tx => tx.date?.startsWith(mk))
    const inc   = mtxs
      .filter(t => ['ingreso', 'bajoquinto'].includes(t.type))
      .reduce((s, t) => s + num(t.amount), 0)
    const exp   = mtxs
      .filter(t => ['gasto', 'pago_tarjeta', 'inversion'].includes(t.type))
      .reduce((s, t) => s + num(t.amount), 0)
    return { inc, exp, flow: inc - exp }
  }, [transactions, mk])

  // ── Filtered + searched list ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...transactions]
    if (activeFilt?.types) list = list.filter(tx => activeFilt.types.includes(tx.type))
    if (search.trim())     list = list.filter(tx => searchMatches(tx, search.trim(), lkp))
    return list.sort((a, b) => {
      const dc = (b.date || '').localeCompare(a.date || '')
      if (dc !== 0) return dc
      return (b.createdAt || '').localeCompare(a.createdAt || '')
    })
  }, [transactions, activeFilt, search, lkp])

  // ── Group by date with daily net ───────────────────────────────────────────
  const groups = useMemo(() => {
    const map = {}
    filtered.forEach(tx => {
      const key = tx.date || '__sin_fecha__'
      if (!map[key]) map[key] = []
      map[key].push(tx)
    })
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, txs]) => {
        const dayTotal = txs.reduce((s, tx) => {
          const c = TX_CFG[tx.type]
          return s + (c ? c.sign * num(tx.amount) : 0)
        }, 0)
        return { dateStr: key === '__sin_fecha__' ? 'Sin fecha' : key, txs, dayTotal }
      })
  }, [filtered])

  // ── Metric strip data ──────────────────────────────────────────────────────
  const metrics = [
    {
      label: 'Ingresos mes',
      display: (monthMetrics.inc > 0 ? '+' : '') + fmxC(monthMetrics.inc),
      color: '#059669',
    },
    {
      label: 'Gastos mes',
      display: fmxC(monthMetrics.exp),
      color: '#E11D48',
    },
    {
      label: 'Flujo neto',
      display: (monthMetrics.flow >= 0 ? '+' : '') + fmxC(monthMetrics.flow),
      color: monthMetrics.flow >= 0 ? '#059669' : '#E11D48',
    },
    {
      label: 'Movimientos',
      display: String(transactions.length),
      color: 'var(--t1)',
    },
  ]

  return (
    <div className="mb-nav">

      {/* ── Header ── */}
      <div className="px-5 pt-14 pt-safe pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1"
          style={{ color: 'var(--t3)' }}>FINANZAS</p>
        <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--t1)' }}>
          Libro Mayor
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--t3)' }}>
          {activeFilt?.isSubs
            ? 'Suscripciones y pagos recurrentes'
            : `${filtered.length} movimiento${filtered.length !== 1 ? 's' : ''}${search ? ` · "${search}"` : ''}`
          }
        </p>
      </div>

      {/* ── Metrics strip ── */}
      <div className="px-5 mb-4">
        <div className="grid grid-cols-2 gap-2">
          {metrics.map(m => (
            <div key={m.label} className="rounded-2xl px-3.5 py-3"
              style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>
              <p className="text-[9px] font-bold uppercase tracking-wide mb-1.5"
                style={{ color: 'var(--t3)' }}>
                {m.label}
              </p>
              <p className="text-base font-black leading-tight" style={{ color: m.color }}>
                {m.display}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex gap-1.5 px-5 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => { setFilter(f.key); setSearch('') }}
            className="btn-press shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold"
            style={{
              background: filter === f.key ? 'var(--accent)' : 'var(--s1)',
              color:      filter === f.key ? '#fff'          : 'var(--t3)',
              border:     filter === f.key ? '1px solid transparent' : '1px solid var(--border)',
              whiteSpace: 'nowrap',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Search bar ── */}
      {!activeFilt?.isSubs && (
        <div className="px-5 mb-4">
          <div className="flex items-center gap-2 px-3.5 rounded-2xl"
            style={{ background: 'var(--s1)', border: '1px solid var(--border)', height: 44 }}>
            <Search size={15} color="var(--t3)" className="shrink-0" />
            <input
              type="text"
              placeholder="Buscar por cliente, cuenta, monto…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, background: 'transparent', outline: 'none',
                fontSize: 13, color: 'var(--t1)', border: 'none', padding: 0,
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="shrink-0">
                <X size={14} color="var(--t3)" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {activeFilt?.isSubs ? (
        <SubsView subscriptions={subscriptions} />
      ) : (
        <div className="px-5">
          {groups.length === 0 ? (
            <div className="py-16 text-center rounded-3xl"
              style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>
              <p className="text-4xl mb-3">📭</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--t2)' }}>
                {search
                  ? `Sin resultados para "${search}"`
                  : filter !== 'todos'
                    ? `Sin movimientos en ${activeFilt?.label}`
                    : 'Sin movimientos registrados'
                }
              </p>
              {!search && filter === 'todos' && (
                <button onClick={() => openModal('transaction', { type: 'gasto' })}
                  className="mt-4 btn-press px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: 'var(--accent)' }}>
                  Registrar movimiento
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-3xl overflow-hidden"
              style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>
              {groups.map(({ dateStr, txs, dayTotal }) => (
                <div key={dateStr}>
                  <DateSep dateStr={dateStr} dayTotal={dayTotal} />
                  {txs.map(tx => (
                    <TxRow key={tx.id} tx={tx} onClick={setSelected} lkp={lkp} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Detail modal ── */}
      {selected && (
        <TxDetailModal
          tx={selected}
          onClose={() => setSelected(null)}
          lkp={lkp}
        />
      )}

    </div>
  )
}

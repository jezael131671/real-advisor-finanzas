import { useState, useMemo } from 'react'
import {
  Plus, Pencil, Trash2, DollarSign, Phone, MapPin,
  MessageCircle, Calendar, Clock, CheckCircle2, AlertCircle,
  TrendingUp, ChevronDown, ChevronUp, X, History, Receipt,
} from 'lucide-react'
import useFinanceStore from '../store/useFinanceStore.js'
import { fmx, fmtDate, today } from '../lib/formatters.js'
import {
  BAJOQUINTO_STATUSES, PROSPECT_STATUSES, ORDER_STATUSES, CLOSED_STATUSES,
} from '../store/defaultData.js'
import WhatsAppModal from './modals/WhatsAppModal.jsx'
import toast from 'react-hot-toast'

// ── Helpers ───────────────────────────────────────────────────────────────────
const statusOf = (key) => BAJOQUINTO_STATUSES.find(s => s.key === key) ?? BAJOQUINTO_STATUSES[0]

function daysSinceContact(bq) {
  const ref = bq.lastContact
    ? new Date(bq.lastContact + 'T00:00:00')
    : bq.createdAt ? new Date(bq.createdAt) : new Date()
  return Math.max(0, Math.floor((new Date() - ref) / 86_400_000))
}

function needsFollowUp(bq) {
  if (!PROSPECT_STATUSES.includes(bq.status)) return false
  const now = new Date()
  if (bq.nextFollowUp) {
    const nextD = new Date(bq.nextFollowUp + 'T00:00:00')
    if (nextD <= now) return true
  }
  return daysSinceContact(bq) >= 3
}

function pendingAmt(bq) {
  const paid = Number(bq.deposit || 0) +
    (bq.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
  return Math.max(0, Number(bq.salePrice || 0) - paid)
}

function collectedAmt(bq) {
  return Number(bq.deposit || 0) +
    (bq.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
}

function followUpUrgency(bq) {
  const d = daysSinceContact(bq)
  if (d >= 7) return 'critico'
  if (d >= 3) return 'importante'
  return 'normal'
}

// ── Urgency palette ───────────────────────────────────────────────────────────
const URG = {
  critico:    { dot: '#E11D48', text: 'text-rose-600',  bg: 'rgba(225,29,72,0.06)',  border: 'rgba(225,29,72,0.18)',  label: 'Crítico'   },
  importante: { dot: '#D97706', text: 'text-amber-600', bg: 'rgba(217,119,6,0.05)', border: 'rgba(217,119,6,0.18)',  label: 'Urgente'   },
  normal:     { dot: '#6366F1', text: 'text-indigo-600',bg: 'var(--s1)',             border: 'var(--border)',          label: 'Normal'    },
}

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'dashboard',    label: 'Dashboard',   emoji: '📊' },
  { key: 'pedidos',      label: 'Pedidos',     emoji: '📦' },
  { key: 'seguimientos', label: 'Seguimiento', emoji: '💬' },
  { key: 'cobros',       label: 'Cobros',      emoji: '💰' },
]

// ── KPI mini-card ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, color, bg, sub }) {
  return (
    <div className="rounded-2xl p-3"
      style={{ background: bg || 'var(--s1)', border: '1px solid var(--border)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--t3)' }}>
        {label}
      </p>
      <p className={`text-base font-black leading-tight ${color || ''}`} style={{ color: color ? undefined : 'var(--t1)' }}>
        {value}
      </p>
      {sub && <p className="text-[10px] mt-0.5 font-medium" style={{ color: 'var(--t3)' }}>{sub}</p>}
    </div>
  )
}

// ── Pipeline strip ────────────────────────────────────────────────────────────
function PipelineStrip({ bajoquintos }) {
  const dist = useMemo(() => {
    const d = {}
    bajoquintos.forEach(bq => { d[bq.status] = (d[bq.status] || 0) + 1 })
    return d
  }, [bajoquintos])
  const ordered = BAJOQUINTO_STATUSES.filter(s => dist[s.key])
  if (!ordered.length) return null
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {ordered.map(s => (
        <div key={s.key}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${s.bg} ${s.color} border ${s.border}`}>
          <span>{s.label}</span>
          <span className="w-4 h-4 rounded-full bg-white/60 flex items-center justify-center text-[10px] font-black">
            {dist[s.key]}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── ClientHistorySheet ────────────────────────────────────────────────────────
function ClientHistorySheet({ bq, transactions, onClose, openModal, setWhatsappBq }) {
  const st      = statusOf(bq.status)
  const paid    = collectedAmt(bq)
  const pending = pendingAmt(bq)
  const total   = Number(bq.salePrice || 0)
  const pct     = total > 0 ? Math.min(100, (paid / total) * 100) : 0
  const profit  = Number(bq.profit || 0)
  const margin  = total > 0 ? (profit / total) * 100 : 0

  // Payment timeline: deposit + abonos sorted by date
  const timeline = useMemo(() => {
    const entries = []
    if (Number(bq.deposit || 0) > 0) {
      entries.push({
        id: 'dep', type: 'deposit', date: bq.createdAt?.split('T')[0] || '',
        amount: Number(bq.deposit), note: 'Anticipo inicial',
      })
    }
    ;(bq.payments || []).forEach(p => entries.push({ ...p, type: 'payment' }))
    entries.sort((a, b) => (a.date < b.date ? -1 : 1))
    // compute running balance
    let running = 0
    return entries.map(e => { running += e.amount; return { ...e, running } })
  }, [bq])

  // Related transactions from main ledger
  const relatedTx = useMemo(() =>
    transactions
      .filter(t => t.bajoquintoId === bq.id ||
        (t.type === 'bajoquinto' && t.description?.toLowerCase().includes(bq.client?.toLowerCase())))
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [transactions, bq]
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-t-3xl slide-up"
        style={{ background: '#0E0E1A', borderTop: '1px solid rgba(255,255,255,0.05)', maxHeight: '90vh', paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}>
        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mt-3 mb-1" />

        {/* Header */}
        <div className="px-5 pt-3 pb-3 flex justify-between items-start" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.color} ${st.border} border`}>
                {st.label}
              </span>
            </div>
            <h2 className="text-white text-lg font-bold truncate leading-tight">{bq.client}</h2>
            <p className="text-sm mt-0.5" style={{ color: '#8B8BAD' }}>{bq.model || '—'}</p>
          </div>
          <button onClick={onClose}
            className="btn-press w-8 h-8 rounded-full flex items-center justify-center shrink-0 ml-3 mt-1"
            style={{ background: '#151525' }}>
            <X size={16} style={{ color: '#8B8BAD' }} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-4 space-y-4 pt-4">

          {/* Financial summary 2×2 */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Precio venta', value: fmx(bq.salePrice), color: 'text-white', style: { color: '#FFFFFF' } },
              { label: 'Costo',        value: fmx(bq.cost),      color: 'text-slate-300' },
              { label: 'Utilidad',     value: fmx(profit),       color: profit >= 0 ? 'text-emerald-400' : 'text-rose-400' },
              { label: 'Margen',       value: `${margin.toFixed(1)}%`, color: margin >= 30 ? 'text-emerald-400' : 'text-amber-400' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#6B6B8D' }}>
                  {s.label}
                </p>
                <p className={`text-base font-black ${s.color}`} style={s.style}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Cobro progress */}
          <div className="rounded-2xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#6B6B8D' }}>Cobrado</p>
                <p className="text-xl font-black text-emerald-400">{fmx(paid)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#6B6B8D' }}>Pendiente</p>
                <p className={`text-xl font-black ${pending > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {pending > 0 ? fmx(pending) : '✓ Liquidado'}
                </p>
              </div>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 7, background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: pct >= 100 ? '#059669' : 'linear-gradient(90deg,#10B981,#34D399)' }} />
            </div>
            <div className="flex justify-between mt-1.5">
              <p className="text-[10px] text-emerald-500 font-semibold">{pct.toFixed(0)}% cobrado</p>
              <p className="text-[10px] font-medium" style={{ color: '#6B6B8D' }}>Total: {fmx(total)}</p>
            </div>
          </div>

          {/* ── Historial de cobros ── */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Receipt size={13} color="#8B8BAD" />
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#8B8BAD' }}>
                Historial de cobros
              </p>
            </div>

            {timeline.length === 0 ? (
              <div className="rounded-xl px-3 py-4 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs" style={{ color: '#6B6B8D' }}>Sin cobros registrados</p>
              </div>
            ) : (
              <div className="relative">
                {/* timeline line */}
                <div className="absolute left-[17px] top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div className="space-y-2">
                  {timeline.map(e => (
                    <div key={e.id} className="flex items-start gap-3">
                      {/* dot */}
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm z-10"
                        style={{ background: e.type === 'deposit' ? 'rgba(99,102,241,0.22)' : 'rgba(5,150,105,0.22)',
                                 border: `1px solid ${e.type === 'deposit' ? 'rgba(99,102,241,0.3)' : 'rgba(5,150,105,0.3)'}` }}>
                        {e.type === 'deposit' ? '📌' : '💰'}
                      </div>
                      {/* content */}
                      <div className="flex-1 rounded-xl px-3 py-2.5"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white">
                              {e.note || (e.type === 'deposit' ? 'Anticipo' : 'Abono')}
                            </p>
                            <p className="text-[10px] mt-0.5" style={{ color: '#6B6B8D' }}>
                              {e.date ? fmtDate(e.date) : '—'}
                            </p>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className="text-sm font-black text-emerald-400">+{fmx(e.amount)}</p>
                            <p className="text-[10px]" style={{ color: '#6B6B8D' }}>
                              acum. {fmx(e.running)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Movimientos financieros relacionados ── */}
          {relatedTx.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <History size={13} color="#8B8BAD" />
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#8B8BAD' }}>
                  Movimientos en libro mayor
                </p>
              </div>
              <div className="space-y-2">
                {relatedTx.map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span className="text-base shrink-0">🎸</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{tx.description}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#6B6B8D' }}>
                        {tx.date}{tx.accountId ? ' · Cuenta registrada' : ''}
                      </p>
                    </div>
                    <p className="text-sm font-black text-emerald-400 shrink-0">+{fmx(tx.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact quick-links */}
          {(bq.whatsapp || bq.instagram) && (
            <div className="flex gap-2">
              {bq.whatsapp && (
                <div className="flex-1 rounded-xl px-3 py-2"
                  style={{ background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.18)' }}>
                  <p className="text-[10px] font-bold" style={{ color: '#25D366' }}>💬 WhatsApp</p>
                  <p className="text-xs font-semibold text-white mt-0.5">{bq.whatsapp}</p>
                </div>
              )}
              {bq.instagram && (
                <div className="flex-1 rounded-xl px-3 py-2"
                  style={{ background: 'rgba(225,48,108,0.08)', border: '1px solid rgba(225,48,108,0.18)' }}>
                  <p className="text-[10px] font-bold" style={{ color: '#E1306C' }}>📸 Instagram</p>
                  <p className="text-xs font-semibold text-white mt-0.5">{bq.instagram}</p>
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          {pending > 0 && (
            <button
              onClick={() => { onClose(); setTimeout(() => openModal('bajoquinto', { ...bq, _recordPayment: true }), 200) }}
              className="btn-press w-full text-white font-bold py-4 rounded-2xl text-base"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#4F46E5)' }}>
              💰 Registrar abono — {fmx(pending)} pendiente
            </button>
          )}

          {pending === 0 && paid > 0 && (
            <div className="rounded-2xl px-4 py-3 text-center"
              style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)' }}>
              <p className="text-emerald-400 font-bold text-sm">✅ Totalmente liquidado</p>
              <p className="text-[11px] mt-0.5" style={{ color: '#6B6B8D' }}>
                {fmx(paid)} cobrado de {fmx(total)}
              </p>
            </div>
          )}

          {/* ── WhatsApp ── */}
          <button
            onClick={() => { onClose(); setTimeout(() => setWhatsappBq(bq), 200) }}
            className="btn-press w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold"
            style={{ background: 'rgba(37,211,102,0.10)', color: '#25D366', border: '1px solid rgba(37,211,102,0.22)' }}>
            <MessageCircle size={16} />
            Enviar WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard CRM tab ─────────────────────────────────────────────────────────
function TabDashboard({ bajoquintos, openModal, setHistoryBq }) {
  const todayStr = today()

  const prospectos     = bajoquintos.filter(b => PROSPECT_STATUSES.includes(b.status))
  const pedidosActivos = bajoquintos.filter(b => ORDER_STATUSES.includes(b.status))
  const seguimientosHoy = prospectos.filter(b => {
    if (b.nextFollowUp && b.nextFollowUp <= todayStr) return true
    return daysSinceContact(b) >= 3
  })
  const cotizaciones  = bajoquintos.filter(b => b.status === 'cotizado')
  const apartados     = bajoquintos.filter(b => b.status === 'apartado')
  const fabricando    = bajoquintos.filter(b => b.status === 'en_fabricacion')
  const cobros        = bajoquintos.filter(b => !CLOSED_STATUSES.includes(b.status) && pendingAmt(b) > 0)
  const totalPending  = cobros.reduce((s, b) => s + pendingAmt(b), 0)
  const totalCollected = bajoquintos.reduce((s, b) => s + collectedAmt(b), 0)
  const utilPotencial = prospectos.reduce((s, b) => s + Number(b.profit || 0), 0)

  const urgentes = prospectos
    .filter(needsFollowUp)
    .sort((a, b) => daysSinceContact(b) - daysSinceContact(a))
    .slice(0, 5)

  return (
    <div className="space-y-4">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <KpiCard label="Prospectos activos" value={prospectos.length}      color="text-indigo-600" />
        <KpiCard label="Seguimientos hoy"   value={seguimientosHoy.length} color={seguimientosHoy.length > 0 ? 'text-rose-600' : 'text-emerald-600'} />
        <KpiCard label="Cotizaciones"        value={cotizaciones.length}    color="text-purple-600" />
        <KpiCard label="Cobros pendientes"   value={cobros.length}
          color="text-amber-600" sub={totalPending > 0 ? fmx(totalPending) : undefined} />
        <KpiCard label="Apartados"   value={apartados.length}  color="text-amber-700"  />
        <KpiCard label="Fabricando"  value={fabricando.length} color="text-orange-600" />
      </div>

      {/* Collected vs pending summary */}
      {(totalCollected > 0 || totalPending > 0) && (
        <div className="rounded-2xl px-4 py-3"
          style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--t3)' }}>
            Flujo Los Primos
          </p>
          <div className="flex gap-4">
            <div>
              <p className="text-[10px]" style={{ color: 'var(--t3)' }}>Cobrado</p>
              <p className="text-base font-black text-emerald-600">{fmx(totalCollected)}</p>
            </div>
            <div>
              <p className="text-[10px]" style={{ color: 'var(--t3)' }}>Por cobrar</p>
              <p className="text-base font-black text-amber-600">{fmx(totalPending)}</p>
            </div>
            {utilPotencial > 0 && (
              <div>
                <p className="text-[10px]" style={{ color: 'var(--t3)' }}>Util. potencial</p>
                <p className="text-base font-black text-violet-600">{fmx(utilPotencial)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pipeline */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--t3)' }}>Pipeline</p>
        <PipelineStrip bajoquintos={bajoquintos} />
      </div>

      {/* Seguimientos urgentes */}
      {urgentes.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={14} color="#E11D48" />
            <p className="text-sm font-bold" style={{ color: 'var(--t1)' }}>Seguimientos urgentes</p>
          </div>
          <div className="space-y-2">
            {urgentes.map(bq => {
              const urg = followUpUrgency(bq)
              const u   = URG[urg]
              const d   = daysSinceContact(bq)
              return (
                <div key={bq.id} className="rounded-2xl px-3.5 py-3 flex items-center gap-3"
                  style={{ background: u.bg, border: `1px solid ${u.border}` }}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: u.dot }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold leading-tight truncate" style={{ color: 'var(--t1)' }}>{bq.client}</p>
                    <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--t3)' }}>
                      {bq.model || '—'} · {d}d sin contacto
                    </p>
                    {bq.followUpNote && (
                      <p className="text-[10px] mt-0.5 italic" style={{ color: 'var(--t3)' }}>"{bq.followUpNote}"</p>
                    )}
                  </div>
                  <button onClick={() => openModal('bajoquinto', bq)}
                    className="btn-press shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold"
                    style={{ background: 'rgba(255,255,255,0.08)', color: u.dot }}>
                    Ver
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {bajoquintos.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-4xl mb-4">🎸</p>
          <p className="font-semibold mb-1" style={{ color: 'var(--t1)' }}>Sin clientes aún</p>
          <p className="text-sm mb-6" style={{ color: 'var(--t3)' }}>Agrega tu primer prospecto o pedido</p>
          <button onClick={() => openModal('bajoquinto', null)}
            className="btn-primary" style={{ maxWidth: 200, margin: '0 auto' }}>
            Nuevo cliente
          </button>
        </div>
      )}
    </div>
  )
}

// ── Pedidos tab ───────────────────────────────────────────────────────────────
function TabPedidos({ bajoquintos, openModal, deleteBajoquinto, setHistoryBq, setWhatsappBq }) {
  const [filter,     setFilter]     = useState('all')
  const [confirmDel, setConfirmDel] = useState(null)
  const [expanded,   setExpanded]   = useState(null)

  const FILTERS = [
    { key: 'all', label: 'Todos' },
    ...BAJOQUINTO_STATUSES.filter(s => !['prospecto'].includes(s.key)),
  ]

  const filtered = useMemo(() =>
    filter === 'all' ? bajoquintos : bajoquintos.filter(b => b.status === filter),
    [bajoquintos, filter]
  )

  const handleDelete = (id) => {
    deleteBajoquinto(id)
    setConfirmDel(null)
    toast.success('Registro eliminado')
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className="btn-press shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={filter === f.key
              ? { background: 'var(--accent)', color: '#fff' }
              : { background: 'var(--s1)', color: 'var(--t2)', border: '1px solid var(--border)' }}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-3xl mb-3">📦</p>
          <p className="font-semibold" style={{ color: 'var(--t2)' }}>
            {bajoquintos.length === 0 ? 'Sin registros aún' : 'Sin registros en este estado'}
          </p>
        </div>
      ) : (
        filtered.map(bq => {
          const st         = statusOf(bq.status)
          const paid       = collectedAmt(bq)
          const pending    = pendingAmt(bq)
          const pct        = Number(bq.salePrice) > 0 ? (paid / Number(bq.salePrice)) * 100 : 0
          const isExp      = expanded === bq.id
          const isProspect = PROSPECT_STATUSES.includes(bq.status)
          const dSince     = daysSinceContact(bq)
          const followAlert = needsFollowUp(bq)

          return (
            <div key={bq.id} className="card fade-up">
              {/* Main info */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.color} ${st.border} border`}>
                      {st.label}
                    </span>
                    {followAlert && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full text-rose-600 bg-rose-50 border border-rose-200">
                        ⚠️ Seguimiento
                      </span>
                    )}
                    {bq.dueDate && (
                      <span className="text-xs" style={{ color: 'var(--t3)' }}>📅 {fmtDate(bq.dueDate, 'd MMM')}</span>
                    )}
                  </div>
                  <p className="font-bold truncate" style={{ color: 'var(--t1)' }}>{bq.client}</p>
                  <p className="text-sm" style={{ color: 'var(--t2)' }}>{bq.model || '—'}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {bq.phone && (
                      <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--t3)' }}>
                        <Phone size={9} /> {bq.phone}
                      </span>
                    )}
                    {bq.city && (
                      <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'var(--t3)' }}>
                        <MapPin size={9} /> {bq.city}
                      </span>
                    )}
                    {isProspect && dSince > 0 && (
                      <span className="text-[10px]"
                        style={{ color: dSince >= 7 ? '#E11D48' : dSince >= 3 ? '#D97706' : 'var(--t3)' }}>
                        {dSince}d sin contacto
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-black text-lg" style={{ color: 'var(--t1)' }}>{fmx(bq.salePrice)}</p>
                  {Number(bq.profit) > 0 && (
                    <p className="text-xs text-emerald-600 font-semibold">+{fmx(bq.profit)}</p>
                  )}
                  {bq.budget && Number(bq.budget) > 0 && isProspect && (
                    <p className="text-[10px] text-purple-500 font-semibold">Ppto: {fmx(bq.budget)}</p>
                  )}
                </div>
              </div>

              {/* Payment progress */}
              {Number(bq.salePrice) > 0 && !isProspect && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: 'var(--t3)' }}>Cobrado: <span className="font-semibold text-emerald-600">{fmx(paid)}</span></span>
                    {pending > 0 && <span className="text-amber-600 font-semibold">Pendiente: {fmx(pending)}</span>}
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'var(--s3)' }}>
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              )}

              {/* CRM follow-up info */}
              {isProspect && (bq.nextFollowUp || bq.followUpNote) && (
                <div className="mb-3 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)' }}>
                  {bq.nextFollowUp && (
                    <p className="text-[11px] flex items-center gap-1.5 text-indigo-600 font-semibold">
                      <Calendar size={10} /> Próximo: {fmtDate(bq.nextFollowUp)}
                    </p>
                  )}
                  {bq.followUpNote && (
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--t3)' }}>💬 {bq.followUpNote}</p>
                  )}
                </div>
              )}

              {/* Expanded details */}
              {isExp && (
                <div className="mb-3 pt-2 space-y-1.5 fade-up" style={{ borderTop: '1px solid var(--border)' }}>
                  {bq.leadSource && (
                    <p className="text-xs" style={{ color: 'var(--t3)' }}>
                      📣 Origen: <span style={{ color: 'var(--t2)' }}>{bq.leadSource}</span>
                    </p>
                  )}
                  {bq.lastContact && (
                    <p className="text-xs" style={{ color: 'var(--t3)' }}>
                      📞 Último contacto: <span style={{ color: 'var(--t2)' }}>{fmtDate(bq.lastContact)}</span>
                    </p>
                  )}
                  {bq.paymentCommitDate && (
                    <p className="text-xs" style={{ color: 'var(--t3)' }}>
                      📋 Compromiso pago: <span style={{ color: 'var(--t2)' }}>{fmtDate(bq.paymentCommitDate)}</span>
                    </p>
                  )}
                  {bq.provider && (
                    <p className="text-xs" style={{ color: 'var(--t3)' }}>
                      🔧 Proveedor: <span style={{ color: 'var(--t2)' }}>{bq.provider}</span>
                    </p>
                  )}
                  {bq.estimatedDelivery && (
                    <p className="text-xs" style={{ color: 'var(--t3)' }}>
                      📦 Entrega estimada: <span style={{ color: 'var(--t2)' }}>{fmtDate(bq.estimatedDelivery)}</span>
                    </p>
                  )}
                  {bq.trackingNumber && (
                    <p className="text-xs" style={{ color: 'var(--t3)' }}>
                      🚚 Tracking: <span style={{ color: 'var(--t2)' }}>{bq.trackingNumber}</span>
                    </p>
                  )}
                  {bq.whatsapp && (
                    <p className="text-xs" style={{ color: 'var(--t3)' }}>
                      💬 WhatsApp: <span style={{ color: 'var(--t2)' }}>{bq.whatsapp}</span>
                    </p>
                  )}
                  {bq.instagram && (
                    <p className="text-xs" style={{ color: 'var(--t3)' }}>
                      📸 Instagram: <span style={{ color: 'var(--t2)' }}>{bq.instagram}</span>
                    </p>
                  )}
                  {bq.notes && (
                    <p className="text-xs" style={{ color: 'var(--t3)' }}>📝 {bq.notes}</p>
                  )}
                  {/* Payment history inline */}
                  {(Number(bq.deposit || 0) > 0 || (bq.payments || []).length > 0) && (
                    <button onClick={() => setHistoryBq(bq)}
                      className="btn-press w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: 'rgba(99,102,241,0.08)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.18)' }}>
                      <Receipt size={12} /> Ver historial completo de cobros
                    </button>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button onClick={() => setExpanded(isExp ? null : bq.id)}
                  className="btn-press w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
                  {isExp ? <ChevronUp size={13} color="var(--t2)" /> : <ChevronDown size={13} color="var(--t2)" />}
                </button>
                {(bq.whatsapp || bq.phone) && (
                  <button onClick={() => setWhatsappBq(bq)}
                    className="btn-press w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(37,211,102,0.10)', border: '1px solid rgba(37,211,102,0.22)' }}
                    title="Enviar WhatsApp">
                    <MessageCircle size={13} style={{ color: '#25D366' }} />
                  </button>
                )}
                <button onClick={() => openModal('bajoquinto', bq)}
                  className="btn-press flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold"
                  style={{ background: 'var(--s2)', color: 'var(--t1)', border: '1px solid var(--border)' }}>
                  <Pencil size={13} /> Editar
                </button>
                {!isProspect && pending > 0 && (
                  <button onClick={() => openModal('bajoquinto', { ...bq, _recordPayment: true })}
                    className="btn-press flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
                    <DollarSign size={13} /> Abono
                  </button>
                )}
                <button onClick={() => setConfirmDel(bq.id)}
                  className="btn-press w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(225,29,72,0.08)' }}>
                  <Trash2 size={13} color="#E11D48" />
                </button>
              </div>

              {confirmDel === bq.id && (
                <div className="mt-3 p-3 rounded-xl fade-in"
                  style={{ background: 'rgba(225,29,72,0.06)', border: '1px solid rgba(225,29,72,0.15)' }}>
                  <p className="text-xs font-semibold text-center mb-2" style={{ color: 'var(--t1)' }}>
                    ¿Eliminar registro de {bq.client}?
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDel(null)} className="btn-ghost flex-1 py-1.5 text-xs">Cancelar</button>
                    <button onClick={() => handleDelete(bq.id)}
                      className="btn-press flex-1 py-1.5 rounded-xl text-xs font-bold"
                      style={{ background: '#E11D48', color: '#fff' }}>
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Seguimientos tab ──────────────────────────────────────────────────────────
function TabSeguimientos({ bajoquintos, openModal, updateBajoquinto, setWhatsappBq }) {
  const needsFollow = useMemo(() =>
    bajoquintos.filter(needsFollowUp).sort((a, b) => daysSinceContact(b) - daysSinceContact(a)),
    [bajoquintos]
  )

  const handleMarkContacted = (bq) => {
    updateBajoquinto(bq.id, { lastContact: today() })
    toast.success(`${bq.client} marcado como contactado hoy`)
  }

  if (needsFollow.length === 0) {
    return (
      <div className="card text-center py-14">
        <CheckCircle2 size={40} color="#059669" className="mx-auto mb-4 opacity-60" />
        <p className="font-semibold" style={{ color: 'var(--t1)' }}>¡Al día!</p>
        <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>Sin seguimientos pendientes</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-0.5">
        <AlertCircle size={14} color="#E11D48" />
        <p className="text-sm font-bold" style={{ color: 'var(--t1)' }}>
          {needsFollow.length} {needsFollow.length === 1 ? 'prospecto requiere' : 'prospectos requieren'} seguimiento
        </p>
      </div>

      {needsFollow.map(bq => {
        const urg = followUpUrgency(bq)
        const u   = URG[urg]
        const d   = daysSinceContact(bq)
        const st  = statusOf(bq.status)
        const hasOverdue = bq.nextFollowUp && bq.nextFollowUp <= today()

        return (
          <div key={bq.id} className="card">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.color} ${st.border} border`}>
                    {st.label}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: u.bg, border: `1px solid ${u.border}`, color: u.dot }}>
                    {d}d sin contacto
                  </span>
                </div>
                <p className="font-bold truncate" style={{ color: 'var(--t1)' }}>{bq.client}</p>
                {bq.model && <p className="text-xs" style={{ color: 'var(--t2)' }}>{bq.model}</p>}
              </div>
              {Number(bq.salePrice) > 0 && (
                <p className="text-base font-black shrink-0 ml-3" style={{ color: 'var(--t1)' }}>{fmx(bq.salePrice)}</p>
              )}
            </div>

            {(bq.whatsapp || bq.instagram) && (
              <div className="flex gap-2 flex-wrap mb-2">
                {bq.whatsapp && <span className="text-[11px] font-medium" style={{ color: 'var(--t3)' }}>💬 {bq.whatsapp}</span>}
                {bq.instagram && <span className="text-[11px] font-medium" style={{ color: 'var(--t3)' }}>📸 {bq.instagram}</span>}
              </div>
            )}

            <div className="rounded-xl px-3 py-2 mb-3 space-y-1"
              style={{ background: u.bg, border: `1px solid ${u.border}` }}>
              {bq.lastContact && (
                <p className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--t3)' }}>
                  <Clock size={10} />
                  Último contacto: <span className="font-semibold" style={{ color: 'var(--t2)' }}>{fmtDate(bq.lastContact)}</span>
                </p>
              )}
              {bq.nextFollowUp && (
                <p className="text-[11px] flex items-center gap-1.5 font-semibold"
                  style={{ color: hasOverdue ? '#E11D48' : 'var(--t3)' }}>
                  <Calendar size={10} />
                  {hasOverdue ? '⚠️ Vencido: ' : 'Programado: '}
                  {fmtDate(bq.nextFollowUp)}
                </p>
              )}
              {bq.followUpNote && (
                <p className="text-[11px] italic" style={{ color: 'var(--t3)' }}>💬 "{bq.followUpNote}"</p>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setWhatsappBq(bq)}
                className="btn-press w-10 shrink-0 flex items-center justify-center rounded-xl"
                style={{ background: 'rgba(37,211,102,0.10)', border: '1px solid rgba(37,211,102,0.22)', color: '#25D366' }}
                title="Enviar WhatsApp">
                <MessageCircle size={15} />
              </button>
              <button onClick={() => handleMarkContacted(bq)}
                className="btn-press flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold"
                style={{ background: 'rgba(5,150,105,0.10)', color: '#059669' }}>
                <CheckCircle2 size={13} /> Contactado hoy
              </button>
              <button onClick={() => openModal('bajoquinto', bq)}
                className="btn-press flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold"
                style={{ background: 'var(--s2)', color: 'var(--t1)', border: '1px solid var(--border)' }}>
                <Pencil size={13} /> Editar
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Cobros tab ────────────────────────────────────────────────────────────────
function TabCobros({ bajoquintos, openModal, setHistoryBq, setWhatsappBq }) {
  const todayStr = today()

  const withPending = useMemo(() =>
    bajoquintos
      .filter(b => !CLOSED_STATUSES.includes(b.status) && pendingAmt(b) > 0)
      .map(b => ({ ...b, _pending: pendingAmt(b), _collected: collectedAmt(b) }))
      .sort((a, b) => b._pending - a._pending),
    [bajoquintos]
  )

  const totalPending   = withPending.reduce((s, b) => s + b._pending, 0)
  const totalCollected = withPending.reduce((s, b) => s + b._collected, 0)

  if (withPending.length === 0) {
    return (
      <div className="card text-center py-14">
        <CheckCircle2 size={40} color="#059669" className="mx-auto mb-4 opacity-60" />
        <p className="font-semibold" style={{ color: 'var(--t1)' }}>¡Sin cobros pendientes!</p>
        <p className="text-sm mt-1" style={{ color: 'var(--t3)' }}>Todos los pedidos están al corriente</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Total header */}
      <div className="rounded-2xl px-4 py-3"
        style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.18)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--t3)' }}>Total por cobrar</p>
            <p className="text-xl font-black text-amber-600 leading-tight">{fmx(totalPending)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--t3)' }}>Ya cobrado</p>
            <p className="text-xl font-black text-emerald-600 leading-tight">{fmx(totalCollected)}</p>
          </div>
        </div>
        <p className="text-[11px] mt-1.5 font-medium" style={{ color: 'var(--t3)' }}>
          {withPending.length} {withPending.length === 1 ? 'cliente' : 'clientes'} con saldo pendiente
        </p>
      </div>

      {withPending.map(bq => {
        const st  = statusOf(bq.status)
        const pct = Number(bq.salePrice) > 0 ? (bq._collected / Number(bq.salePrice)) * 100 : 0
        const isOverdue = bq.paymentCommitDate && bq.paymentCommitDate < todayStr

        return (
          <div key={bq.id} className="card">
            {/* Client header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.color} ${st.border} border`}>
                    {st.label}
                  </span>
                </div>
                <p className="font-bold truncate" style={{ color: 'var(--t1)' }}>{bq.client}</p>
                {bq.model && <p className="text-xs" style={{ color: 'var(--t2)' }}>{bq.model}</p>}
                {bq.whatsapp && (
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--t3)' }}>💬 {bq.whatsapp}</p>
                )}
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-lg font-black text-amber-600 leading-tight">{fmx(bq._pending)}</p>
                <p className="text-[10px] font-medium" style={{ color: 'var(--t3)' }}>pendiente</p>
              </div>
            </div>

            {/* Progress */}
            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: 'var(--t3)' }}>
                  Cobrado: <span className="font-semibold text-emerald-600">{fmx(bq._collected)}</span>
                </span>
                <span style={{ color: 'var(--t3)' }}>
                  Total: <span className="font-semibold" style={{ color: 'var(--t1)' }}>{fmx(bq.salePrice)}</span>
                </span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'var(--s3)' }}>
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </div>

            {/* Payment commitment */}
            {bq.paymentCommitDate && (
              <div className="mb-3 px-3 py-2 rounded-xl"
                style={{
                  background: isOverdue ? 'rgba(225,29,72,0.06)' : 'rgba(99,102,241,0.05)',
                  border: `1px solid ${isOverdue ? 'rgba(225,29,72,0.18)' : 'rgba(99,102,241,0.12)'}`,
                }}>
                <p className="text-[11px] flex items-center gap-1.5 font-semibold"
                  style={{ color: isOverdue ? '#E11D48' : '#6366F1' }}>
                  <Calendar size={10} />
                  {isOverdue ? '⚠️ Compromiso vencido: ' : 'Compromiso: '}
                  {fmtDate(bq.paymentCommitDate)}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={() => setHistoryBq(bq)}
                className="btn-press flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold px-3 shrink-0"
                style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--border)' }}>
                <Receipt size={13} /> Historial
              </button>
              <button onClick={() => setWhatsappBq(bq)}
                className="btn-press w-10 h-10 flex items-center justify-center rounded-xl shrink-0"
                style={{ background: 'rgba(37,211,102,0.10)', border: '1px solid rgba(37,211,102,0.22)' }}
                title="Enviar WhatsApp de cobro">
                <MessageCircle size={15} style={{ color: '#25D366' }} />
              </button>
              <button onClick={() => openModal('bajoquinto', { ...bq, _recordPayment: true })}
                className="btn-press flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                <DollarSign size={14} /> Registrar abono
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Bajoquintos({ openModal }) {
  const { bajoquintos, transactions, deleteBajoquinto, updateBajoquinto } = useFinanceStore()
  const [activeTab,    setActiveTab]    = useState('dashboard')
  const [historyBq,    setHistoryBq]    = useState(null)
  const [whatsappBq,   setWhatsappBq]   = useState(null)

  // Quick stats for header
  const stats = useMemo(() => bajoquintos.reduce((acc, bq) => {
    const pending = pendingAmt(bq)
    const isActive = !CLOSED_STATUSES.includes(bq.status)
    return {
      totalSales:   acc.totalSales   + Number(bq.salePrice || 0),
      totalProfit:  acc.totalProfit  + Number(bq.profit    || 0),
      totalPending: acc.totalPending + pending,
      active:       acc.active       + (isActive ? 1 : 0),
    }
  }, { totalSales: 0, totalProfit: 0, totalPending: 0, active: 0 }), [bajoquintos])

  // Badge counts
  const segCount = useMemo(() => bajoquintos.filter(needsFollowUp).length, [bajoquintos])
  const cobCount = useMemo(() =>
    bajoquintos.filter(b => !CLOSED_STATUSES.includes(b.status) && pendingAmt(b) > 0).length,
    [bajoquintos]
  )

  return (
    <div className="mb-nav">
      {/* ── Header ── */}
      <div className="px-5 pt-14 pt-safe flex justify-between items-center mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--t3)' }}>Los Primos</p>
          <h1 className="text-2xl font-black" style={{ color: 'var(--t1)' }}>Bajoquintos</h1>
        </div>
        <button onClick={() => openModal('bajoquinto', null)}
          className="btn-press flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          <Plus size={15} strokeWidth={2.5} /> Nuevo
        </button>
      </div>

      {/* ── Quick stats ── */}
      <div className="px-5 mb-4 grid grid-cols-2 gap-2.5">
        {[
          { label: 'Ventas',    value: fmx(stats.totalSales),   color: 'text-indigo-600'  },
          { label: 'Utilidad',  value: fmx(stats.totalProfit),  color: 'text-emerald-600' },
          { label: 'Por cobrar',value: fmx(stats.totalPending), color: 'text-amber-600'   },
          { label: 'Activos',   value: `${stats.active}`,       color: 'text-violet-600'  },
        ].map(s => (
          <div key={s.label} className="card">
            <p className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--t3)' }}>{s.label}</p>
            <p className={`text-base font-black leading-tight ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Tab bar ── */}
      <div className="px-5 mb-4">
        <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl"
          style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key
            const badge = tab.key === 'seguimientos' ? segCount : tab.key === 'cobros' ? cobCount : 0
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className="btn-press relative rounded-xl py-2 flex flex-col items-center gap-0.5"
                style={isActive ? { background: 'var(--card)', boxShadow: '0 1px 4px rgba(0,10,60,0.08)' } : {}}>
                <span className="text-base leading-none">{tab.emoji}</span>
                <span className="text-[10px] font-semibold" style={{ color: isActive ? 'var(--accent)' : 'var(--t3)' }}>
                  {tab.label}
                </span>
                {badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-white text-[8px] font-bold flex items-center justify-center"
                    style={{ background: '#E11D48' }}>
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="px-5">
        {activeTab === 'dashboard' && (
          <TabDashboard bajoquintos={bajoquintos} openModal={openModal} setHistoryBq={setHistoryBq} />
        )}
        {activeTab === 'pedidos' && (
          <TabPedidos
            bajoquintos={bajoquintos} openModal={openModal}
            deleteBajoquinto={deleteBajoquinto} setHistoryBq={setHistoryBq}
            setWhatsappBq={setWhatsappBq}
          />
        )}
        {activeTab === 'seguimientos' && (
          <TabSeguimientos
            bajoquintos={bajoquintos} openModal={openModal}
            updateBajoquinto={updateBajoquinto} setWhatsappBq={setWhatsappBq}
          />
        )}
        {activeTab === 'cobros' && (
          <TabCobros
            bajoquintos={bajoquintos} openModal={openModal}
            setHistoryBq={setHistoryBq} setWhatsappBq={setWhatsappBq}
          />
        )}
      </div>

      {/* ── Client history sheet ── */}
      {historyBq && (
        <ClientHistorySheet
          bq={historyBq}
          transactions={transactions}
          onClose={() => setHistoryBq(null)}
          openModal={openModal}
          setWhatsappBq={setWhatsappBq}
        />
      )}

      {/* ── WhatsApp modal ── */}
      {whatsappBq && (
        <WhatsAppModal
          bq={whatsappBq}
          onClose={() => setWhatsappBq(null)}
        />
      )}
    </div>
  )
}

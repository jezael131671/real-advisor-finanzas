import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Scissors, Calendar, AlertTriangle, CheckCircle2, CreditCard } from 'lucide-react'
import { getDate, differenceInCalendarDays, setDate, addMonths, format } from 'date-fns'
import { es } from 'date-fns/locale'
import useFinanceStore from '../store/useFinanceStore.js'
import { fmx, fmxC } from '../lib/formatters.js'
import toast from 'react-hot-toast'

// ── Card date calculations ─────────────────────────────────────────────────────
function cardDates(card) {
  const now     = new Date()
  const todayN  = getDate(now)
  const cutD    = Number(card.cutDay || 1)
  const dueD    = Number(card.dueDay || 20)

  const nextCut = cutD > todayN
    ? setDate(now, cutD)
    : setDate(addMonths(now, 1), cutD)

  const nextDue = dueD > todayN
    ? setDate(now, dueD)
    : setDate(addMonths(now, 1), dueD)

  return {
    daysUntilCut: Math.max(0, differenceInCalendarDays(nextCut, now)),
    daysUntilDue: Math.max(0, differenceInCalendarDays(nextDue, now)),
    cutDateStr:   format(nextCut, "d 'de' MMM", { locale: es }),
    dueDateStr:   format(nextDue, "d 'de' MMM", { locale: es }),
  }
}

// ── Utilization style ─────────────────────────────────────────────────────────
const utilStyle = (pct) =>
  pct >= 51 ? {
    text:    '#E11D48',
    textCls: 'text-rose-600',
    bg:      'rgba(225,29,72,0.09)',
    grad:    'linear-gradient(90deg,#E11D48,#F43F5E)',
    label:   'Riesgo',
    labelBg: 'rgba(225,29,72,0.10)',
  } : pct >= 30 ? {
    text:    '#D97706',
    textCls: 'text-amber-600',
    bg:      'rgba(217,119,6,0.08)',
    grad:    'linear-gradient(90deg,#D97706,#F59E0B)',
    label:   'Cuidado',
    labelBg: 'rgba(217,119,6,0.10)',
  } : {
    text:    '#059669',
    textCls: 'text-emerald-600',
    bg:      'rgba(5,150,105,0.08)',
    grad:    'linear-gradient(90deg,#059669,#22C55E)',
    label:   'Sano',
    labelBg: 'rgba(5,150,105,0.10)',
  }

// ── Card gradient map (matches account gradients for visual consistency) ───────
const CARD_GRADS = [
  ['#5B21B6','#4338CA'],
  ['#1D4ED8','#0E7490'],
  ['#0F766E','#065F46'],
  ['#BE185D','#9D174D'],
  ['#B45309','#92400E'],
  ['#4338CA','#6D28D9'],
  ['#15803D','#0F766E'],
  ['#475569','#334155'],
]

// ── Countdown pill ─────────────────────────────────────────────────────────────
function CountdownPill({ icon: Icon, label, dateStr, days, urgentAt, warnAt }) {
  const isUrgent = days <= urgentAt
  const isWarn   = !isUrgent && days <= warnAt
  const color    = isUrgent ? '#E11D48' : isWarn ? '#D97706' : '#4F46E5'
  const bg       = isUrgent ? 'rgba(225,29,72,0.07)' : isWarn ? 'rgba(217,119,6,0.07)' : 'var(--s2)'
  const border   = isUrgent ? 'rgba(225,29,72,0.18)' : isWarn ? 'rgba(217,119,6,0.18)' : 'var(--border)'

  return (
    <div className="flex-1 rounded-2xl p-3"
      style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} color={color} />
        <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color }}>
          {label}
        </span>
      </div>
      <p className="text-sm font-black leading-tight" style={{ color: 'var(--t1)' }}>
        {dateStr}
      </p>
      <p className="text-[10px] font-semibold mt-0.5" style={{ color }}>
        {days === 0 ? '¡Hoy!' : days === 1 ? 'Mañana' : `en ${days} días`}
      </p>
    </div>
  )
}

// ── Metric cell ────────────────────────────────────────────────────────────────
function MetricCell({ label, value, valueColor }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-wide mb-0.5" style={{ color: 'var(--t3)' }}>
        {label}
      </p>
      <p className={`text-sm font-black leading-tight ${valueColor ?? ''}`} style={!valueColor ? { color: 'var(--t1)' } : undefined}>
        {value}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Cards({ openModal }) {
  const { cards, deleteCard } = useFinanceStore()
  const [confirmDel, setConfirmDel] = useState(null)
  const [expanded,   setExpanded]   = useState(null)   // card id with details open

  // ── Totals
  const { totalDebt, totalLimit, totalAvail, totalUtil } = useMemo(() => {
    const totalDebt  = cards.reduce((s, c) => s + Number(c.balance || 0), 0)
    const totalLimit = cards.reduce((s, c) => s + Number(c.limit   || 0), 0)
    return {
      totalDebt,
      totalLimit,
      totalAvail: Math.max(0, totalLimit - totalDebt),
      totalUtil:  totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0,
    }
  }, [cards])

  const handleDelete = (id) => {
    deleteCard(id)
    setConfirmDel(null)
    toast.success('Tarjeta eliminada')
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mb-nav">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="px-5 pt-14 pt-safe flex justify-between items-center mb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--t3)' }}>
            Crédito
          </p>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--t1)' }}>
            Tarjetas
          </h1>
        </div>
        <button onClick={() => openModal('card', null)}
          className="btn-press flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: 'var(--accent)', color: '#fff',
            boxShadow: '0 4px 12px rgba(79,70,229,0.30)' }}>
          <Plus size={15} strokeWidth={2.5} /> Nueva
        </button>
      </div>

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {cards.length === 0 && (
        <div className="px-5">
          <div className="card text-center py-14 fade-up">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(79,70,229,0.08)' }}>
              <CreditCard size={28} color="var(--accent)" />
            </div>
            <p className="font-bold text-base mb-1" style={{ color: 'var(--t1)' }}>
              Sin tarjetas registradas
            </p>
            <p className="text-sm mb-6" style={{ color: 'var(--t3)' }}>
              Agrega tus tarjetas de crédito para monitorear utilización y vencimientos
            </p>
            <button onClick={() => openModal('card', null)}
              className="btn-primary" style={{ maxWidth: 220, margin: '0 auto' }}>
              Agregar tarjeta
            </button>
          </div>
        </div>
      )}

      {cards.length > 0 && (
        <>
          {/* ── Portfolio summary ───────────────────────────────────── */}
          <div className="px-5 mb-5">
            <div className="relative overflow-hidden rounded-3xl px-5 pt-5 pb-4"
              style={{ background: 'linear-gradient(135deg,#1e1250 0%,#0d0d2b 55%,#0a1840 100%)' }}>
              <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle,rgba(99,102,241,0.25),transparent)' }} />

              <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
                style={{ color: 'rgba(167,139,250,0.55)' }}>
                Resumen de crédito
              </p>

              {/* Main figures */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wide mb-1"
                    style={{ color: 'rgba(167,139,250,0.50)' }}>Límite total</p>
                  <p className="text-base font-black text-white">{fmxC(totalLimit)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wide mb-1"
                    style={{ color: 'rgba(167,139,250,0.50)' }}>Deuda</p>
                  <p className="text-base font-black" style={{ color: '#F87171' }}>{fmxC(totalDebt)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wide mb-1"
                    style={{ color: 'rgba(167,139,250,0.50)' }}>Disponible</p>
                  <p className="text-base font-black" style={{ color: '#4ADE80' }}>{fmxC(totalAvail)}</p>
                </div>
              </div>

              {/* Combined utilization bar */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-medium" style={{ color: 'rgba(167,139,250,0.60)' }}>
                    Utilización total
                  </span>
                  <span className="text-sm font-black"
                    style={{ color: totalUtil >= 51 ? '#F87171' : totalUtil >= 30 ? '#FCD34D' : '#4ADE80' }}>
                    {totalUtil.toFixed(0)}%
                  </span>
                </div>
                <div className="rounded-full overflow-hidden"
                  style={{ height: 6, background: 'rgba(255,255,255,0.10)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, totalUtil)}%`,
                      background: utilStyle(totalUtil).grad,
                    }} />
                </div>
              </div>

              {/* Per-card mini bars */}
              {cards.length > 1 && (
                <div className="mt-3 space-y-1.5">
                  {cards.map((c, i) => {
                    const u  = Number(c.limit) > 0 ? (Number(c.balance) / Number(c.limit)) * 100 : 0
                    const us = utilStyle(u)
                    const [g1, g2] = CARD_GRADS[(c.colorIndex ?? i) % CARD_GRADS.length]
                    return (
                      <div key={c.id} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: g1 }} />
                        <span className="text-[9px] font-medium w-20 truncate"
                          style={{ color: 'rgba(167,139,250,0.65)' }}>
                          {c.bankName}
                        </span>
                        <div className="flex-1 rounded-full overflow-hidden"
                          style={{ height: 3, background: 'rgba(255,255,255,0.08)' }}>
                          <div className="h-full rounded-full"
                            style={{ width: `${Math.min(100, u)}%`, background: us.grad }} />
                        </div>
                        <span className="text-[9px] font-bold w-7 text-right"
                          style={{ color: us.text }}>
                          {u.toFixed(0)}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Cards list ──────────────────────────────────────────── */}
          <div className="px-5 space-y-6">
            {cards.map((card, idx) => {
              const bal    = Number(card.balance || 0)
              const lim    = Number(card.limit   || 0)
              const avail  = Math.max(0, lim - bal)
              const pct    = lim > 0 ? (bal / lim) * 100 : 0
              const us     = utilStyle(pct)
              const dates  = cardDates(card)
              const [g1, g2] = CARD_GRADS[(card.colorIndex ?? idx) % CARD_GRADS.length]

              const paymentUrgent = dates.daysUntilDue <= 2
              const paymentWarn   = !paymentUrgent && dates.daysUntilDue <= 7
              const cutWarn       = dates.daysUntilCut <= 3

              return (
                <div key={card.id} className="fade-up">

                  {/* ── Visual card ───────────────────────────────── */}
                  <div className="rounded-3xl p-5 relative overflow-hidden mb-3"
                    style={{ background: `linear-gradient(135deg,${g1},${g2})` }}>
                    <div className="absolute inset-0 pointer-events-none"
                      style={{ background: 'linear-gradient(to bottom,rgba(0,0,0,0),rgba(0,0,0,0.32))' }} />
                    <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full pointer-events-none"
                      style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full pointer-events-none"
                      style={{ background: 'rgba(255,255,255,0.04)' }} />

                    <div className="relative">
                      {/* Top row */}
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-white/60 text-[11px] font-medium">{card.bankName}</p>
                          <p className="text-white font-bold text-lg leading-tight">
                            {card.cardName || card.alias || card.bankName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Status badge */}
                          <div className="px-2 py-0.5 rounded-full"
                            style={{ background: us.bg, border: `1px solid ${us.text}30` }}>
                            <span className="text-[9px] font-bold uppercase tracking-wide"
                              style={{ color: us.text }}>
                              {us.label}
                            </span>
                          </div>
                          {/* Chip */}
                          <div className="w-8 h-5 rounded-sm"
                            style={{ background: 'rgba(250,204,21,0.8)' }} />
                        </div>
                      </div>

                      {/* Card number */}
                      <p className="font-mono text-white/55 text-sm tracking-[0.22em] mb-5">
                        •••• •••• •••• {card.last4 || '••••'}
                      </p>

                      {/* Bottom row */}
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-white/40 text-[9px] uppercase tracking-wider mb-0.5">Corte</p>
                          <p className="text-white text-sm font-bold">{dates.cutDateStr}</p>
                          <p className="text-white/50 text-[9px]">
                            {dates.daysUntilCut === 0 ? '¡Hoy!' : `en ${dates.daysUntilCut} días`}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-white/40 text-[9px] uppercase tracking-wider mb-0.5">Pago</p>
                          <p className="text-white text-sm font-bold">{dates.dueDateStr}</p>
                          <p className="text-white/50 text-[9px]">
                            {dates.daysUntilDue === 0 ? '¡Hoy!' : `en ${dates.daysUntilDue} días`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-white/40 text-[9px] uppercase tracking-wider mb-0.5">Disponible</p>
                          <p className="text-white text-sm font-bold">{fmxC(avail)}</p>
                          <p className="text-white/50 text-[9px]">{pct.toFixed(0)}% usado</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Details panel ─────────────────────────────── */}
                  <div className="card space-y-4">

                    {/* Alert banner — urgent payment */}
                    {(paymentUrgent || paymentWarn) && (
                      <div className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 fade-in"
                        style={{
                          background: paymentUrgent ? 'rgba(225,29,72,0.07)' : 'rgba(217,119,6,0.07)',
                          border: `1px solid ${paymentUrgent ? 'rgba(225,29,72,0.20)' : 'rgba(217,119,6,0.20)'}`,
                        }}>
                        <AlertTriangle size={15} color={paymentUrgent ? '#E11D48' : '#D97706'} />
                        <div>
                          <p className="text-xs font-bold"
                            style={{ color: paymentUrgent ? '#E11D48' : '#D97706' }}>
                            {paymentUrgent
                              ? dates.daysUntilDue === 0 ? '¡Pago vence HOY!'
                                : `¡Pago mañana — ${dates.dueDateStr}!`
                              : `Pago en ${dates.daysUntilDue} días (${dates.dueDateStr})`
                            }
                          </p>
                          {card.minPayment && (
                            <p className="text-[10px] font-medium" style={{ color: 'var(--t3)' }}>
                              Mínimo: {fmx(card.minPayment)}
                              {card.noInterestPayment ? ` · Sin intereses: ${fmx(card.noInterestPayment)}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── Balance metrics (3 cols) ──────────────── */}
                    <div className="grid grid-cols-3 gap-3">
                      <MetricCell label="Saldo" value={fmx(bal)} valueColor="text-rose-600" />
                      <MetricCell label="Límite" value={fmx(lim)} />
                      <MetricCell label="Disponible" value={fmxC(avail)} valueColor="text-emerald-600" />
                    </div>

                    {/* ── Utilization bar ───────────────────────── */}
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide"
                          style={{ color: 'var(--t3)' }}>
                          Utilización
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black" style={{ color: us.text }}>
                            {pct.toFixed(1)}%
                          </span>
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                            style={{ background: us.labelBg }}>
                            {pct >= 51 ? <AlertTriangle size={9} color={us.text} />
                              : pct >= 30 ? <AlertTriangle size={9} color={us.text} />
                              : <CheckCircle2 size={9} color={us.text} />}
                            <span className="text-[9px] font-bold uppercase" style={{ color: us.text }}>
                              {us.label}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-full overflow-hidden"
                        style={{ height: 7, background: 'var(--s3)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, pct)}%`, background: us.grad }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[9px] font-medium" style={{ color: 'var(--t3)' }}>$0</span>
                        <span className="text-[9px] font-medium" style={{ color: 'var(--t3)' }}>
                          {fmx(lim)}
                        </span>
                      </div>
                    </div>

                    {/* ── Countdown: Corte + Pago ───────────────── */}
                    <div className="flex gap-2">
                      <CountdownPill
                        icon={Scissors}
                        label="Corte"
                        dateStr={dates.cutDateStr}
                        days={dates.daysUntilCut}
                        urgentAt={0}
                        warnAt={3}
                      />
                      <CountdownPill
                        icon={Calendar}
                        label="Pago límite"
                        dateStr={dates.dueDateStr}
                        days={dates.daysUntilDue}
                        urgentAt={2}
                        warnAt={7}
                      />
                    </div>

                    {/* ── Payment amounts ───────────────────────── */}
                    {(card.minPayment || card.noInterestPayment) && (
                      <div className="flex gap-2">
                        {card.minPayment && (
                          <div className="flex-1 rounded-2xl px-3 py-2.5"
                            style={{ background: 'rgba(217,119,6,0.07)',
                              border: '1px solid rgba(217,119,6,0.15)' }}>
                            <p className="text-[9px] font-bold uppercase tracking-wide text-amber-600 mb-1">
                              Pago mínimo
                            </p>
                            <p className="text-base font-black text-amber-700">
                              {fmx(card.minPayment)}
                            </p>
                            <p className="text-[9px] mt-0.5 text-amber-600/70">
                              Genera intereses
                            </p>
                          </div>
                        )}
                        {card.noInterestPayment && (
                          <div className="flex-1 rounded-2xl px-3 py-2.5"
                            style={{ background: 'rgba(5,150,105,0.07)',
                              border: '1px solid rgba(5,150,105,0.15)' }}>
                            <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 mb-1">
                              Sin intereses
                            </p>
                            <p className="text-base font-black text-emerald-700">
                              {fmx(card.noInterestPayment)}
                            </p>
                            <p className="text-[9px] mt-0.5 text-emerald-600/70">
                              Recomendado
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Rates ────────────────────────────────────── */}
                    {(card.cat || card.rate) && (
                      <div className="flex gap-2 flex-wrap">
                        {card.cat && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                            style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
                            <span className="text-[9px] font-bold uppercase tracking-wide"
                              style={{ color: 'var(--t3)' }}>CAT</span>
                            <span className="text-sm font-black text-rose-600">
                              {card.cat}%
                            </span>
                          </div>
                        )}
                        {card.rate && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                            style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
                            <span className="text-[9px] font-bold uppercase tracking-wide"
                              style={{ color: 'var(--t3)' }}>Tasa</span>
                            <span className="text-sm font-black text-rose-600">
                              {card.rate}%
                            </span>
                          </div>
                        )}
                        {card.cat && card.rate && (
                          <p className="text-[9px] font-medium self-center"
                            style={{ color: 'var(--t3)' }}>
                            Intereses por deuda no pagada
                          </p>
                        )}
                      </div>
                    )}

                    {/* ── Action buttons ────────────────────────── */}
                    <div className="flex gap-2">
                      <button onClick={() => openModal('payment', card)}
                        className="btn-press flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5"
                        style={{ background: 'var(--accent)', color: '#fff',
                          boxShadow: '0 3px 10px rgba(79,70,229,0.25)' }}>
                        <CreditCard size={14} />
                        Registrar pago
                      </button>
                      <button onClick={() => openModal('card', card)}
                        className="btn-press w-11 h-11 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
                        <Pencil size={15} color="var(--t2)" />
                      </button>
                      <button onClick={() => setConfirmDel(card.id)}
                        className="btn-press w-11 h-11 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(225,29,72,0.07)',
                          border: '1px solid rgba(225,29,72,0.12)' }}>
                        <Trash2 size={15} color="#E11D48" />
                      </button>
                    </div>
                  </div>

                  {/* ── Delete confirm ────────────────────────────── */}
                  {confirmDel === card.id && (
                    <div className="mt-2 p-4 rounded-2xl fade-in"
                      style={{ background: 'rgba(225,29,72,0.06)',
                        border: '1px solid rgba(225,29,72,0.14)' }}>
                      <p className="text-sm font-semibold text-center mb-3" style={{ color: 'var(--t1)' }}>
                        ¿Eliminar {card.bankName}?
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmDel(null)} className="btn-ghost flex-1 py-2 text-sm">
                          Cancelar
                        </button>
                        <button onClick={() => handleDelete(card.id)}
                          className="btn-press flex-1 py-2 rounded-xl text-sm font-bold"
                          style={{ background: '#E11D48', color: '#fff' }}>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

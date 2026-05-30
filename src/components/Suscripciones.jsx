import { useState } from 'react'
import { Plus, CheckCircle2, Trash2, Pencil, PauseCircle, XCircle } from 'lucide-react'
import useFinanceStore from '../store/useFinanceStore.js'
import { fmx } from '../lib/formatters.js'
import { SUB_FREQUENCIES } from '../store/defaultData.js'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  active:    { bg: 'rgba(5,150,105,0.10)',  color: '#059669', label: 'Activa'    },
  paused:    { bg: 'rgba(217,119,6,0.10)',  color: '#D97706', label: 'Pausada'   },
  cancelled: { bg: 'rgba(225,29,72,0.10)',  color: '#E11D48', label: 'Cancelada' },
}

const normalizeStatus = (sub) => {
  if (sub.status) return sub.status
  return sub.isActive === false ? 'paused' : 'active'
}

export default function Suscripciones({ openModal }) {
  const { subscriptions, updateSubscription, deleteSubscription } = useFinanceStore()
  const [tabFilter, setTabFilter] = useState('active')

  const subStatus = (s) => normalizeStatus(s)

  const displayList = subscriptions.filter(s => subStatus(s) === tabFilter)

  // ── Próximos cobros (≤ 5 days) ─────────────────────────────────────────────
  const _now = new Date()
  const todayDay = _now.getDate()
  const upcomingSubs = subscriptions
    .filter(s => subStatus(s) === 'active')
    .map(s => {
      const day    = Number(s.billingDay || 1)
      const subDue = day > todayDay
        ? new Date(_now.getFullYear(), _now.getMonth(), day)
        : new Date(_now.getFullYear(), _now.getMonth() + 1, day)
      const days   = Math.ceil((subDue - _now) / 86_400_000)
      return { ...s, days }
    })
    .filter(s => s.days <= 5)
    .sort((a, b) => a.days - b.days)

  const monthlyTotal = subscriptions
    .filter(s => subStatus(s) === 'active')
    .reduce((s, sub) => {
      const freq   = SUB_FREQUENCIES.find(f => f.key === sub.frequency)
      const months = freq?.months ?? 1
      return s + (Number(sub.amount || 0) / months)
    }, 0)

  const annualTotal = monthlyTotal * 12

  const freqLabel = (key) => SUB_FREQUENCIES.find(f => f.key === key)?.label ?? 'Mensual'

  const nextBillingLabel = (sub) => {
    const now2   = new Date()
    const day    = Number(sub.billingDay || 1)
    const today2 = now2.getDate()
    const subDue = day > today2
      ? new Date(now2.getFullYear(), now2.getMonth(), day)
      : new Date(now2.getFullYear(), now2.getMonth() + 1, day)
    const days   = Math.ceil((subDue - now2) / 86_400_000)
    if (days === 0) return 'Hoy'
    if (days === 1) return 'Mañana'
    return `En ${days} días`
  }

  const cycleStatus = (sub) => {
    const cur = subStatus(sub)
    if (cur === 'active')    updateSubscription(sub.id, { status: 'paused',    isActive: false })
    else if (cur === 'paused')    updateSubscription(sub.id, { status: 'active',    isActive: true  })
    else                          updateSubscription(sub.id, { status: 'active',    isActive: true  })
  }

  const TABS = [
    { key: 'active',    label: 'Activas'   },
    { key: 'paused',    label: 'Pausadas'  },
    { key: 'cancelled', label: 'Canceladas'},
  ]

  return (
    <div className="mb-nav">
      <div className="px-5 pt-14 pt-safe flex justify-between items-center mb-4">
        <h1 className="text-2xl font-black" style={{ color: 'var(--t1)' }}>Suscripciones</h1>
        <button onClick={() => openModal('subscription', null)}
          className="btn-press flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          <Plus size={15} strokeWidth={2.5} /> Agregar
        </button>
      </div>

      {/* ── Próximos cobros ─────────────────────────────────────────────────── */}
      {upcomingSubs.length > 0 && (
        <div className="px-5 mb-4">
          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--t3)' }}>
            ⚡ Próximos cobros
          </p>
          <div className="space-y-2">
            {upcomingSubs.map(sub => {
              const urgent = sub.days <= 1
              const warn   = sub.days <= 3
              const daysLbl = sub.days === 0 ? '¡Hoy!'
                            : sub.days === 1 ? 'Mañana'
                            : `En ${sub.days} días`
              const bg     = urgent ? 'rgba(225,29,72,0.06)'   : warn ? 'rgba(217,119,6,0.06)'  : 'rgba(79,70,229,0.04)'
              const border = urgent ? 'rgba(225,29,72,0.18)'   : warn ? 'rgba(217,119,6,0.18)'  : 'rgba(79,70,229,0.10)'
              const textC  = urgent ? '#E11D48'                 : warn ? '#D97706'               : 'var(--accent)'
              return (
                <div key={sub.id} className="rounded-2xl px-4 py-3 flex items-center justify-between"
                  style={{ background: bg, border: `1px solid ${border}` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
                      style={{ background: 'rgba(255,255,255,0.4)' }}>
                      📱
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: 'var(--t1)' }}>{sub.name}</p>
                      <p className="text-xs font-semibold" style={{ color: textC }}>{daysLbl}</p>
                    </div>
                  </div>
                  <p className="text-sm font-black" style={{ color: 'var(--t1)' }}>{fmx(sub.amount)}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Cost summary */}
      {subscriptions.length > 0 && (
        <div className="px-5 mb-5 grid grid-cols-2 gap-3">
          <div className="card">
            <p className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--t3)' }}>
              Por mes
            </p>
            <p className="text-xl font-black text-rose-600">{fmx(monthlyTotal)}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>
              {subscriptions.filter(s => subStatus(s) === 'active').length} activas
            </p>
          </div>
          <div className="card">
            <p className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--t3)' }}>
              Por año
            </p>
            <p className="text-xl font-black" style={{ color: 'var(--t1)' }}>{fmx(annualTotal)}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-5 mb-4">
        <div className="seg-wrap">
          {TABS.map(t => (
            <button key={t.key}
              className={`seg-btn ${tabFilter === t.key ? 'active' : ''}`}
              onClick={() => setTabFilter(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {subscriptions.length === 0 ? (
        <div className="px-5">
          <div className="card text-center py-12">
            <p className="text-4xl mb-4">📱</p>
            <p className="font-semibold mb-1" style={{ color: 'var(--t1)' }}>Sin suscripciones</p>
            <p className="text-sm mb-6" style={{ color: 'var(--t2)' }}>Registra tus servicios recurrentes</p>
            <button onClick={() => openModal('subscription', null)}
              className="btn-primary" style={{ maxWidth: 220, margin: '0 auto' }}>
              Agregar suscripción
            </button>
          </div>
        </div>
      ) : displayList.length === 0 ? (
        <div className="px-5">
          <div className="card text-center py-8">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-sm" style={{ color: 'var(--t2)' }}>
              Sin suscripciones {tabFilter === 'active' ? 'activas' : tabFilter === 'paused' ? 'pausadas' : 'canceladas'}
            </p>
          </div>
        </div>
      ) : (
        <div className="px-5 space-y-2">
          {displayList.map(sub => {
            const st    = STATUS_COLORS[subStatus(sub)] ?? STATUS_COLORS.active
            const catMap = {
              IA: '🤖', Software: '💻', Productividad: '⚡', Nube: '☁️',
              Streaming: '📺', Negocio: '🏢', Educación: '📚', Música: '🎵',
              Salud: '💊', Otros: '📦',
            }
            const catEmoji = catMap[sub.category] ?? '📱'

            return (
              <div key={sub.id} className="card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ background: 'var(--s2)' }}>
                    {catEmoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--t1)' }}>
                        {sub.name}
                      </p>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
                        {fmx(sub.amount)}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md"
                        style={{ background: 'var(--s2)', color: 'var(--t3)', border: '1px solid var(--border)' }}>
                        {freqLabel(sub.frequency)}
                      </span>
                      {subStatus(sub) === 'active' && (
                        <span className="text-[10px]" style={{ color: 'var(--t3)' }}>
                          {nextBillingLabel(sub)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => openModal('subscription', sub)}
                      className="btn-press w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
                      <Pencil size={12} color="var(--t2)" />
                    </button>
                    <button onClick={() => cycleStatus(sub)}
                      className="btn-press w-7 h-7 rounded-lg flex items-center justify-center"
                      title={subStatus(sub) === 'active' ? 'Pausar' : 'Activar'}
                      style={{ background: subStatus(sub) === 'active' ? 'rgba(5,150,105,0.10)' : 'var(--s2)', border: '1px solid var(--border)' }}>
                      {subStatus(sub) === 'active'
                        ? <CheckCircle2 size={14} color="#059669" />
                        : <PauseCircle  size={14} color="var(--t3)" />}
                    </button>
                    <button onClick={() => { deleteSubscription(sub.id); toast.success('Suscripción eliminada') }}
                      className="btn-press w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(225,29,72,0.08)' }}>
                      <Trash2 size={12} color="#E11D48" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

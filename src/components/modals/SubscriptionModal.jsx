import { useState } from 'react'
import { X } from 'lucide-react'
import useFinanceStore from '../../store/useFinanceStore.js'
import { SUB_FREQUENCIES, SUB_CATEGORIES } from '../../store/defaultData.js'
import toast from 'react-hot-toast'

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

const PRESETS = [
  { name: 'Netflix',   amount: 219, frequency: 'mensual' },
  { name: 'Spotify',   amount: 99,  frequency: 'mensual' },
  { name: 'Disney+',   amount: 159, frequency: 'mensual' },
  { name: 'YouTube',   amount: 139, frequency: 'mensual' },
  { name: 'iCloud',    amount: 25,  frequency: 'mensual' },
  { name: 'Amazon',    amount: 99,  frequency: 'mensual' },
  { name: 'ChatGPT',   amount: 200, frequency: 'mensual' },
  { name: 'Adobe CC',  amount: 599, frequency: 'mensual' },
]

export default function SubscriptionModal({ onClose, data }) {
  const { addSubscription, updateSubscription, cards } = useFinanceStore()

  const isEdit = Boolean(data?.id)

  const [name,       setName]       = useState(data?.name       || '')
  const [amount,     setAmount]     = useState(data?.amount     ? String(data.amount) : '')
  const [billingDay, setBillingDay] = useState(data?.billingDay || 1)
  const [frequency,  setFrequency]  = useState(data?.frequency  || 'mensual')
  const [cardId,     setCardId]     = useState(data?.cardId     || '')
  const [category,   setCategory]   = useState(data?.category   || 'Streaming')
  const [status,     setStatus]     = useState(data?.status     || 'active')

  const applyPreset = (p) => {
    setName(p.name)
    setAmount(String(p.amount))
    setFrequency(p.frequency)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim())                       { toast.error('Escribe el nombre de la suscripción'); return }
    if (!amount || Number(amount) <= 0)     { toast.error('Ingresa el monto'); return }

    const payload = {
      name:       name.trim(),
      amount:     Number(amount),
      billingDay: Number(billingDay),
      frequency,
      cardId:     cardId || null,
      category,
      status,
      isActive:   status === 'active',
    }

    if (isEdit) {
      updateSubscription(data.id, payload)
      toast.success('Suscripción actualizada')
    } else {
      addSubscription(payload)
      toast.success(`📱 ${name} agregada`)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-lg bg-[#0E0E1A] rounded-t-3xl slide-up border-t border-white/5"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}
      >
        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mt-3 mb-1" />

        <div className="px-5 pb-2 pt-3 flex justify-between items-center">
          <h2 className="text-white text-lg font-bold">
            {isEdit ? 'Editar suscripción' : 'Nueva suscripción'}
          </h2>
          <button onClick={onClose}
            className="btn-press w-8 h-8 rounded-full bg-[#151525] flex items-center justify-center">
            <X size={16} className="text-[#8B8BAD]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-4 space-y-4 overflow-y-auto max-h-[80vh]">

          {/* ── Quick presets (new only) ──────────────────────── */}
          {!isEdit && (
            <div>
              <p className="text-[#8B8BAD] text-xs font-medium mb-2">Agregar rápido</p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
                {PRESETS.map(p => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`btn-press shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      name === p.name
                        ? 'bg-violet-600 text-white border-violet-500'
                        : 'bg-[#151525] text-[#8B8BAD] border-white/5'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Name ─────────────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Nombre</label>
            <input
              type="text"
              placeholder="Ej: Netflix, Gym, Adobe..."
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          {/* ── Frequency ────────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-2 block">Frecuencia de cobro</label>
            <div className="flex gap-2 flex-wrap">
              {SUB_FREQUENCIES.map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFrequency(f.key)}
                  className={`btn-press px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    frequency === f.key
                      ? 'bg-violet-600 text-white border-violet-500'
                      : 'bg-[#151525] text-[#8B8BAD] border-white/5'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Amount ───────────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
              Costo por cobro (MXN)
            </label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
              className="text-2xl font-bold"
            />
          </div>

          {/* ── Billing day + Category ────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Día de cobro</label>
              <select value={billingDay} onChange={e => setBillingDay(e.target.value)}>
                {DAYS.map(d => <option key={d} value={d}>Día {d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Categoría</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {SUB_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Card ─────────────────────────────────────────── */}
          {cards.length > 0 && (
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
                Cobrar a tarjeta <span className="text-[#555577]">(opcional)</span>
              </label>
              <select value={cardId} onChange={e => setCardId(e.target.value)}>
                <option value="">Efectivo / débito</option>
                {cards.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.bankName}{c.cardName ? ` — ${c.cardName}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ── Status (edit only) ───────────────────────────── */}
          {isEdit && (
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-2 block">Estado</label>
              <div className="flex gap-2">
                {[
                  { key: 'active',    label: '✅ Activa'    },
                  { key: 'paused',    label: '⏸ Pausada'   },
                  { key: 'cancelled', label: '❌ Cancelada' },
                ].map(s => (
                  <button key={s.key} type="button" onClick={() => setStatus(s.key)}
                    className={`btn-press flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      status === s.key
                        ? 'bg-violet-600 text-white border-violet-500'
                        : 'bg-[#151525] text-[#8B8BAD] border-white/5'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn-press w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold py-4 rounded-2xl text-base mt-2"
          >
            {isEdit ? 'Guardar cambios' : 'Agregar suscripción'}
          </button>
        </form>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { X } from 'lucide-react'
import useFinanceStore from '../../store/useFinanceStore.js'
import { INSTITUTIONS } from '../../store/defaultData.js'
import toast from 'react-hot-toast'

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

export default function CardModal({ onClose, data }) {
  const { addCard, updateCard } = useFinanceStore()
  const isEdit = Boolean(data?.id)

  const [bankName,           setBankName]           = useState(data?.bankName           || '')
  const [cardName,           setCardName]           = useState(data?.cardName           || '')
  const [last4,              setLast4]              = useState(data?.last4              || '')
  const [limit,              setLimit]              = useState(data?.limit              ? String(data.limit)              : '')
  const [balance,            setBalance]            = useState(data?.balance            ? String(data.balance)            : '')
  const [cutDay,             setCutDay]             = useState(data?.cutDay             || 1)
  const [dueDay,             setDueDay]             = useState(data?.dueDay             || 20)
  const [minPayment,         setMinPayment]         = useState(data?.minPayment         ? String(data.minPayment)         : '')
  const [noInterestPayment,  setNoInterestPayment]  = useState(data?.noInterestPayment  ? String(data.noInterestPayment)  : '')
  const [cat,                setCat]                = useState(data?.cat                ? String(data.cat)                : '')
  const [rate,               setRate]               = useState(data?.rate               ? String(data.rate)               : '')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!bankName)                    { toast.error('Selecciona el banco'); return }
    if (!limit || Number(limit) <= 0) { toast.error('Ingresa el límite de crédito'); return }
    if (Number(balance) > Number(limit)) {
      toast.error('El saldo no puede superar el límite de crédito')
      return
    }

    const payload = {
      bankName,
      cardName:          cardName || bankName,
      last4:             last4.slice(-4),
      limit:             Number(limit),
      balance:           Number(balance)           || 0,
      cutDay:            Number(cutDay),
      dueDay:            Number(dueDay),
      minPayment:        Number(minPayment)        || null,
      noInterestPayment: Number(noInterestPayment) || null,
      cat:               cat   ? Number(cat)  : null,
      rate:              rate  ? Number(rate) : null,
    }

    if (isEdit) {
      updateCard(data.id, payload)
      toast.success('Tarjeta actualizada')
    } else {
      addCard(payload)
      toast.success('Tarjeta agregada ✓')
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-[#0E0E1A] rounded-t-3xl slide-up border-t border-white/5"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}>

        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mt-3 mb-1" />

        <div className="px-5 pb-2 pt-3 flex justify-between items-center">
          <h2 className="text-white text-lg font-bold">
            {isEdit ? 'Editar tarjeta' : 'Nueva tarjeta'}
          </h2>
          <button onClick={onClose}
            className="btn-press w-8 h-8 rounded-full bg-[#151525] flex items-center justify-center">
            <X size={16} className="text-[#8B8BAD]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-4 space-y-4 overflow-y-auto max-h-[80vh]">

          {/* Banco */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Banco</label>
            <select value={bankName} onChange={e => setBankName(e.target.value)} required>
              <option value="">Selecciona banco...</option>
              {INSTITUTIONS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Nombre */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
              Nombre / apodo <span className="text-[#555577]">(opcional)</span>
            </label>
            <input type="text" placeholder="Ej: Oro, Platinum, Principal"
              value={cardName} onChange={e => setCardName(e.target.value)} />
          </div>

          {/* Últimos 4 */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
              Últimos 4 dígitos <span className="text-[#555577]">(opcional)</span>
            </label>
            <input type="text" inputMode="numeric" maxLength={4} placeholder="4521"
              value={last4}
              onChange={e => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          </div>

          {/* Límite */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Límite de crédito (MXN)</label>
            <input type="number" inputMode="decimal" placeholder="45,000"
              value={limit} onChange={e => setLimit(e.target.value)} required />
          </div>

          {/* Saldo */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
              Saldo adeudado actual (MXN) <span className="text-[#555577]">(opcional)</span>
            </label>
            <input type="number" inputMode="decimal" placeholder="0"
              value={balance} onChange={e => setBalance(e.target.value)} />
          </div>

          {/* Pagos: mínimo + sin intereses */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Pago mínimo</label>
              <input type="number" inputMode="decimal" placeholder="0"
                value={minPayment} onChange={e => setMinPayment(e.target.value)} />
            </div>
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Pago sin intereses</label>
              <input type="number" inputMode="decimal" placeholder="0"
                value={noInterestPayment} onChange={e => setNoInterestPayment(e.target.value)} />
            </div>
          </div>

          {/* Días de corte / pago */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Día de corte</label>
              <select value={cutDay} onChange={e => setCutDay(e.target.value)}>
                {DAYS.map(d => <option key={d} value={d}>Día {d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Día límite pago</label>
              <select value={dueDay} onChange={e => setDueDay(e.target.value)}>
                {DAYS.map(d => <option key={d} value={d}>Día {d}</option>)}
              </select>
            </div>
          </div>

          {/* CAT / Tasa */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
                CAT % <span className="text-[#555577]">(opcional)</span>
              </label>
              <input type="number" inputMode="decimal" placeholder="Ej: 75.4"
                value={cat} onChange={e => setCat(e.target.value)} />
            </div>
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
                Tasa interés % <span className="text-[#555577]">(opcional)</span>
              </label>
              <input type="number" inputMode="decimal" placeholder="Ej: 36.0"
                value={rate} onChange={e => setRate(e.target.value)} />
            </div>
          </div>

          <button type="submit"
            className="btn-press w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold py-4 rounded-2xl text-base mt-2">
            {isEdit ? 'Guardar cambios' : 'Agregar tarjeta'}
          </button>
        </form>
      </div>
    </div>
  )
}

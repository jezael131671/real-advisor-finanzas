import { useState } from 'react'
import { X } from 'lucide-react'
import useFinanceStore from '../../store/useFinanceStore.js'
import { fmx } from '../../lib/formatters.js'
import toast from 'react-hot-toast'

export default function CardPaymentModal({ onClose, data }) {
  const { accounts, cards, addTransaction } = useFinanceStore()

  // data may be { id: cardId } when opened from an alert quick-action
  const [cardId,     setCardId]     = useState(data?.id       || '')
  const [accountId,  setAccountId]  = useState(accounts[0]?.id || '')
  const [amount,     setAmount]     = useState('')
  const [description,setDescription]= useState('')

  const selectedCard    = cards.find(c => c.id === cardId)
  const selectedAccount = accounts.find(a => a.id === accountId)

  const fillFull = () => {
    if (selectedCard) setAmount(String(selectedCard.balance))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!cardId)                          { toast.error('Selecciona la tarjeta a pagar'); return }
    if (!accountId)                       { toast.error('Selecciona la cuenta de origen'); return }
    if (!amount || Number(amount) <= 0)   { toast.error('Ingresa el monto a pagar'); return }

    addTransaction({
      type:        'pago_tarjeta',
      amount:      Number(amount),
      description: description.trim() || `Pago ${selectedCard?.bankName || 'tarjeta'}`,
      accountId,
      cardId,
    })

    toast.success(`✓ Pago a ${selectedCard?.bankName || 'tarjeta'} registrado`)
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
          <h2 className="text-white text-lg font-bold">Pagar tarjeta</h2>
          <button onClick={onClose}
            className="btn-press w-8 h-8 rounded-full bg-[#151525] flex items-center justify-center">
            <X size={16} className="text-[#8B8BAD]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-4 space-y-4">

          {/* ── Card to pay ───────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Tarjeta a pagar</label>
            <select
              value={cardId}
              onChange={e => { setCardId(e.target.value); setAmount('') }}
              required
            >
              <option value="">Selecciona tarjeta...</option>
              {cards.filter(c => Number(c.balance) > 0).map(c => (
                <option key={c.id} value={c.id}>
                  {c.bankName}{c.cardName ? ` — ${c.cardName}` : ''} · Saldo: {fmx(c.balance)}
                </option>
              ))}
            </select>
          </div>

          {/* ── Card info ─────────────────────────────────────── */}
          {selectedCard && (
            <div className="p-4 rounded-2xl fade-in"
              style={{ background: 'rgba(123,63,228,0.08)', border: '1px solid rgba(123,63,228,0.2)' }}>
              <div className="flex justify-between">
                <div>
                  <p className="text-xs" style={{ color: 'var(--t3)' }}>Saldo adeudado</p>
                  <p className="text-white font-bold text-xl">{fmx(selectedCard.balance)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: 'var(--t3)' }}>Día límite</p>
                  <p className="text-amber-400 font-bold">Día {selectedCard.dueDay}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Origin account ────────────────────────────────── */}
          {accounts.length > 0 && (
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Pagar desde (cuenta)</label>
              <select value={accountId} onChange={e => setAccountId(e.target.value)} required>
                <option value="">Selecciona cuenta...</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name || a.institution} · {fmx(a.balance)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ── Amount ───────────────────────────────────────── */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[#8B8BAD] text-xs font-medium">Monto a pagar (MXN)</label>
              {selectedCard && (
                <button type="button" onClick={fillFull}
                  className="text-violet-400 text-xs font-semibold">
                  Pago total
                </button>
              )}
            </div>
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

          {/* ── Note ─────────────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
              Nota <span className="text-[#555577]">(opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Pago mínimo, pago total, parcial..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn-press w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-4 rounded-2xl text-base mt-2"
          >
            Registrar pago
          </button>
        </form>
      </div>
    </div>
  )
}

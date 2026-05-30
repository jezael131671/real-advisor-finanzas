import { useState } from 'react'
import { X } from 'lucide-react'
import useFinanceStore from '../../store/useFinanceStore.js'
import { TX_TYPES, TX_LABELS } from '../../store/defaultData.js'
import { today } from '../../lib/formatters.js'
import toast from 'react-hot-toast'

// Types shown in the type selector (bajoquinto goes through its own module)
const SHOWN_TYPES = TX_TYPES.filter(t => t.key !== 'bajoquinto')

export default function TransactionModal({ onClose, data }) {
  const { accounts, cards, categories, addTransaction, updateTransaction } = useFinanceStore()

  const isEdit = Boolean(data?.id)

  const [type,            setType]          = useState(data?.type            || 'gasto')
  const [amount,          setAmount]        = useState(data?.amount          ? String(data.amount) : '')
  const [description,     setDescription]   = useState(data?.description     || '')
  const [categoryId,      setCategoryId]    = useState(data?.category || data?.categoryId || '')
  const [accountId,       setAccountId]     = useState(data?.accountId       || accounts[0]?.id || '')
  const [targetAccountId, setTargetAccId]   = useState(data?.targetAccountId || '')
  const [cardId,          setCardId]        = useState(data?.cardId          || '')
  const [date,            setDate]          = useState(data?.date            || today())
  const [labels,          setLabels]        = useState(data?.labels          || [])

  const toggleLabel = (key) =>
    setLabels(prev => prev.includes(key) ? prev.filter(l => l !== key) : [...prev, key])

  const isIncome    = type === 'ingreso'
  const isExpense   = type === 'gasto'
  const isTransfer  = type === 'transferencia'
  const isCardPay   = type === 'pago_tarjeta'
  const isInversion = type === 'inversion'

  const catFilter = isIncome ? 'ingreso' : 'gasto'
  const cats      = categories.filter(c => c.type === catFilter)

  const typeInfo  = TX_TYPES.find(t => t.key === type) ?? TX_TYPES[0]

  const handleTypeChange = (t) => {
    setType(t)
    setCardId('')
    setCategoryId('')
    setTargetAccId('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) { toast.error('Ingresa un monto válido'); return }
    if (!description.trim())           { toast.error('Agrega una descripción'); return }
    if ((isIncome || isExpense || isInversion) && !accountId && !cardId) {
      toast.error('Selecciona una cuenta'); return
    }
    if (isTransfer && (!accountId || !targetAccountId)) {
      toast.error('Selecciona ambas cuentas'); return
    }
    if (isCardPay && !cardId) { toast.error('Selecciona la tarjeta a pagar'); return }

    const payload = {
      type,
      amount:          Number(amount),
      description:     description.trim(),
      category:        categoryId || null,
      accountId:       accountId  || null,
      cardId:          cardId     || null,
      targetAccountId: isTransfer ? (targetAccountId || null) : null,
      date,
      labels,
    }

    if (isEdit) {
      updateTransaction(data.id, payload)
      toast.success('Movimiento actualizado')
    } else {
      addTransaction(payload)
      toast.success(`${typeInfo.emoji} ${typeInfo.label} registrado`)
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
            {isEdit ? 'Editar movimiento' : 'Nuevo movimiento'}
          </h2>
          <button onClick={onClose}
            className="btn-press w-8 h-8 rounded-full bg-[#151525] flex items-center justify-center">
            <X size={16} className="text-[#8B8BAD]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-4 space-y-4 overflow-y-auto max-h-[82vh]">

          {/* ── Type selector ─────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-2 block">Tipo</label>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
              {SHOWN_TYPES.map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => handleTypeChange(t.key)}
                  className={`btn-press shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    type === t.key
                      ? 'bg-violet-600 text-white border-violet-500'
                      : 'bg-[#151525] text-[#8B8BAD] border-white/5'
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Amount ────────────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Monto (MXN)</label>
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

          {/* ── Description ───────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Descripción</label>
            <input
              type="text"
              placeholder={
                isIncome   ? 'Ej: Sueldo quincenal, cliente...' :
                isCardPay  ? 'Ej: Pago mínimo BBVA...' :
                isTransfer ? 'Ej: Traspaso a ahorro...' :
                isInversion? 'Ej: Compra AAPL × 5...' :
                'Ej: Gasolinera, super, gym...'
              }
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>

          {/* ── Category (income/expense only) ────────────────── */}
          {(isIncome || isExpense) && cats.length > 0 && (
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
                Categoría <span className="text-[#555577]">(opcional)</span>
              </label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                <option value="">Sin categoría</option>
                {cats.map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* ── Account ───────────────────────────────────────── */}
          {!isTransfer && (
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
                {isCardPay ? 'Cuenta origen (débito/efectivo)' :
                 isExpense  ? 'Cuenta o tarjeta de cargo' :
                 'Cuenta'}
              </label>

              {/* For expenses: choose account OR card */}
              {isExpense ? (
                <div className="space-y-2">
                  <select value={cardId ? '' : accountId}
                    onChange={e => { setAccountId(e.target.value); setCardId('') }}>
                    <option value="">— Selecciona cuenta —</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name || a.institution}</option>
                    ))}
                  </select>
                  {cards.length > 0 && (
                    <>
                      <p className="text-[#555577] text-xs text-center">— o cargar a tarjeta —</p>
                      <select value={cardId}
                        onChange={e => { setCardId(e.target.value); setAccountId('') }}>
                        <option value="">Sin tarjeta</option>
                        {cards.map(c => (
                          <option key={c.id} value={c.id}>{c.bankName} {c.cardName ? `— ${c.cardName}` : ''}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              ) : isCardPay ? (
                <>
                  <select value={accountId} onChange={e => setAccountId(e.target.value)}>
                    <option value="">— Selecciona cuenta —</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name || a.institution}</option>
                    ))}
                  </select>
                  <div className="mt-2">
                    <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Tarjeta a pagar</label>
                    <select value={cardId} onChange={e => setCardId(e.target.value)} required>
                      <option value="">— Selecciona tarjeta —</option>
                      {cards.filter(c => Number(c.balance) > 0).map(c => (
                        <option key={c.id} value={c.id}>{c.bankName} {c.cardName ? `— ${c.cardName}` : ''}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <select value={accountId} onChange={e => setAccountId(e.target.value)}>
                  <option value="">— Selecciona cuenta —</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name || a.institution}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* ── Transfer: origin + destination ────────────────── */}
          {isTransfer && (
            <div className="space-y-3">
              <div>
                <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Cuenta origen</label>
                <select value={accountId} onChange={e => setAccountId(e.target.value)} required>
                  <option value="">— Selecciona cuenta origen —</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name || a.institution}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Cuenta destino</label>
                <select value={targetAccountId} onChange={e => setTargetAccId(e.target.value)} required>
                  <option value="">— Selecciona cuenta destino —</option>
                  {accounts
                    .filter(a => a.id !== accountId)
                    .map(a => (
                      <option key={a.id} value={a.id}>{a.name || a.institution}</option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {/* ── Date ──────────────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          {/* ── Labels ───────────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-2 block">
              Etiquetas <span className="text-[#555577]">(opcional)</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {TX_LABELS.map(l => (
                <button key={l.key} type="button" onClick={() => toggleLabel(l.key)}
                  className={`btn-press px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    labels.includes(l.key)
                      ? 'bg-violet-600 text-white border-violet-500'
                      : 'bg-[#151525] text-[#8B8BAD] border-white/5'
                  }`}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="btn-press w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold py-4 rounded-2xl text-base mt-2"
          >
            {isEdit ? 'Guardar cambios' : 'Registrar movimiento'}
          </button>
        </form>
      </div>
    </div>
  )
}

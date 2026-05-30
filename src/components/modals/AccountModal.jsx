import { useState } from 'react'
import { X } from 'lucide-react'
import useFinanceStore from '../../store/useFinanceStore.js'
import { INSTITUTIONS, ACCOUNT_TYPES, ACCOUNT_GRADIENTS } from '../../store/defaultData.js'
import toast from 'react-hot-toast'

export default function AccountModal({ onClose, data }) {
  const { addAccount, updateAccount } = useFinanceStore()
  const isEdit = Boolean(data?.id)

  const [institution, setInstitution] = useState(data?.institution || '')
  const [type,        setType]        = useState(data?.type        || 'debito')
  const [name,        setName]        = useState(data?.name        || '')
  const [balance,     setBalance]     = useState(data?.balance != null ? String(data.balance) : '')
  const [colorIndex,  setColorIndex]  = useState(data?.colorIndex  ?? 0)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!institution) { toast.error('Selecciona la institución'); return }

    const payload = {
      institution,
      type,
      name:       name.trim() || institution,
      balance:    Number(balance) || 0,
      colorIndex: Number(colorIndex),
    }

    if (isEdit) {
      updateAccount(data.id, payload)
      toast.success('Cuenta actualizada')
    } else {
      addAccount(payload)
      toast.success('Cuenta agregada ✓')
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
            {isEdit ? 'Editar cuenta' : 'Nueva cuenta'}
          </h2>
          <button onClick={onClose}
            className="btn-press w-8 h-8 rounded-full bg-[#151525] flex items-center justify-center">
            <X size={16} className="text-[#8B8BAD]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-4 space-y-4 overflow-y-auto max-h-[82vh]">

          {/* ── Institution ───────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Institución financiera</label>
            <select value={institution} onChange={e => setInstitution(e.target.value)} required>
              <option value="">Selecciona institución...</option>
              {INSTITUTIONS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          {/* ── Account type ──────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-2 block">Tipo de cuenta</label>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_TYPES.map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setType(t.key)}
                  className={`btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    type === t.key
                      ? 'bg-violet-600 text-white border-violet-500'
                      : 'bg-[#151525] text-[#8B8BAD] border-white/5'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Alias ─────────────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
              Apodo <span className="text-[#555577]">(opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ej: BBVA principal, Ahorro emergencia..."
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* ── Balance ───────────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Saldo actual (MXN)</label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              className="text-2xl font-bold"
            />
          </div>

          {/* ── Color picker ──────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-2 block">Color de tarjeta</label>
            <div className="flex gap-2 flex-wrap">
              {ACCOUNT_GRADIENTS.map((g, idx) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setColorIndex(idx)}
                  className={`w-12 h-7 rounded-lg bg-gradient-to-r ${g.css} btn-press transition-all ${
                    colorIndex === idx
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0E0E1A]'
                      : 'opacity-70'
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="btn-press w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold py-4 rounded-2xl text-base mt-2"
          >
            {isEdit ? 'Guardar cambios' : 'Agregar cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}

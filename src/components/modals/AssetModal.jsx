import { useState } from 'react'
import { X, ToggleLeft, ToggleRight } from 'lucide-react'
import useFinanceStore from '../../store/useFinanceStore.js'
import { ASSET_TYPES, LIABILITY_TYPES } from '../../store/defaultData.js'
import toast from 'react-hot-toast'

export default function AssetModal({ onClose, data }) {
  const { addAsset, updateAsset, addLiability, updateLiability } = useFinanceStore()

  // _isAsset: true → asset modal, false → liability modal
  const isAsset  = data?._isAsset !== false
  const typeList = isAsset ? ASSET_TYPES : LIABILITY_TYPES
  const isEdit   = Boolean(data?.id)

  const [name,     setName]     = useState(data?.name     || '')
  const [type,     setType]     = useState(data?.type     || typeList[0].key)
  // assets use `value`, liabilities use `amount` — handle both
  const [value,    setValue]    = useState(
    data?.value  != null ? String(data.value)  :
    data?.amount != null ? String(data.amount) : ''
  )
  const [notes,    setNotes]    = useState(data?.notes    || '')
  const [fecha,    setFecha]    = useState(data?.fecha    || '')
  const [isActive, setIsActive] = useState(data?.isActive !== false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim())                 { toast.error('Ingresa un nombre'); return }
    if (!value || Number(value) <= 0) { toast.error('Ingresa un valor válido'); return }

    if (isAsset) {
      const payload = {
        name: name.trim(), type,
        value: Number(value),
        notes: notes.trim(),
        fecha: fecha || null,
        isActive,
      }
      if (isEdit) { updateAsset(data.id, payload); toast.success('Activo actualizado') }
      else        { addAsset(payload);              toast.success('Activo agregado ✓')  }
    } else {
      const payload = {
        name: name.trim(), type,
        amount: Number(value),
        notes: notes.trim(),
        fecha: fecha || null,
        isActive,
      }
      if (isEdit) { updateLiability(data.id, payload); toast.success('Pasivo actualizado') }
      else        { addLiability(payload);              toast.success('Pasivo agregado ✓')  }
    }
    onClose()
  }

  const currentTypeInfo = typeList.find(t => t.key === type) ?? typeList[0]

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
            {isEdit
              ? `Editar ${isAsset ? 'activo' : 'pasivo'}`
              : `Nuevo ${isAsset ? 'activo' : 'pasivo'}`}
          </h2>
          <button onClick={onClose}
            className="btn-press w-8 h-8 rounded-full bg-[#151525] flex items-center justify-center">
            <X size={16} className="text-[#8B8BAD]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-4 space-y-4 overflow-y-auto max-h-[80vh]">

          {/* ── Type ─────────────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-2 block">Categoría</label>
            <div className="flex flex-wrap gap-2">
              {typeList.map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setType(t.key)}
                  className={`btn-press flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    type === t.key
                      ? isAsset
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-rose-600 text-white border-rose-500'
                      : 'bg-[#151525] text-[#8B8BAD] border-white/5'
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Name ─────────────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Nombre / descripción</label>
            <input
              type="text"
              placeholder={
                isAsset
                  ? currentTypeInfo.key === 'vehiculo'   ? 'Ej: Auto Nissan Versa 2022...'
                  : currentTypeInfo.key === 'inventario' ? 'Ej: Stock de bajos en CDMX...'
                  : currentTypeInfo.key === 'cobrar'     ? 'Ej: Cobro pendiente cliente X...'
                  : currentTypeInfo.key === 'bien_raiz'  ? 'Ej: Departamento CDMX...'
                  : 'Descripción del activo...'
                  : 'Ej: Préstamo banco, deuda empresa...'
              }
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          {/* ── Value ────────────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
              {isAsset ? 'Valor actual (MXN)' : 'Monto adeudado (MXN)'}
            </label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={value}
              onChange={e => setValue(e.target.value)}
              required
              className="text-2xl font-bold"
            />
          </div>

          {/* ── Fecha ────────────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
              Fecha de adquisición / registro <span className="text-[#555577]">(opcional)</span>
            </label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
            />
          </div>

          {/* ── Notes ────────────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
              Notas <span className="text-[#555577]">(opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Año, condición, tasa de interés, referencias..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* ── Estado activo/inactivo ───────────────────────── */}
          <div>
            <button
              type="button"
              onClick={() => setIsActive(v => !v)}
              className="btn-press w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all"
              style={{
                background: isActive ? 'rgba(5,150,105,0.08)' : 'rgba(75,82,119,0.08)',
                borderColor: isActive ? 'rgba(5,150,105,0.20)' : 'rgba(75,82,119,0.15)',
              }}
            >
              <div>
                <p className="text-sm font-semibold text-left" style={{ color: isActive ? '#059669' : 'var(--t2)' }}>
                  {isActive ? 'Activo' : 'Inactivo'}
                </p>
                <p className="text-xs text-left" style={{ color: 'var(--t3)' }}>
                  {isActive
                    ? 'Se incluye en el patrimonio neto'
                    : 'Excluido del cálculo de patrimonio'}
                </p>
              </div>
              {isActive
                ? <ToggleRight size={28} color="#059669" />
                : <ToggleLeft  size={28} color="var(--t3)" />}
            </button>
          </div>

          <button
            type="submit"
            className={`btn-press w-full text-white font-bold py-4 rounded-2xl text-base ${
              isAsset
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
                : 'bg-gradient-to-r from-rose-600 to-pink-600'
            }`}
          >
            {isEdit
              ? 'Guardar cambios'
              : `Agregar ${isAsset ? 'activo' : 'pasivo'}`}
          </button>
        </form>
      </div>
    </div>
  )
}

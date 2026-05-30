import { useState } from 'react'
import { X } from 'lucide-react'
import useFinanceStore from '../../store/useFinanceStore.js'
import { META_CATEGORIES } from '../../store/defaultData.js'
import toast from 'react-hot-toast'

const EMOJI_OPTIONS = ['🛡️','📈','💳','🏦','🎸','✈️','📚','🎯','🏠','🚗','💰','🎓','💊','🎮','🎵','🌟','🏋️','🐾','🔥','💎']

export default function MetaModal({ onClose, data }) {
  const { addMeta, updateMeta } = useFinanceStore()
  const isEdit = Boolean(data?.id)

  const [name,     setName]     = useState(data?.name     || '')
  const [emoji,    setEmoji]    = useState(data?.emoji    || '🎯')
  const [target,   setTarget]   = useState(data?.target   ? String(data.target)  : '')
  const [current,  setCurrent]  = useState(data?.current  ? String(data.current) : '0')
  const [category, setCategory] = useState(data?.category || 'otro')
  const [dueDate,  setDueDate]  = useState(data?.dueDate  || '')
  const [unit,     setUnit]     = useState(data?.unit     || '')
  const [notes,    setNotes]    = useState(data?.notes    || '')

  const isUnit   = unit.trim() !== '' && unit.trim() !== 'MXN'
  const pct      = Number(target) > 0 ? Math.min(100, (Number(current) / Number(target)) * 100) : 0
  const faltante = Math.max(0, Number(target) - Number(current))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim())                 { toast.error('Escribe el nombre de la meta'); return }
    if (!target || Number(target) <= 0) { toast.error('Ingresa el objetivo'); return }

    const payload = {
      name:     name.trim(),
      emoji,
      target:   Number(target),
      current:  Number(current) || 0,
      category,
      dueDate:  dueDate || null,
      unit:     unit.trim() || null,
      notes:    notes.trim(),
    }

    if (isEdit) {
      updateMeta(data.id, payload)
      toast.success('Meta actualizada')
    } else {
      addMeta(payload)
      toast.success(`${emoji} Meta creada`)
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
            {isEdit ? 'Editar meta' : 'Nueva meta'}
          </h2>
          <button onClick={onClose}
            className="btn-press w-8 h-8 rounded-full bg-[#151525] flex items-center justify-center">
            <X size={16} className="text-[#8B8BAD]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-4 space-y-4 overflow-y-auto max-h-[80vh]">

          {/* Emoji picker */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-2 block">Ícono</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map(e => (
                <button key={e} type="button" onClick={() => setEmoji(e)}
                  className={`btn-press w-9 h-9 rounded-xl text-xl flex items-center justify-center ${
                    emoji === e ? 'ring-2 ring-violet-500' : ''
                  }`}
                  style={{ background: emoji === e ? 'rgba(124,58,237,0.2)' : '#151525' }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Nombre de la meta</label>
            <input type="text" placeholder="Ej: Fondo de emergencia, Capital IBKR..."
              value={name} onChange={e => setName(e.target.value)} required />
          </div>

          {/* Category */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-2 block">Categoría</label>
            <div className="flex gap-2 flex-wrap">
              {META_CATEGORIES.map(c => (
                <button key={c.key} type="button" onClick={() => setCategory(c.key)}
                  className={`btn-press flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    category === c.key
                      ? 'bg-violet-600 text-white border-violet-500'
                      : 'bg-[#151525] text-[#8B8BAD] border-white/5'
                  }`}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Unit (optional) */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
              Unidad <span className="text-[#555577]">(vacío = MXN, o escribe "ventas", "libros", etc.)</span>
            </label>
            <input type="text" placeholder="MXN, ventas, libros, kg..."
              value={unit} onChange={e => setUnit(e.target.value)} />
          </div>

          {/* Target + Current */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
                Objetivo {isUnit ? `(${unit})` : '(MXN)'}
              </label>
              <input type="number" inputMode="decimal" placeholder="0"
                value={target} onChange={e => setTarget(e.target.value)} required />
            </div>
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
                Actual {isUnit ? `(${unit})` : '(MXN)'}
              </label>
              <input type="number" inputMode="decimal" placeholder="0"
                value={current} onChange={e => setCurrent(e.target.value)} />
            </div>
          </div>

          {/* Progress preview */}
          {Number(target) > 0 && (
            <div className="p-3 rounded-xl fade-in"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <div className="flex justify-between text-xs mb-2">
                <span style={{ color: 'var(--t3)' }}>Progreso</span>
                <span className="text-white font-bold">{pct.toFixed(0)}%</span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.1)' }}>
                <div className="h-full rounded-full bg-violet-500 transition-all"
                  style={{ width: `${pct}%` }} />
              </div>
              {!isUnit && (
                <p className="text-xs mt-1.5" style={{ color: 'var(--t3)' }}>
                  Faltante: <span className="text-amber-400 font-semibold">{faltante.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 })}</span>
                </p>
              )}
            </div>
          )}

          {/* Due date */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
              Fecha objetivo <span className="text-[#555577]">(opcional)</span>
            </label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
              Notas <span className="text-[#555577]">(opcional)</span>
            </label>
            <input type="text" placeholder="Estrategia, descripción..."
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <button type="submit"
            className="btn-press w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold py-4 rounded-2xl text-base mt-2">
            {isEdit ? 'Guardar cambios' : 'Crear meta'}
          </button>
        </form>
      </div>
    </div>
  )
}

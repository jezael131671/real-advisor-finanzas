import { useState } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import useFinanceStore from '../store/useFinanceStore.js'
import { getAccountGradient } from '../store/selectors.js'
import { fmx } from '../lib/formatters.js'
import { ACCOUNT_TYPES } from '../store/defaultData.js'
import toast from 'react-hot-toast'

export default function Cuentas({ openModal }) {
  const { accounts, deleteAccount } = useFinanceStore()
  const [hideBalances, setHideBalances] = useState(false)
  const [confirmDel,   setConfirmDel]   = useState(null)

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance || 0), 0)
  const typeLabel    = (key) => ACCOUNT_TYPES.find(t => t.key === key)?.label ?? key

  const handleDelete = (id) => {
    deleteAccount(id)
    setConfirmDel(null)
    toast.success('Cuenta eliminada')
  }

  return (
    <div className="mb-nav">
      {/* Header */}
      <div className="px-5 pt-14 pt-safe flex justify-between items-center mb-2">
        <h1 className="text-2xl font-black" style={{ color: 'var(--t1)' }}>Mis Cuentas</h1>
        <div className="flex gap-2">
          <button onClick={() => setHideBalances(v => !v)}
            className="btn-press w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'var(--s1)', border: '1px solid var(--border)' }}>
            {hideBalances ? <EyeOff size={15} color="var(--t2)" /> : <Eye size={15} color="var(--t2)" />}
          </button>
          <button onClick={() => openModal('account', null)}
            className="btn-press flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            <Plus size={15} strokeWidth={2.5} /> Agregar
          </button>
        </div>
      </div>

      {/* Total */}
      <div className="px-5 mb-5">
        <div className="card">
          <p className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--t3)' }}>
            Total en cuentas
          </p>
          <p className="text-3xl font-black text-emerald-600">
            {hideBalances ? '••••••' : fmx(totalBalance)}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
            {accounts.length} cuenta{accounts.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="px-5">
          <div className="card text-center py-12">
            <p className="text-4xl mb-4">🏦</p>
            <p className="font-semibold mb-1" style={{ color: 'var(--t1)' }}>Sin cuentas registradas</p>
            <p className="text-sm mb-6" style={{ color: 'var(--t2)' }}>Agrega tu primera cuenta o efectivo</p>
            <button onClick={() => openModal('account', null)}
              className="btn-primary" style={{ maxWidth: 200, margin: '0 auto' }}>
              Agregar cuenta
            </button>
          </div>
        </div>
      ) : (
        <div className="px-5 space-y-4">
          {accounts.map(a => (
            <div key={a.id} className="fade-up">
              {/* Card visual */}
              <div className={`bg-gradient-to-br ${getAccountGradient(a.colorIndex)} rounded-3xl p-5 relative overflow-hidden mb-2`}>
                <div className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.22), transparent)' }} />
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.07)' }} />
                <div className="relative">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-white/70 text-xs font-medium">{a.institution}</p>
                      <p className="text-white font-black text-lg leading-tight">{a.name}</p>
                      {a.alias && a.alias !== a.name && (
                        <p className="text-white/50 text-xs">{a.alias}</p>
                      )}
                    </div>
                    <span className="text-xl">{ACCOUNT_TYPES.find(t => t.key === a.type)?.icon ?? '💳'}</span>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs uppercase tracking-wider mb-0.5">Saldo actual</p>
                    <p className="text-white font-black text-2xl">
                      {hideBalances ? '••••••' : fmx(a.balance)}
                    </p>
                  </div>
                  <p className="text-white/50 text-xs mt-3">{typeLabel(a.type)}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button onClick={() => openModal('account', a)}
                  className="btn-press flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--s1)', border: '1px solid var(--border)', color: 'var(--t1)' }}>
                  <Pencil size={14} /> Editar
                </button>
                <button onClick={() => setConfirmDel(a.id)}
                  className="btn-press w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.15)' }}>
                  <Trash2 size={15} color="#E11D48" />
                </button>
              </div>

              {confirmDel === a.id && (
                <div className="mt-2 p-4 rounded-2xl fade-in"
                  style={{ background: 'rgba(225,29,72,0.06)', border: '1px solid rgba(225,29,72,0.15)' }}>
                  <p className="text-sm font-semibold text-center mb-3" style={{ color: 'var(--t1)' }}>
                    ¿Eliminar "{a.name}"?
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDel(null)} className="btn-ghost flex-1 py-2 text-sm">
                      Cancelar
                    </button>
                    <button onClick={() => handleDelete(a.id)}
                      className="btn-press flex-1 py-2 rounded-xl text-sm font-bold"
                      style={{ background: '#E11D48', color: '#fff' }}>
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

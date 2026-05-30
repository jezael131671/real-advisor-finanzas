import { useState, useMemo } from 'react'
import { Plus, Search, Trash2, Pencil, Copy } from 'lucide-react'
import useFinanceStore from '../store/useFinanceStore.js'
import { fmx, fmtDate, signOf, amtColor } from '../lib/formatters.js'
import { TX_TYPES, TX_LABELS } from '../store/defaultData.js'
import toast from 'react-hot-toast'

const TYPE_FILTERS = [{ key: 'all', label: 'Todos' }, ...TX_TYPES.map(t => ({ key: t.key, label: t.label }))]

const LABEL_COLORS = {
  personal:    'badge-blue',
  negocio:     'badge-violet',
  inversion:   'badge-green',
  bajoquintos: 'badge-amber',
}

export default function Movimientos({ openModal }) {
  const {
    transactions, accounts, cards, categories,
    deleteTransaction, duplicateTransaction,
  } = useFinanceStore()

  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => transactions.filter(t => {
    if (filter !== 'all' && t.type !== filter) return false
    if (search && !t.description?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [transactions, filter, search])

  const accountName = (id) => accounts.find(a => a.id === id)?.name ?? 'Efectivo'
  const cardName    = (id) => cards.find(c => c.id === id)?.bankName ?? 'Tarjeta'
  const catEmoji    = (name) => {
    const cat = categories.find(c => c.name === name || c.id === name)
    return cat?.emoji ?? '💰'
  }

  const txType = (key) => TX_TYPES.find(t => t.key === key)

  const handleDelete = (id) => {
    deleteTransaction(id)
    toast.success('Movimiento eliminado')
  }

  const handleDuplicate = (id) => {
    duplicateTransaction(id)
    toast.success('Movimiento duplicado')
  }

  // Group by date
  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(tx => {
      const d = tx.date || tx.createdAt?.split('T')[0] || 'Sin fecha'
      if (!map[d]) map[d] = []
      map[d].push(tx)
    })
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  const dayNet = (txs) =>
    txs.reduce((s, t) =>
      s + (t.type === 'ingreso' || t.type === 'bajoquinto' ? Number(t.amount) : -Number(t.amount)), 0)

  return (
    <div className="mb-nav">
      <div className="px-5 pt-14 pt-safe flex justify-between items-center mb-4">
        <h1 className="text-2xl font-black" style={{ color: 'var(--t1)' }}>Movimientos</h1>
        <button onClick={() => openModal('transaction', { type: 'gasto' })}
          className="btn-press flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          <Plus size={15} strokeWidth={2.5} /> Nuevo
        </button>
      </div>

      {/* Search */}
      <div className="px-5 mb-3 relative">
        <Search size={15} className="absolute left-9 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--t3)' }} />
        <input type="text" placeholder="Buscar movimiento..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 38 }} />
      </div>

      {/* Type filters */}
      <div className="px-5 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TYPE_FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className="btn-press shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
              style={filter === f.key
                ? { background: 'var(--accent)', color: '#fff' }
                : { background: 'var(--s1)', color: 'var(--t2)', border: '1px solid var(--border)' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-5">
          <div className="card text-center py-10">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-sm" style={{ color: 'var(--t2)' }}>
              {search ? 'Sin resultados' : 'Sin movimientos'}
            </p>
          </div>
        </div>
      ) : (
        <div className="px-5 space-y-5">
          {grouped.map(([date, txs]) => (
            <div key={date}>
              {/* Date row */}
              <div className="flex items-center gap-3 mb-2">
                <p className="text-xs font-bold uppercase tracking-wide shrink-0" style={{ color: 'var(--t3)' }}>
                  {fmtDate(date)}
                </p>
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <p className={`text-xs font-bold shrink-0 ${dayNet(txs) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {dayNet(txs) >= 0 ? '+' : ''}{fmx(dayNet(txs))}
                </p>
              </div>

              {/* Transactions */}
              <div className="space-y-2">
                {txs.map(tx => {
                  const tt = txType(tx.type)
                  return (
                    <div key={tx.id} className="card">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                          style={{ background: 'var(--s2)' }}>
                          {tt?.emoji ?? '💰'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--t1)' }}>
                            {tx.description}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {tx.category && (
                              <span className="text-[10px]">{catEmoji(tx.category)}</span>
                            )}
                            <p className="text-xs truncate" style={{ color: 'var(--t3)' }}>
                              {tx.cardId ? cardName(tx.cardId) : accountName(tx.accountId)}
                              {tx.targetAccountId && ` → ${accountName(tx.targetAccountId)}`}
                            </p>
                            {/* Labels */}
                            {(tx.labels || []).map(l => {
                              const lDef = TX_LABELS.find(x => x.key === l)
                              return lDef ? (
                                <span key={l}
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${LABEL_COLORS[l] ?? 'badge-gray'}`}>
                                  {lDef.label}
                                </span>
                              ) : null
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <p className={`font-bold text-sm ${amtColor(tx.type)}`}>
                            {signOf(tx.type)}{fmx(tx.amount)}
                          </p>
                          {/* Edit */}
                          <button onClick={() => openModal('transaction', tx)}
                            className="btn-press w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
                            <Pencil size={12} color="var(--t2)" />
                          </button>
                          {/* Duplicate */}
                          <button onClick={() => handleDuplicate(tx.id)}
                            className="btn-press w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
                            <Copy size={12} color="var(--t2)" />
                          </button>
                          {/* Delete */}
                          <button onClick={() => handleDelete(tx.id)}
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import useFinanceStore from '../store/useFinanceStore.js'
import { computeStats } from '../store/selectors.js'
import { fmx } from '../lib/formatters.js'
import { ASSET_TYPES, LIABILITY_TYPES } from '../store/defaultData.js'
import toast from 'react-hot-toast'

// ── Helpers ────────────────────────────────────────────────────────────────────
const typeOf = (key, list) => list.find(t => t.key === key) ?? { label: key, emoji: '💰' }

const fmt = (n) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `$${(abs / 1_000).toFixed(0)}K`
  return fmx(n)
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function Bar({ pct, color = 'bg-emerald-500', h = 5 }) {
  return (
    <div className="rounded-full overflow-hidden" style={{ height: h, background: 'var(--s3)' }}>
      <div
        className={`h-full rounded-full ${color} transition-all duration-500`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}

function EmptyState({ isAsset, onAdd }) {
  return (
    <div className="card text-center py-10">
      <p className="text-4xl mb-3">{isAsset ? '📦' : '💸'}</p>
      <p className="font-bold mb-1" style={{ color: 'var(--t1)' }}>
        Sin {isAsset ? 'activos' : 'pasivos'} registrados
      </p>
      <p className="text-sm mb-4" style={{ color: 'var(--t3)' }}>
        Agrega tu primer {isAsset ? 'activo físico o derechos' : 'pasivo o deuda'} para calcular tu patrimonio
      </p>
      <button
        onClick={onAdd}
        className="btn-press inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold"
        style={{ background: 'rgba(79,70,229,0.08)', color: 'var(--accent)', border: '1px solid rgba(79,70,229,0.15)' }}
      >
        <Plus size={14} /> Agregar {isAsset ? 'activo' : 'pasivo'}
      </button>
    </div>
  )
}

function ItemCard({ item, isAsset, typeList, onEdit, onDelete }) {
  const ti       = typeOf(item.type, typeList)
  const val      = isAsset ? Number(item.value || 0) : Number(item.amount || 0)
  const active   = item.isActive !== false

  return (
    <div
      className="card"
      style={{ opacity: active ? 1 : 0.55, transition: 'opacity 0.2s' }}
    >
      <div className="flex items-start gap-3">
        {/* Category icon */}
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0"
          style={{
            background: isAsset
              ? 'rgba(5,150,105,0.09)'
              : 'rgba(225,29,72,0.07)',
          }}
        >
          {ti.emoji}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold leading-snug" style={{ color: 'var(--t1)' }}>
              {item.name}
            </p>
            <p className={`text-base font-black shrink-0 ${isAsset ? 'text-emerald-600' : 'text-rose-600'}`}>
              {fmx(val)}
            </p>
          </div>

          {/* Tags row */}
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium"
              style={{ background: 'var(--s2)', color: 'var(--t2)' }}
            >
              {ti.label}
            </span>

            {item.fecha && (
              <span className="text-xs" style={{ color: 'var(--t3)' }}>
                📅 {item.fecha}
              </span>
            )}

            {!active && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(75,82,119,0.10)', color: 'var(--t3)' }}
              >
                Inactivo
              </span>
            )}
          </div>

          {/* Notes */}
          {item.notes && (
            <p className="text-xs mt-1.5 line-clamp-2" style={{ color: 'var(--t3)' }}>
              {item.notes}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={onEdit}
          className="btn-press flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold"
          style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--border)' }}
        >
          <Pencil size={12} /> Editar
        </button>
        <button
          onClick={onDelete}
          className="btn-press flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
          style={{ background: 'rgba(225,29,72,0.07)', color: '#E11D48' }}
        >
          <Trash2 size={12} /> Eliminar
        </button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ActivosPasivos({ openModal }) {
  const store = useFinanceStore()
  const { assets, liabilities, deleteAsset, deleteLiability } = store

  const [tab,    setTab]    = useState('activos')
  const [filter, setFilter] = useState('todos') // todos | activos | inactivos

  // Full stats (includes accounts + investments)
  const stats = useMemo(() => computeStats(store), [store])

  // Active items (for totals + breakdown)
  const activeAssets = useMemo(() => assets.filter(a => a.isActive !== false),      [assets])
  const activeLiabs  = useMemo(() => liabilities.filter(l => l.isActive !== false), [liabilities])

  const totalManualAssets = activeAssets.reduce((s, a) => s + Number(a.value || 0), 0)
  const totalManualLiabs  = activeLiabs.reduce((s, l)  => s + Number(l.amount || 0), 0)

  // Category breakdowns
  const assetByCategory = useMemo(() => {
    const groups = {}
    activeAssets.forEach(a => {
      groups[a.type] = (groups[a.type] || 0) + Number(a.value || 0)
    })
    return Object.entries(groups)
      .map(([key, total]) => ({ key, total, info: typeOf(key, ASSET_TYPES) }))
      .sort((a, b) => b.total - a.total)
  }, [activeAssets])

  const liabByCategory = useMemo(() => {
    const groups = {}
    activeLiabs.forEach(l => {
      groups[l.type] = (groups[l.type] || 0) + Number(l.amount || 0)
    })
    return Object.entries(groups)
      .map(([key, total]) => ({ key, total, info: typeOf(key, LIABILITY_TYPES) }))
      .sort((a, b) => b.total - a.total)
  }, [activeLiabs])

  // Filtered list for display
  const filteredAssets = useMemo(() => assets.filter(a => {
    if (filter === 'activos')   return a.isActive !== false
    if (filter === 'inactivos') return a.isActive === false
    return true
  }), [assets, filter])

  const filteredLiabs = useMemo(() => liabilities.filter(l => {
    if (filter === 'activos')   return l.isActive !== false
    if (filter === 'inactivos') return l.isActive === false
    return true
  }), [liabilities, filter])

  const nw         = stats.netWorth
  const nwPositive = nw >= 0
  const totalAll   = stats.totalAssets + stats.totalLiabilities

  // Proportions for the stacked bar
  const cashPct  = totalAll > 0 ? (stats.totalCash        / totalAll) * 100 : 0
  const invPct   = totalAll > 0 ? (stats.investmentValue  / totalAll) * 100 : 0
  const manPct   = totalAll > 0 ? (totalManualAssets       / totalAll) * 100 : 0
  const liabPct  = totalAll > 0 ? (stats.totalLiabilities / totalAll) * 100 : 0

  const openAdd = (isA) => openModal('asset', isA ? { _isAsset: true } : { _isAsset: false })

  return (
    <div className="mb-nav">
      <div className="px-5 pt-14 pt-safe">

        {/* ── Hero ──────────────────────────────────────────────────── */}
        <div
          className="rounded-3xl p-5 mb-5"
          style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #1E3A5F 100%)' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Patrimonio neto
          </p>
          <p className={`text-4xl font-black mb-0.5 ${nwPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fmx(nw)}
          </p>
          <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.38)' }}>
            Cuentas · Inversiones · Activos físicos − Pasivos
          </p>

          {/* Stacked bar */}
          {totalAll > 0 && (
            <div className="mb-5">
              <div className="flex rounded-full overflow-hidden mb-1.5" style={{ height: 7, background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full bg-sky-400   transition-all" style={{ width: `${cashPct}%` }} />
                <div className="h-full bg-violet-400 transition-all" style={{ width: `${invPct}%`  }} />
                <div className="h-full bg-emerald-400 transition-all" style={{ width: `${manPct}%` }} />
                <div className="h-full bg-rose-400   transition-all" style={{ width: `${liabPct}%` }} />
              </div>
              <div className="flex gap-3 flex-wrap">
                {[
                  { dot: 'bg-sky-400',    label: 'Cuentas' },
                  { dot: 'bg-violet-400', label: 'Inversiones' },
                  { dot: 'bg-emerald-400',label: 'Físicos' },
                  { dot: 'bg-rose-400',   label: 'Pasivos' },
                ].map(({ dot, label }) => (
                  <div key={label} className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${dot}`} />
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3-col breakdown */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Cuentas',     val: stats.totalCash,       color: 'text-sky-300' },
              { label: 'Inversiones', val: stats.investmentValue,  color: 'text-violet-300' },
              { label: 'Activos fís.', val: totalManualAssets,     color: 'text-emerald-300' },
            ].map(({ label, val, color }) => (
              <div key={label} className="rounded-2xl p-2.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <p className="text-xs mb-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.42)' }}>{label}</p>
                <p className={`text-sm font-bold ${color}`}>{fmt(val)}</p>
              </div>
            ))}
          </div>

          {/* Pasivos row */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[
              { label: 'Tarjetas',       val: stats.totalCardDebt,    color: 'text-rose-300' },
              { label: 'Pasivos manuales', val: totalManualLiabs,     color: 'text-rose-300' },
            ].map(({ label, val, color }) => (
              <div key={label} className="rounded-2xl p-2.5" style={{ background: 'rgba(225,29,72,0.10)' }}>
                <p className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>{label}</p>
                <p className={`text-sm font-bold ${color}`}>{fmt(val)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────── */}
        <div className="seg-wrap mb-4">
          <button
            className={`seg-btn ${tab === 'activos' ? 'active' : ''}`}
            onClick={() => setTab('activos')}
          >
            Activos {activeAssets.length > 0 && `(${activeAssets.length})`}
          </button>
          <button
            className={`seg-btn ${tab === 'pasivos' ? 'active' : ''}`}
            onClick={() => setTab('pasivos')}
          >
            Pasivos {activeLiabs.length > 0 && `(${activeLiabs.length})`}
          </button>
        </div>

        {/* ── Category breakdown ───────────────────────────────────── */}
        {tab === 'activos' && assetByCategory.length > 0 && (
          <div className="card mb-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-bold" style={{ color: 'var(--t1)' }}>Por categoría</p>
              <p className="text-sm font-black text-emerald-600">{fmx(totalManualAssets)}</p>
            </div>
            <div className="space-y-3">
              {assetByCategory.map(({ key, total, info }) => {
                const pct = totalManualAssets > 0 ? (total / totalManualAssets) * 100 : 0
                return (
                  <div key={key}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{info.emoji}</span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--t2)' }}>{info.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--t3)' }}>{pct.toFixed(0)}%</span>
                        <span className="text-xs font-bold text-emerald-600">{fmx(total)}</span>
                      </div>
                    </div>
                    <Bar pct={pct} color="bg-emerald-500" />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'pasivos' && liabByCategory.length > 0 && (
          <div className="card mb-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-bold" style={{ color: 'var(--t1)' }}>Por categoría</p>
              <p className="text-sm font-black text-rose-600">{fmx(totalManualLiabs)}</p>
            </div>
            <div className="space-y-3">
              {liabByCategory.map(({ key, total, info }) => {
                const pct = totalManualLiabs > 0 ? (total / totalManualLiabs) * 100 : 0
                return (
                  <div key={key}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{info.emoji}</span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--t2)' }}>{info.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--t3)' }}>{pct.toFixed(0)}%</span>
                        <span className="text-xs font-bold text-rose-600">{fmx(total)}</span>
                      </div>
                    </div>
                    <Bar pct={pct} color="bg-rose-500" />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Filter + Add button ───────────────────────────────── */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1.5">
            {[
              { key: 'todos',    label: 'Todos'     },
              { key: 'activos',  label: 'Activos'   },
              { key: 'inactivos',label: 'Inactivos' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="btn-press px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={filter === f.key
                  ? { background: 'var(--accent)', color: '#fff', border: '1px solid transparent' }
                  : { background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--border)' }
                }
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => openAdd(tab === 'activos')}
            className="btn-press flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(79,70,229,0.08)', color: 'var(--accent)', border: '1px solid rgba(79,70,229,0.15)' }}
          >
            <Plus size={14} /> Agregar
          </button>
        </div>

        {/* ── Items list ────────────────────────────────────────── */}
        {tab === 'activos' ? (
          filteredAssets.length === 0 ? (
            <EmptyState isAsset onAdd={() => openAdd(true)} />
          ) : (
            <div className="space-y-3">
              {filteredAssets.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  isAsset
                  typeList={ASSET_TYPES}
                  onEdit={() => openModal('asset', { ...item, _isAsset: true })}
                  onDelete={() => { deleteAsset(item.id); toast.success('Activo eliminado') }}
                />
              ))}
            </div>
          )
        ) : (
          filteredLiabs.length === 0 ? (
            <EmptyState isAsset={false} onAdd={() => openAdd(false)} />
          ) : (
            <div className="space-y-3">
              {filteredLiabs.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  isAsset={false}
                  typeList={LIABILITY_TYPES}
                  onEdit={() => openModal('asset', { ...item, _isAsset: false })}
                  onDelete={() => { deleteLiability(item.id); toast.success('Pasivo eliminado') }}
                />
              ))}
            </div>
          )
        )}

        {/* ── Info note ─────────────────────────────────────────── */}
        <div
          className="mt-5 p-3 rounded-2xl"
          style={{ background: 'rgba(79,70,229,0.05)', border: '1px solid rgba(79,70,229,0.10)' }}
        >
          <p className="text-xs" style={{ color: 'var(--accent)' }}>
            💡 Las cuentas e inversiones se suman automáticamente al patrimonio. Usa esta sección para activos físicos, inventario, vehículos, cuentas por cobrar y cualquier deuda adicional.
          </p>
        </div>

        <div className="h-8" />
      </div>
    </div>
  )
}

import { useMemo } from 'react'
import { CreditCard, ArrowUpDown, Guitar, TrendingUp, Scale, BarChart3, Calendar, Bell, Settings, X, Target, Droplets, BrainCircuit, CalendarCheck, LineChart, BookOpen, FileBarChart2, Camera } from 'lucide-react'
import useFinanceStore   from '../store/useFinanceStore.js'
import { computeAlerts } from '../store/selectors.js'

const MENU_ITEMS = [
  { key: 'advisor',      label: 'Advisor',         icon: BrainCircuit,    color: '#7C3AED' },
  { key: 'reporte',      label: 'Reporte',         icon: FileBarChart2,   color: '#DB2777' },
  { key: 'planner',      label: 'Planner',         icon: CalendarCheck,   color: '#0D9488' },
  { key: 'evolucion',    label: 'Evolución',       icon: LineChart,       color: '#10B981' },
  { key: 'cashflow',     label: 'Flujo de Caja',  icon: Droplets,      color: '#0891B2' },
  { key: 'cards',        label: 'Tarjetas',       icon: CreditCard,  color: '#4F46E5' },
  { key: 'movimientos',  label: 'Movimientos',    icon: ArrowUpDown, color: '#059669' },
  { key: 'libro',        label: 'Libro Mayor',    icon: BookOpen,    color: '#0891B2' },
  { key: 'bajoquintos',  label: 'Bajoquintos',    icon: Guitar,      color: '#D97706' },
  { key: 'inversiones',  label: 'Inversiones',    icon: TrendingUp,  color: '#2563EB' },
  { key: 'activos',      label: 'Activos/Pasivos', icon: Scale,      color: '#DB2777' },
  { key: 'balance',      label: 'Balance',        icon: BarChart3,   color: '#7C3AED' },
  { key: 'suscripciones',label: 'Suscripciones',  icon: Calendar,    color: '#0891B2' },
  { key: 'metas',        label: 'Metas',          icon: Target,      color: '#16A34A' },
  { key: 'alertas',      label: 'Alertas',        icon: Bell,        color: '#EA580C' },
  { key: 'config',       label: 'Configuración',  icon: Settings,    color: '#64748B' },
]

// ── "Actualizar con captura" hero action ──────────────────────────────────
function CaptureHero({ onCapture }) {
  return (
    <button
      onClick={onCapture}
      className="btn-press w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-3"
      style={{
        background: 'linear-gradient(135deg, rgba(79,70,229,0.18), rgba(99,102,241,0.12))',
        border: '1px solid rgba(79,70,229,0.30)',
      }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'linear-gradient(135deg,#4F46E5,#818CF8)' }}>
        <Camera size={20} color="#fff" />
      </div>
      <div className="text-left">
        <p className="text-sm font-black" style={{ color: 'var(--t1)' }}>Actualizar con captura</p>
        <p className="text-[11px]" style={{ color: '#818CF8' }}>BBVA · Nu · IBKR · Stori · DiDi · Revolut</p>
      </div>
      <div className="ml-auto text-[10px] font-bold px-2 py-1 rounded-lg"
        style={{ background: 'rgba(79,70,229,0.25)', color: '#818CF8' }}>
        NUEVO
      </div>
    </button>
  )
}

export default function MenuSheet({ onClose, setTab, openModal }) {
  const state      = useFinanceStore()
  const alertCount = useMemo(() => computeAlerts(state).length, [
    state.accounts, state.cards, state.transactions,
    state.bajoquintos, state.subscriptions,
  ])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center fade-in">
      <div className="absolute inset-0"
        style={{ background: 'rgba(10,14,40,0.40)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        onClick={onClose} />

      <div
        className="relative w-full max-w-lg slide-up"
        style={{
          background: 'var(--s1)',
          borderRadius: '28px 28px 0 0',
          borderTop: '1px solid var(--border)',
          paddingBottom: 'env(safe-area-inset-bottom, 20px)',
          boxShadow: '0 -8px 40px rgba(0,10,50,0.12)',
        }}
      >
        <div className="drag-handle" />

        <div className="px-5 pb-2 pt-3 flex justify-between items-center">
          <h2 className="text-lg font-black" style={{ color: 'var(--t1)' }}>Todas las secciones</h2>
          <button onClick={onClose} className="btn-press w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
            <X size={16} color="var(--t2)" />
          </button>
        </div>

        {/* ── Capture hero ── */}
        <div className="px-5 pt-1 pb-0">
          <CaptureHero onCapture={() => { onClose(); openModal('capture') }} />
        </div>

        <div className="px-5 pb-4 pt-2 grid grid-cols-3 gap-3">
          {MENU_ITEMS.map(item => {
            const Icon  = item.icon
            const badge = item.key === 'alertas' && alertCount > 0

            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className="btn-press flex flex-col items-center gap-2 py-4 px-2 rounded-2xl"
                style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${item.color}18` }}>
                    <Icon size={20} color={item.color} strokeWidth={2} />
                  </div>
                  {badge && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                      style={{ background: '#E11D48' }}>
                      {alertCount > 9 ? '9+' : alertCount}
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-center leading-tight" style={{ color: 'var(--t2)' }}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Quick actions */}
        <div className="px-5 pb-5">
          <p className="text-[11px] font-bold mb-3 uppercase tracking-wide" style={{ color: 'var(--t3)' }}>
            Acciones rápidas
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '💸 Nuevo gasto',      type: 'transaction', data: { type: 'gasto' }   },
              { label: '💰 Nuevo ingreso',    type: 'transaction', data: { type: 'ingreso' } },
              { label: '💳 Pagar tarjeta',    type: 'payment',     data: null                },
              { label: '🎸 Venta bajoquinto', type: 'bajoquinto',  data: null                },
            ].map(a => (
              <button key={a.label} onClick={() => { openModal(a.type, a.data); onClose() }}
                className="btn-press py-3 px-3 rounded-xl text-sm font-semibold text-left"
                style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--t1)' }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

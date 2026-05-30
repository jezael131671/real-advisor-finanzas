import { useMemo } from 'react'
import { Home, Wallet, Plus, Guitar, LayoutGrid } from 'lucide-react'
import useFinanceStore   from '../store/useFinanceStore.js'
import { computeAlerts } from '../store/selectors.js'

const NAV_TABS = [
  { key: 'dashboard',   icon: Home,        label: 'Inicio'   },
  { key: 'cuentas',     icon: Wallet,      label: 'Cuentas'  },
  { key: 'CENTER',      icon: null,        label: ''         },
  { key: 'bajoquintos', icon: Guitar,      label: 'Bajos'    },
  { key: 'MENU',        icon: LayoutGrid,  label: 'Más'      },
]

export default function Navigation({ tab, setTab, openModal, menuOpen, toggleMenu }) {
  const state      = useFinanceStore()
  const alertCount = useMemo(() => computeAlerts(state).length, [
    state.accounts, state.cards, state.transactions,
    state.bajoquintos, state.subscriptions,
  ])

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div
        className="border-t"
        style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderColor: 'rgba(0,10,50,0.08)',
          boxShadow: '0 -1px 0 rgba(0,10,50,0.06)',
        }}
      >
        <div className="flex items-center justify-around max-w-lg mx-auto px-2 pt-2 pb-1">
          {NAV_TABS.map((t) => {
            /* ── Center "+" button ── */
            if (t.key === 'CENTER') {
              return (
                <button
                  key="center"
                  onClick={() => openModal('transaction', { type: 'gasto' })}
                  className="btn-press -mt-5"
                  style={{
                    width: 52, height: 52,
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
                    boxShadow: '0 4px 20px rgba(79,70,229,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: 'none',
                  }}
                  aria-label="Nuevo movimiento"
                >
                  <Plus size={26} color="#fff" strokeWidth={2.5} />
                </button>
              )
            }

            /* ── "Más" menu toggle ── */
            if (t.key === 'MENU') {
              const Icon     = t.icon
              const isActive = menuOpen
              const badge    = alertCount > 0

              return (
                <button
                  key="menu"
                  onClick={toggleMenu}
                  className="btn-press flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl min-w-[52px]"
                >
                  <div className="relative">
                    <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8}
                      color={isActive ? '#4F46E5' : '#8B91B0'} />
                    {badge && !isActive && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                        style={{ background: '#E11D48' }}>
                        {alertCount > 9 ? '9+' : alertCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold" style={{ color: isActive ? '#4F46E5' : '#8B91B0' }}>
                    {t.label}
                  </span>
                </button>
              )
            }

            /* ── Regular tab ── */
            const Icon     = t.icon
            const isActive = tab === t.key && !menuOpen

            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="btn-press flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl min-w-[52px]"
              >
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8}
                  color={isActive ? '#4F46E5' : '#8B91B0'} />
                <span className="text-[10px] font-semibold"
                  style={{ color: isActive ? '#4F46E5' : '#8B91B0' }}>
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import useFinanceStore from './store/useFinanceStore.js'
import Navigation        from './components/Navigation.jsx'
import MenuSheet         from './components/MenuSheet.jsx'
import Dashboard         from './components/Dashboard.jsx'
import Cuentas           from './components/Cuentas.jsx'
import Cards             from './components/Cards.jsx'
import Movimientos       from './components/Movimientos.jsx'
import Bajoquintos       from './components/Bajoquintos.jsx'
import Inversiones       from './components/Inversiones.jsx'
import ActivosPasivos    from './components/ActivosPasivos.jsx'
import BalanceGeneral    from './components/BalanceGeneral.jsx'
import Suscripciones     from './components/Suscripciones.jsx'
import Alertas           from './components/Alertas.jsx'
import Configuracion     from './components/Configuracion.jsx'
import Metas             from './components/Metas.jsx'
import CashFlow             from './components/CashFlow.jsx'
import Advisor              from './components/Advisor.jsx'
import Planner              from './components/Planner.jsx'
import EvolucionPatrimonial from './components/EvolucionPatrimonial.jsx'
import LibroMayor           from './components/LibroMayor.jsx'
import ReporteEjecutivo     from './components/ReporteEjecutivo.jsx'

import TransactionModal   from './components/modals/TransactionModal.jsx'
import AccountModal       from './components/modals/AccountModal.jsx'
import CardModal          from './components/modals/CardModal.jsx'
import CardPaymentModal   from './components/modals/CardPaymentModal.jsx'
import BajoquintoModal    from './components/modals/BajoquintoModal.jsx'
import InversionModal     from './components/modals/InversionModal.jsx'
import AssetModal         from './components/modals/AssetModal.jsx'
import SubscriptionModal  from './components/modals/SubscriptionModal.jsx'
import MetaModal          from './components/modals/MetaModal.jsx'
import CaptureModal       from './components/modals/CaptureModal.jsx'

const SCREENS = {
  dashboard:    Dashboard,
  cuentas:      Cuentas,
  cards:        Cards,
  movimientos:  Movimientos,
  bajoquintos:  Bajoquintos,
  inversiones:  Inversiones,
  activos:      ActivosPasivos,
  balance:      BalanceGeneral,
  suscripciones:Suscripciones,
  alertas:      Alertas,
  config:       Configuracion,
  metas:        Metas,
  cashflow:     CashFlow,
  advisor:      Advisor,
  planner:      Planner,
  evolucion:    EvolucionPatrimonial,
  libro:        LibroMayor,
  reporte:      ReporteEjecutivo,
}

export default function App() {
  const [tab,       setTab]       = useState('dashboard')
  const [modal,     setModal]     = useState(null) // { type, data? }
  const [menuOpen,  setMenuOpen]  = useState(false)

  // Seed accounts, cards, and IBKR settings once on first launch
  const initializeWithSeedData = useFinanceStore(s => s.initializeWithSeedData)
  useEffect(() => { initializeWithSeedData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openModal  = (type, data) => setModal({ type, data })
  const closeModal = ()           => setModal(null)

  const navigateTo = (screen) => {
    setTab(screen)
    setMenuOpen(false)
  }

  const Screen = SCREENS[tab] ?? Dashboard
  const shared = { openModal, setTab: navigateTo }

  return (
    <div className="relative overflow-hidden" style={{ height: '100dvh', background: 'var(--bg)' }}>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2800,
          style: {
            background: '#fff',
            color: '#0C0E1A',
            border: '1px solid rgba(79,70,229,0.15)',
            borderRadius: '14px',
            fontSize: '14px',
            fontWeight: '600',
            padding: '12px 16px',
            boxShadow: '0 4px 20px rgba(0,10,50,0.10)',
          },
        }}
      />

      {/* Main scrollable area */}
      <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
        <Screen {...shared} />
      </div>

      {/* Fixed bottom navigation */}
      <Navigation tab={tab} setTab={navigateTo} openModal={openModal} menuOpen={menuOpen} toggleMenu={() => setMenuOpen(v => !v)} />

      {/* More sections sheet */}
      {menuOpen && <MenuSheet onClose={() => setMenuOpen(false)} setTab={navigateTo} openModal={openModal} />}

      {/* ── Global modals ── */}
      {modal?.type === 'transaction'   && <TransactionModal   onClose={closeModal} data={modal.data} />}
      {modal?.type === 'account'       && <AccountModal       onClose={closeModal} data={modal.data} />}
      {modal?.type === 'card'          && <CardModal          onClose={closeModal} data={modal.data} />}
      {modal?.type === 'payment'       && <CardPaymentModal   onClose={closeModal} data={modal.data} />}
      {modal?.type === 'bajoquinto'    && <BajoquintoModal    onClose={closeModal} data={modal.data} />}
      {modal?.type === 'inversion'     && <InversionModal     onClose={closeModal} data={modal.data} />}
      {modal?.type === 'asset'         && <AssetModal         onClose={closeModal} data={modal.data} />}
      {modal?.type === 'subscription'  && <SubscriptionModal  onClose={closeModal} data={modal.data} />}
      {modal?.type === 'meta'          && <MetaModal          onClose={closeModal} data={modal.data} />}
      {modal?.type === 'capture'       && <CaptureModal       onClose={closeModal} />}
    </div>
  )
}

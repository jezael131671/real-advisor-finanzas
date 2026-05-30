// ── useIBKR — React hook for IBKR sync integration ────────────────────────────
//
// Wraps ibkrService with React state management.
// Provides:
//   • sync()          trigger a manual sync
//   • status          { loading, error, syncedAt, latencyMs }
//   • authStatus      { ok, authenticated, mode }
//   • config          { mode, gatewayUrl, accountId, isMock }
//   • setMode()       switch mock ↔ real at runtime
//   • setGatewayUrl() update gateway URL at runtime
//   • setAccountId()  pin to a specific account ID
//
// Usage in a component:
//   import { useIBKR } from '../hooks/useIBKR'
//
//   const { sync, status, authStatus, config } = useIBKR()
//
//   <button onClick={sync} disabled={status.loading}>
//     {status.loading ? 'Sincronizando…' : 'Sincronizar IBKR'}
//   </button>

import { useState, useCallback, useRef, useEffect } from 'react'
import useFinanceStore from '../store/useFinanceStore.js'
import { ibkrService } from '../services/ibkrService.js'

// ── Initial state ─────────────────────────────────────────────────────────────
const INIT_STATUS = {
  loading:   false,
  error:     null,
  syncedAt:  null,
  latencyMs: null,
}

const INIT_AUTH = {
  ok:            false,
  authenticated: false,
  connected:     false,
  competing:     false,
  mode:          ibkrService.config.mode,
  message:       '',
}

// ─────────────────────────────────────────────────────────────────────────────
export function useIBKR() {
  const syncIBKRPositions = useFinanceStore(s => s.syncIBKRPositions)
  const updateSettings    = useFinanceStore(s => s.updateSettings)
  const investments       = useFinanceStore(s => s.investments)
  const settings          = useFinanceStore(s => s.settings)

  const [status,     setStatus]     = useState(INIT_STATUS)
  const [authStatus, setAuthStatus] = useState(INIT_AUTH)
  const [config,     setConfig]     = useState(ibkrService.config)

  // Stable ref so callbacks never re-capture stale investments
  const investmentsRef = useRef(investments)
  useEffect(() => { investmentsRef.current = investments }, [investments])

  // ── Restore persisted IBKR settings on mount ──────────────────────────────
  useEffect(() => {
    const ibkr = settings?.ibkr
    if (!ibkr) return
    if (ibkr.mode)       ibkrService.setMode(ibkr.mode)
    if (ibkr.gatewayUrl) ibkrService.setGatewayUrl(ibkr.gatewayUrl)
    if (ibkr.accountId)  ibkrService.setAccountId(ibkr.accountId)
    setConfig(ibkrService.config)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Check auth status ─────────────────────────────────────────────────────
  const checkAuth = useCallback(async () => {
    const result = await ibkrService.checkStatus()
    setAuthStatus(result)
    return result
  }, [])

  // ── Main sync ─────────────────────────────────────────────────────────────
  const sync = useCallback(async () => {
    setStatus(s => ({ ...s, loading: true, error: null }))

    const result = await ibkrService.sync(undefined, investmentsRef.current)

    if (result.ok) {
      // Push positions into store
      syncIBKRPositions(result.positions, result.summary)

      // Persist IBKR meta into settings
      updateSettings({
        ibkr: {
          ...(settings?.ibkr || {}),
          mode:             ibkrService.config.mode,
          gatewayUrl:       ibkrService.config.gatewayUrl,
          accountId:        result.accountId,
          syncedAt:         result.syncedAt.toISOString(),
          connectionStatus: 'connected',
          lastError:        null,
          lastNLV:          result.summary?.netLiquidation ?? null,
          lastCash:         result.summary?.totalCash      ?? null,
        },
      })

      setAuthStatus(prev => ({ ...prev, ok: true, authenticated: true }))
    } else {
      // Derive connection status from error type for dashboard display
      const err = result.error ?? ''
      const connectionStatus = err.includes('expirada') || err.includes('Sesión') || err.includes('competida')
        ? 'expired'
        : err.includes('Gateway') || err.includes('disponible') || err.includes('red')
          ? 'disconnected'
          : 'error'

      // Persist last error + status
      updateSettings({
        ibkr: {
          ...(settings?.ibkr || {}),
          connectionStatus,
          lastError: result.error,
        },
      })
    }

    setStatus({
      loading:   false,
      error:     result.error,
      syncedAt:  result.ok ? result.syncedAt : null,
      latencyMs: result.latencyMs,
    })

    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncIBKRPositions, updateSettings])

  // ── Config helpers ─────────────────────────────────────────────────────────
  const setMode = useCallback((mode) => {
    ibkrService.setMode(mode)
    setConfig(ibkrService.config)
    updateSettings({ ibkr: { ...(settings?.ibkr || {}), mode } })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateSettings])

  const setGatewayUrl = useCallback((url) => {
    ibkrService.setGatewayUrl(url)
    setConfig(ibkrService.config)
    updateSettings({ ibkr: { ...(settings?.ibkr || {}), gatewayUrl: url } })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateSettings])

  const setAccountId = useCallback((id) => {
    ibkrService.setAccountId(id)
    setConfig(ibkrService.config)
    updateSettings({ ibkr: { ...(settings?.ibkr || {}), accountId: id } })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateSettings])

  // ── Keep-alive lifecycle (real mode only) ──────────────────────────────────
  useEffect(() => {
    if (config.isReal) ibkrService.startKeepAlive()
    return () => ibkrService.stopKeepAlive()
  }, [config.isReal])

  return {
    // Actions
    sync,
    checkAuth,
    setMode,
    setGatewayUrl,
    setAccountId,

    // State
    status,       // { loading, error, syncedAt, latencyMs }
    authStatus,   // { ok, authenticated, connected, competing, mode, message }
    config,       // { mode, gatewayUrl, accountId, isMock, isReal }

    // Derived
    isMock:  config.isMock,
    isReal:  config.isReal,
    syncing: status.loading,
    lastSyncedAt: status.syncedAt || (settings?.ibkr?.syncedAt ? new Date(settings.ibkr.syncedAt) : null),
  }
}

export default useIBKR

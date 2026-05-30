import { useState, useRef } from 'react'
import {
  Plus, Pencil, Trash2,
  Download, Upload, RefreshCw, HardDrive, AlertTriangle,
  Server, Wifi, Loader2,
} from 'lucide-react'
import useFinanceStore from '../store/useFinanceStore.js'
import { DEFAULT_CATEGORIES, DEFAULT_METAS } from '../store/defaultData.js'
import { useIBKR } from '../hooks/useIBKR.js'
import toast from 'react-hot-toast'

// ── Constants ─────────────────────────────────────────────────────────────────
const BACKUP_KEY     = 'real-advisor-last-backup'
const SCHEMA_VERSION = 5
const APP_ID         = 'real-advisor-finanzas'
const STATE_KEYS     = [
  'accounts', 'cards', 'transactions', 'categories',
  'bajoquintos', 'investments', 'assets', 'liabilities',
  'subscriptions', 'metas', 'settings', 'cashflowItems', 'networthHistory',
]

const EMOJI_OPTIONS = [
  '🍕','🛒','⛽','🚗','💊','🎭','📚','👕','🏠','🔧',
  '📱','💰','💼','🎸','💻','🎁','📈','💵','🍔','✈️',
  '🎮','🎬','🐾','👶','💆','🏋️','⚽','🎵','☕','🍺',
]

const fmtDate = (iso) => {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return null }
}

// ── Confirmation inline card ──────────────────────────────────────────────────
function ConfirmCard({ mode, pending, onCancel, onConfirm }) {
  const isImport = mode === 'import'
  return (
    <div className="mt-3 p-4 rounded-2xl fade-in"
      style={{ background: 'rgba(225,29,72,0.06)', border: '1px solid rgba(225,29,72,0.22)' }}>
      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle size={15} color="#E11D48" className="shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold leading-tight" style={{ color: 'var(--t1)' }}>
            {isImport ? '¿Restaurar respaldo?' : '¿Restaurar estado demo?'}
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--t3)' }}>
            {isImport
              ? `Toda tu información actual será reemplazada con el respaldo del ${fmtDate(pending?.exportedAt) ?? '—'}. Esta acción no se puede deshacer.`
              : 'Se borrará toda tu información actual (cuentas, tarjetas, transacciones, etc.) y se restaurará el estado de demo limpio.'}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel}
          className="btn-ghost flex-1 py-2 text-xs rounded-xl font-semibold">
          Cancelar
        </button>
        <button onClick={onConfirm}
          className="btn-press flex-1 py-2 rounded-xl text-xs font-bold text-white"
          style={{ background: '#E11D48' }}>
          Confirmar
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Configuracion() {
  const { categories, addCategory, updateCategory, deleteCategory, restoreState } = useFinanceStore()

  // ── IBKR ─────────────────────────────────────────────────────────────────
  const ibkr = useIBKR()
  const [ibkrChecking,      setIbkrChecking]      = useState(false)
  const [ibkrGatewayInput,  setIbkrGatewayInput]  = useState(ibkr.config.gatewayUrl || 'https://localhost:5000')
  const [ibkrAccountInput,  setIbkrAccountInput]  = useState(ibkr.config.accountId  || '')

  // ── Categories state ──────────────────────────────────────────────────────
  const [catTab,   setCatTab]   = useState('gasto')
  const [adding,   setAdding]   = useState(false)
  const [editId,   setEditId]   = useState(null)
  const [newName,  setNewName]  = useState('')
  const [newEmoji, setNewEmoji] = useState('💰')

  // ── Backup state ─────────────────────────────────────────────────────────
  const [lastBackup,    setLastBackup]    = useState(() => localStorage.getItem(BACKUP_KEY))
  const [confirmMode,   setConfirmMode]   = useState(null)   // 'import' | 'demo' | null
  const [pendingImport, setPendingImport] = useState(null)   // parsed JSON payload
  const fileRef = useRef(null)

  const filteredCats = categories.filter(c => c.type === catTab)

  // ── Category handlers ────────────────────────────────────────────────────
  const handleSave = () => {
    if (!newName.trim()) { toast.error('Escribe un nombre'); return }
    if (editId) {
      updateCategory(editId, { name: newName.trim(), emoji: newEmoji })
      toast.success('Categoría actualizada')
      setEditId(null)
    } else {
      addCategory({ name: newName.trim(), emoji: newEmoji, type: catTab })
      toast.success('Categoría creada ✓')
      setAdding(false)
    }
    setNewName('')
    setNewEmoji('💰')
  }

  const handleEdit = (cat) => {
    setEditId(cat.id)
    setNewName(cat.name)
    setNewEmoji(cat.emoji)
    setAdding(false)
  }

  const handleDelete = (cat) => {
    if (cat.isDefault) { toast.error('No puedes eliminar categorías predeterminadas'); return }
    deleteCategory(cat.id)
    toast.success('Categoría eliminada')
  }

  const handleCancel = () => {
    setAdding(false)
    setEditId(null)
    setNewName('')
    setNewEmoji('💰')
  }

  // ── Backup: Export ────────────────────────────────────────────────────────
  const handleExport = () => {
    const s = useFinanceStore.getState()
    const payload = {
      app:           APP_ID,
      schemaVersion: SCHEMA_VERSION,
      exportedAt:    new Date().toISOString(),
      state:         Object.fromEntries(STATE_KEYS.map(k => [k, s[k]])),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `real-advisor-respaldo-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)

    const ts = new Date().toISOString()
    localStorage.setItem(BACKUP_KEY, ts)
    setLastBackup(ts)
    toast.success('Respaldo exportado ✓')
  }

  // ── Backup: Import ────────────────────────────────────────────────────────
  const handleImportClick = () => {
    setConfirmMode(null)
    setPendingImport(null)
    fileRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (data.app !== APP_ID) {
          toast.error('Archivo inválido — no es un respaldo de Real Advisor')
          return
        }
        if (typeof data.schemaVersion !== 'number' || data.schemaVersion < 4) {
          toast.error(`Versión incompatible (v${data.schemaVersion ?? '?'}). Se requiere v4 o superior.`)
          return
        }
        if (!data.state || typeof data.state !== 'object') {
          toast.error('El respaldo no contiene datos de estado válidos')
          return
        }
        setPendingImport(data)
        setConfirmMode('import')
      } catch {
        toast.error('Error al leer el archivo — asegúrate de que sea JSON válido')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleConfirmImport = () => {
    restoreState(pendingImport.state)
    toast.success('Respaldo restaurado ✓')
    setConfirmMode(null)
    setPendingImport(null)
  }

  // ── Backup: Restore demo ──────────────────────────────────────────────────
  const handleConfirmDemo = () => {
    restoreState({
      accounts:        [],
      cards:           [],
      transactions:    [],
      categories:      DEFAULT_CATEGORIES,
      bajoquintos:     [],
      investments:     [],
      assets:          [],
      liabilities:     [],
      subscriptions:   [],
      metas:           DEFAULT_METAS,
      settings:        { currency: 'MXN' },
      cashflowItems:   [],
      networthHistory: [],
    })
    toast.success('Estado demo restaurado')
    setConfirmMode(null)
  }

  const cancelConfirm = () => {
    setConfirmMode(null)
    setPendingImport(null)
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mb-nav">
      <div className="px-5 pt-14 pt-safe mb-5">
        <h1 className="text-2xl font-black mb-5" style={{ color: 'var(--t1)' }}>Configuración</h1>

        {/* ── Respaldo de datos ──────────────────────────────────────────────── */}
        <div className="card mb-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <HardDrive size={16} color="var(--t2)" />
            <p className="font-bold" style={{ color: 'var(--t1)' }}>Respaldo</p>
          </div>

          {/* Last backup badge */}
          <p className="text-[11px] mb-4" style={{ color: 'var(--t3)' }}>
            {lastBackup
              ? `Último respaldo: ${fmtDate(lastBackup)}`
              : 'Sin respaldo registrado'}
          </p>

          {/* Action buttons */}
          <div className="space-y-2.5">
            {/* Export */}
            <button onClick={handleExport}
              className="btn-press w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl"
              style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(34,197,94,0.12)' }}>
                <Download size={18} color="#22C55E" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>
                  Exportar respaldo
                </p>
                <p className="text-[11px]" style={{ color: 'var(--t3)' }}>
                  Descarga JSON con todos tus datos
                </p>
              </div>
            </button>

            {/* Import */}
            <button onClick={handleImportClick}
              className="btn-press w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl"
              style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(99,102,241,0.12)' }}>
                <Upload size={18} color="#6366F1" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>
                  Importar respaldo
                </p>
                <p className="text-[11px]" style={{ color: 'var(--t3)' }}>
                  Restaura desde un archivo JSON
                </p>
              </div>
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json"
              className="hidden" onChange={handleFileChange} />

            {/* Restore demo */}
            <button onClick={() => setConfirmMode('demo')}
              className="btn-press w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl"
              style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(217,119,6,0.12)' }}>
                <RefreshCw size={18} color="#D97706" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>
                  Restaurar demo
                </p>
                <p className="text-[11px]" style={{ color: 'var(--t3)' }}>
                  Borra todo y vuelve al estado inicial
                </p>
              </div>
            </button>
          </div>

          {/* Inline confirmation */}
          {confirmMode && (
            <ConfirmCard
              mode={confirmMode}
              pending={pendingImport}
              onCancel={cancelConfirm}
              onConfirm={confirmMode === 'import' ? handleConfirmImport : handleConfirmDemo}
            />
          )}
        </div>

        {/* ── IBKR · Portafolio ────────────────────────────────────────────── */}
        <div className="card mb-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <Server size={16} color="var(--t2)" />
            <p className="font-bold" style={{ color: 'var(--t1)' }}>IBKR · Portafolio</p>
            {/* Live status */}
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{
                background: ibkr.isMock
                  ? '#6366F1'
                  : ibkr.authStatus.authenticated
                    ? '#059669'
                    : '#6B7280',
              }} />
              <span className="text-[10px] font-semibold" style={{ color: 'var(--t3)' }}>
                {ibkr.isMock
                  ? 'Mock'
                  : ibkr.authStatus.authenticated
                    ? 'Conectado'
                    : 'Desconectado'}
              </span>
            </div>
          </div>

          <p className="text-[11px] mb-4" style={{ color: 'var(--t3)' }}>
            Conecta con Interactive Brokers Client Portal Gateway para sincronizar tu portafolio en tiempo real.
          </p>

          {/* Mode toggle */}
          <div className="seg-wrap mb-4">
            <button
              className={`seg-btn ${ibkr.isMock ? 'active' : ''}`}
              onClick={() => ibkr.setMode('mock')}>
              Mock
            </button>
            <button
              className={`seg-btn ${ibkr.isReal ? 'active' : ''}`}
              onClick={() => ibkr.setMode('real')}>
              Real (Gateway)
            </button>
          </div>

          {/* Real mode settings */}
          {ibkr.isReal && (
            <div className="space-y-3 mb-4 fade-in">
              <div>
                <p className="text-[10px] uppercase tracking-wide mb-1.5 font-semibold"
                  style={{ color: 'var(--t3)' }}>
                  URL del Gateway
                </p>
                <input
                  type="text"
                  value={ibkrGatewayInput}
                  onChange={e => setIbkrGatewayInput(e.target.value)}
                  onBlur={() => {
                    const url = ibkrGatewayInput.trim() || 'https://localhost:5000'
                    ibkr.setGatewayUrl(url)
                    setIbkrGatewayInput(url)
                  }}
                  placeholder="https://localhost:5000"
                  style={{ fontSize: 14 }}
                />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide mb-1.5 font-semibold"
                  style={{ color: 'var(--t3)' }}>
                  Account ID <span style={{ textTransform: 'none', fontWeight: 400 }}>(opcional — se detecta automáticamente)</span>
                </p>
                <input
                  type="text"
                  value={ibkrAccountInput}
                  onChange={e => setIbkrAccountInput(e.target.value)}
                  onBlur={() => ibkr.setAccountId(ibkrAccountInput.trim() || null)}
                  placeholder="U1234567"
                  style={{ fontSize: 14 }}
                />
              </div>
            </div>
          )}

          {/* Test connection (real mode only) */}
          {ibkr.isReal && (
            <button
              onClick={async () => {
                setIbkrChecking(true)
                const result = await ibkr.checkAuth()
                setIbkrChecking(false)
                if (result.authenticated) {
                  toast.success(`IBKR conectado · ${result.message || 'Autenticado'}`)
                } else {
                  toast.error(`IBKR desconectado — ${result.message || 'Gateway no disponible'}`, { duration: 5000 })
                }
              }}
              disabled={ibkrChecking}
              className="btn-press w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl disabled:opacity-60 mb-3"
              style={{ background: 'var(--s2)', border: '1px solid var(--border)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(5,150,105,0.12)' }}>
                {ibkrChecking
                  ? <Loader2 size={18} color="#059669" className="animate-spin" />
                  : <Wifi size={18} color="#059669" />}
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>
                  {ibkrChecking ? 'Verificando…' : 'Probar conexión'}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--t3)' }}>
                  {ibkr.lastSyncedAt
                    ? `Última sync: ${fmtDate(ibkr.lastSyncedAt.toISOString())}`
                    : 'Verifica que el Client Portal Gateway esté activo'}
                </p>
              </div>
            </button>
          )}

          {/* Mock mode info */}
          {ibkr.isMock && (
            <div className="px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <p className="text-[11px] font-bold mb-0.5" style={{ color: '#818CF8' }}>
                Modo Mock activo
              </p>
              <p className="text-[10px]" style={{ color: 'var(--t3)' }}>
                Datos sintéticos: NVDA, QQQ, SOFI CALL, TSLA PUT. Cambia a Real cuando el Gateway esté activo.
              </p>
            </div>
          )}

          {/* Real + last sync info */}
          {ibkr.isReal && ibkr.lastSyncedAt && (
            <div className="px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.15)' }}>
              <p className="text-[10px] font-semibold" style={{ color: '#059669' }}>
                Última sincronización: {fmtDate(ibkr.lastSyncedAt.toISOString())}
              </p>
            </div>
          )}
        </div>

        {/* ── Categorías ────────────────────────────────────────────────────── */}
        <div className="card mb-4">
          <div className="flex justify-between items-center mb-4">
            <p className="font-bold" style={{ color: 'var(--t1)' }}>Categorías</p>
            {!adding && !editId && (
              <button onClick={() => setAdding(true)}
                className="btn-press flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: 'var(--s3)', color: 'var(--accent-l)', border: '1px solid var(--ba)' }}>
                <Plus size={13} /> Nueva
              </button>
            )}
          </div>

          {/* Segment */}
          <div className="seg-wrap mb-4">
            <button className={`seg-btn ${catTab === 'gasto'   ? 'active' : ''}`} onClick={() => setCatTab('gasto')}>Gastos</button>
            <button className={`seg-btn ${catTab === 'ingreso' ? 'active' : ''}`} onClick={() => setCatTab('ingreso')}>Ingresos</button>
          </div>

          {/* Add / Edit form */}
          {(adding || editId) && (
            <div className="mb-4 p-3 rounded-xl fade-in"
              style={{ background: 'var(--s3)', border: '1px solid var(--ba)' }}>
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--t3)' }}>
                {editId ? 'Editar categoría' : 'Nueva categoría'}
              </p>
              {/* Emoji picker */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {EMOJI_OPTIONS.map(e => (
                  <button key={e} type="button" onClick={() => setNewEmoji(e)}
                    className={`btn-press w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${
                      newEmoji === e ? 'ring-2 ring-violet-500' : ''}`}
                    style={{ background: newEmoji === e ? 'rgba(123,63,228,0.2)' : 'var(--s2)' }}>
                    {e}
                  </button>
                ))}
              </div>
              <input type="text" placeholder="Nombre de la categoría..."
                value={newName} onChange={e => setNewName(e.target.value)}
                className="mb-3" style={{ fontSize: 16 }} />
              <div className="flex gap-2">
                <button onClick={handleCancel} className="btn-ghost flex-1 py-2 text-xs rounded-xl">
                  Cancelar
                </button>
                <button onClick={handleSave}
                  className="btn-press flex-1 py-2 rounded-xl text-xs font-bold text-white"
                  style={{ background: 'var(--accent)' }}>
                  {editId ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </div>
          )}

          {/* List */}
          <div className="space-y-0.5">
            {filteredCats.length === 0 && (
              <p className="text-center py-6 text-sm" style={{ color: 'var(--t3)' }}>
                Sin categorías en esta sección
              </p>
            )}
            {filteredCats.map(cat => (
              <div key={cat.id} className="flex items-center gap-3 py-2.5"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="text-lg w-7 text-center shrink-0">{cat.emoji}</span>
                <span className="flex-1 text-sm font-medium truncate"
                  style={{ color: 'var(--t1)' }}>{cat.name}</span>
                {cat.isDefault ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-md shrink-0"
                    style={{ background: 'var(--s3)', color: 'var(--t3)' }}>
                    Default
                  </span>
                ) : (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleEdit(cat)}
                      className="btn-press w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'var(--s3)' }}>
                      <Pencil size={12} color="var(--t2)" />
                    </button>
                    <button onClick={() => handleDelete(cat)}
                      className="btn-press w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(244,63,94,0.1)' }}>
                      <Trash2 size={12} color="#F43F5E" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Version ───────────────────────────────────────────────────────── */}
        <div className="text-center py-4">
          <p className="text-3xl mb-2">🎸</p>
          <p className="text-xs font-semibold" style={{ color: 'var(--t2)' }}>
            Real Advisor Finanzas · v2.0 · Schema v{SCHEMA_VERSION}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>Los Primos Bajoquintos</p>
        </div>
      </div>
    </div>
  )
}

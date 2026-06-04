import { useState, useRef, useCallback } from 'react'
import {
  X, Camera, Upload, CheckCircle2, ChevronDown,
  AlertCircle, RefreshCw, Sparkles, TrendingUp, TrendingDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import useFinanceStore from '../../store/useFinanceStore.js'
import { preprocessImage, analyzeCapture } from '../../lib/captureParser.js'
import { computeStats } from '../../store/selectors.js'
import { fmxD, uid, today } from '../../lib/formatters.js'

// ── Product type metadata ──────────────────────────────────────────────────
const PT = {
  debit_account:       { label: 'Cuenta Débito',    badge: '💳 Débito',       color: '#059669' },
  credit_card:         { label: 'Tarjeta Crédito',  badge: '💳 Crédito',      color: '#E11D48' },
  savings_account:     { label: 'Cuenta Ahorro',    badge: '🏦 Ahorro',        color: '#0891B2' },
  investment_account:  { label: 'Portafolio',       badge: '📊 Inversión',     color: '#4F46E5' },
  loan:                { label: 'Préstamo',          badge: '💸 Préstamo',      color: '#D97706' },
  unknown:             { label: 'Tipo desconocido',  badge: '❓ Manual',        color: '#6B7280' },
}

// ── Step IDs ───────────────────────────────────────────────────────────────
const STEP = { UPLOAD: 0, ANALYZING: 1, REVIEW: 2, DONE: 3 }

// ── Supported apps shown in upload screen ─────────────────────────────────
const SUPPORTED = [
  { name: 'IBKR',        color: '#E31837', icon: '📊' },
  { name: 'BBVA',        color: '#004691', icon: '🏦' },
  { name: 'Nu',          color: '#820AD1', icon: '🟣' },
  { name: 'Stori',       color: '#FF5A5F', icon: '🔴' },
  { name: 'DiDi Card',   color: '#FF6620', icon: '🟠' },
  { name: 'Revolut',     color: '#0075EB', icon: '💙' },
  { name: 'GBM+',        color: '#1A1A2E', icon: '📈' },
  { name: 'Mercado Pago',color: '#009EE3', icon: '💛' },
]

// ── Field definitions per account type ───────────────────────────────────
const FIELDS = {
  card: [
    { key: 'balance',           label: 'Saldo adeudado',     kind: 'amount' },
    { key: 'limit',             label: 'Límite de crédito',  kind: 'amount' },
    { key: 'available',         label: 'Crédito disponible', kind: 'amount', computed: true },
    { key: 'cutDay',            label: 'Día de corte',       kind: 'day'    },
    { key: 'dueDay',            label: 'Día límite de pago', kind: 'day'    },
    { key: 'minPayment',        label: 'Pago mínimo',        kind: 'amount' },
    { key: 'noInterestPayment', label: 'Pago sin intereses', kind: 'amount' },
  ],
  account: [
    { key: 'balance',    label: 'Saldo disponible', kind: 'amount' },
    { key: 'investment', label: 'Inversión',        kind: 'amount' },
  ],
  broker: [
    { key: 'nlv',           label: 'Net Liquidation Value', kind: 'amount' },
    { key: 'cash',          label: 'Cash disponible',       kind: 'amount' },
    { key: 'dailyPnl',      label: 'Daily P&L',             kind: 'amount' },
    { key: 'unrealizedPnl', label: 'P&L no realizado',      kind: 'amount' },
  ],
  investment: [
    { key: 'balance',  label: 'Valor del portafolio', kind: 'amount' },
    { key: 'dailyPnl', label: 'Rendimiento del día',  kind: 'amount' },
  ],
}

// ── Progress ring SVG ─────────────────────────────────────────────────────
function ProgressRing({ pct }) {
  const R = 36, C = 2 * Math.PI * R
  const arc = C * Math.min(1, pct)
  return (
    <svg width={88} height={88} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={44} cy={44} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} />
      <circle cx={44} cy={44} r={R} fill="none" stroke="url(#grad)" strokeWidth={6}
        strokeDasharray={`${arc} ${C}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.25s ease' }} />
      <defs>
        <linearGradient id="grad"><stop offset="0%" stopColor="#4F46E5" /><stop offset="100%" stopColor="#818CF8" /></linearGradient>
      </defs>
    </svg>
  )
}

// ── Single editable field row ─────────────────────────────────────────────
function FieldRow({ def, value, onChange, wasDetected }) {
  const filled = value !== '' && value != null

  if (def.computed) {
    // Shown read-only (auto = limit - balance), no editing
    return (
      <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <span className="text-xs font-medium" style={{ color: '#8B8BAD' }}>{def.label}</span>
        <span className="text-sm font-semibold" style={{ color: '#4ADE80' }}>
          {filled ? fmxD(value) : '—'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 py-1.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <label className="text-xs font-medium shrink-0" style={{ color: '#8B8BAD', width: 148 }}>
        {def.label}
        {wasDetected && (
          <span className="ml-1 px-1 rounded text-[9px]"
            style={{ background: 'rgba(79,70,229,0.22)', color: '#818CF8' }}>IA</span>
        )}
      </label>
      <input
        type={def.kind === 'day' ? 'number' : 'text'}
        inputMode={def.kind === 'day' ? 'numeric' : 'decimal'}
        min={def.kind === 'day' ? 1 : undefined}
        max={def.kind === 'day' ? 31 : undefined}
        placeholder={def.kind === 'day' ? '1–31' : '0.00'}
        value={value ?? ''}
        onChange={e => onChange(def.key, e.target.value)}
        className="flex-1 text-right text-sm font-semibold bg-transparent outline-none"
        style={{ color: filled ? 'var(--t1)' : '#555577' }}
      />
    </div>
  )
}

// ── Main modal ─────────────────────────────────────────────────────────────
export default function CaptureModal({ onClose }) {
  const {
    accounts, cards,
    updateCard, addCard,
    updateAccount, addAccount,
    updateSettings, settings,
    addNetworthSnapshot,
  } = useFinanceStore()

  // ── State ────────────────────────────────────────────────────────────────
  const [step,       setStep]       = useState(STEP.UPLOAD)
  const [imageFile,  setImageFile]  = useState(null)
  const [imageUrl,   setImageUrl]   = useState(null)
  const [progress,   setProgress]   = useState(0)
  const [result,     setResult]     = useState(null)   // analyzeCapture return value
  const [error,      setError]      = useState(null)

  // Review state
  const [accountType,         setAccountType]         = useState('card')
  const [values,              setValues]              = useState({})
  const [targetId,            setTargetId]            = useState('__new__')
  const [confirmedMovements,  setConfirmedMovements]  = useState([])  // movement ids to register

  const fileInputRef = useRef(null)

  // ── File selection ────────────────────────────────────────────────────────
  const handleFile = useCallback((file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona una imagen (PNG, JPG, WEBP, HEIC)')
      return
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImageFile(file)
    setImageUrl(URL.createObjectURL(file))
    setError(null)
  }, [imageUrl])

  const onInputChange = (e) => {
    handleFile(e.target.files?.[0])
    e.target.value = ''
  }

  const onDrop = (e) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files?.[0])
  }

  // ── OCR analysis ──────────────────────────────────────────────────────────
  const startAnalysis = async () => {
    if (!imageFile) return
    setStep(STEP.ANALYZING)
    setProgress(0)
    setError(null)

    try {
      const blob = await preprocessImage(imageFile)
      const ocr  = await analyzeCapture(blob, setProgress)
      const cl   = ocr.classification
      const type = ocr.defaultType  // already correctly mapped from productType

      setResult(ocr)
      setAccountType(type)

      // Convert detected numeric values to strings for editable inputs
      const init = {}
      for (const [k, v] of Object.entries(ocr.detected || {})) {
        if (v != null) init[k] = String(v)
      }
      setValues(init)

      // ── Smart auto-match using productType + last4 + institution ──────────
      const instPrefix = cl.institution?.split(' ')[0]?.toLowerCase() ?? ''

      if (type === 'card') {
        // Debit captures should NOT match credit cards
        const match = cards.find(c => {
          if (cl.last4 && c.last4 === cl.last4) return true
          return instPrefix && c.bankName?.toLowerCase().startsWith(instPrefix)
        })
        setTargetId(match?.id ?? '__new__')

      } else if (type === 'account') {
        // Match by last4, linked account number, or institution
        const match = accounts.find(a => {
          if (cl.last4 && (a.last4 === cl.last4 || a.name?.includes(cl.last4))) return true
          if (cl.linkedAccountLast4 && (
            a.last4 === cl.linkedAccountLast4 ||
            a.name?.includes(cl.linkedAccountLast4)
          )) return true
          return instPrefix && (
            a.institution?.toLowerCase().startsWith(instPrefix) ||
            a.name?.toLowerCase().includes(instPrefix)
          )
        })
        setTargetId(match?.id ?? '__new__')

      } else {
        setTargetId('__ibkr__')
      }

      // Init confirmed movements (none selected by default — user opts in)
      setConfirmedMovements([])

      setStep(STEP.REVIEW)
    } catch (err) {
      console.error('[CaptureModal]', err)
      setError('No se pudo leer la imagen. Intenta con una captura más nítida o con mayor resolución.')
      setStep(STEP.UPLOAD)
    }
  }

  // ── Field value helpers ───────────────────────────────────────────────────
  const setValue = (key, raw) => setValues(prev => ({ ...prev, [key]: raw }))

  const num = (key) => {
    const v = values[key]
    if (v == null || v === '') return undefined
    const n = parseFloat(String(v).replace(/,/g, ''))
    return isNaN(n) ? undefined : n
  }

  const day = (key) => {
    const n = parseInt(values[key])
    return n >= 1 && n <= 31 ? n : undefined
  }

  // Computed available credit = limit - balance (card only, read-only display)
  const computedAvailable = (() => {
    const b = num('balance'), l = num('limit')
    return (b != null && l != null && l > 0) ? Math.max(0, l - b) : null
  })()

  // Field value for display — `available` uses computed
  const displayValue = (def) => {
    if (def.computed) return computedAvailable != null ? computedAvailable : null
    return values[def.key] ?? ''
  }

  // ── Confirm & apply to store ──────────────────────────────────────────────
  const handleConfirm = () => {
    const cl          = result?.classification ?? {}
    const productName = cl.productName || result?.institution || ''
    const { addTransaction, transactions } = useFinanceStore.getState()

    if (accountType === 'card') {
      const payload = {}
      const b  = num('balance');            if (b  != null) payload.balance           = b
      const l  = num('limit');              if (l  != null) payload.limit             = l
      const cd = day('cutDay');             if (cd != null) payload.cutDay            = cd
      const dd = day('dueDay');             if (dd != null) payload.dueDay            = dd
      const mp = num('minPayment');         if (mp != null) payload.minPayment        = mp
      const ni = num('noInterestPayment');  if (ni != null) payload.noInterestPayment = ni
      // Store last4 for future smart-matching
      if (cl.last4) payload.last4 = cl.last4

      if (targetId === '__new__') {
        const name = productName || result?.institution || 'Nueva tarjeta'
        addCard({ bankName: result?.institution || name, cardName: name, ...payload })
        toast.success(`Tarjeta ${name} creada ✓`)
      } else {
        // Show previous vs new balance in toast
        const prev = cards.find(x => x.id === targetId)?.balance ?? 0
        updateCard(targetId, payload)
        const c   = cards.find(x => x.id === targetId)
        const bal = b ?? 0
        const diff = bal - prev
        const name = c?.cardName || c?.bankName || 'Tarjeta'
        if (prev !== 0 && diff !== 0) {
          toast.success(`${name}: ${diff >= 0 ? '+' : ''}${fmxD(diff)} vs anterior ${fmxD(prev)}`)
        } else {
          toast.success(`${name} actualizada — saldo ${fmxD(bal)} ✓`)
        }
      }

    } else if (accountType === 'account') {
      const b = num('balance')
      if (b == null) { toast.error('Ingresa el saldo disponible'); return }
      if (cl.last4) {}  // stored via addAccount/updateAccount below

      if (targetId === '__new__') {
        const name    = productName || result?.institution || 'Nueva cuenta'
        const accType = cl.productType === 'savings_account' ? 'ahorro' : 'debito'
        addAccount({ name, institution: result?.institution || name, type: accType, balance: b, last4: cl.last4 ?? undefined })
        toast.success(`Cuenta ${name} creada — saldo ${fmxD(b)} ✓`)
      } else {
        const prev = accounts.find(x => x.id === targetId)?.balance ?? 0
        updateAccount(targetId, { balance: b, last4: cl.last4 ?? undefined })
        const a    = accounts.find(x => x.id === targetId)
        const diff = b - prev
        const name = a?.name || 'Cuenta'
        if (prev !== 0 && diff !== 0) {
          toast.success(`${name}: ${diff >= 0 ? '+' : ''}${fmxD(diff)} vs anterior ${fmxD(prev)}`)
        } else {
          toast.success(`${name} actualizada — saldo ${fmxD(b)} ✓`)
        }
      }

    } else {
      // broker or investment → goes into settings.ibkr
      const patch = {}
      const nlv  = num('nlv') ?? num('balance'); if (nlv  != null) patch.lastNLV          = nlv
      const cash = num('cash');                  if (cash != null) patch.lastCash         = cash
      const upnl = num('unrealizedPnl');         if (upnl != null) patch.lastUnrealizedPnl = upnl
      const dpnl = num('dailyPnl');              if (dpnl != null) patch.lastDailyPnl     = dpnl
      patch.syncedAt = new Date().toISOString()
      patch.source   = 'capture'

      const prevNLV = settings?.ibkr?.lastNLV ?? 0
      updateSettings({ ibkr: { ...(settings?.ibkr ?? {}), ...patch } })
      const diff = (nlv ?? 0) - prevNLV
      if (prevNLV !== 0 && diff !== 0) {
        toast.success(`IBKR NLV: ${diff >= 0 ? '+' : ''}${fmxD(diff)} vs anterior ${fmxD(prevNLV)}`)
      } else {
        toast.success(`IBKR actualizado — NLV ${fmxD(nlv ?? 0)} ✓`)
      }
    }

    // ── Register confirmed movements ────────────────────────────────────
    if (confirmedMovements.length > 0) {
      const allMovs = result?.movements ?? []
      const toRegister = allMovs.filter(m => confirmedMovements.includes(m.id))
      let registered = 0
      toRegister.forEach(m => {
        // Duplicate check: same date + amount + description prefix
        const dup = (transactions || []).some(tx =>
          tx.date === m.date &&
          Math.abs(Number(tx.amount) - m.amount) < 0.01 &&
          tx.description?.toLowerCase().startsWith(m.description.slice(0, 8).toLowerCase())
        )
        if (dup) return
        addTransaction({
          type:        m.type,
          amount:      m.amount,
          description: m.description,
          date:        m.date,
          accountId:   accountType === 'account' && targetId !== '__new__' ? targetId : undefined,
          cardId:      accountType === 'card'    && targetId !== '__new__' ? targetId : undefined,
        })
        registered++
      })
      if (registered > 0) toast(`${registered} movimiento${registered !== 1 ? 's' : ''} registrado${registered !== 1 ? 's' : ''}`, { icon: '📋' })
    }

    setStep(STEP.DONE)

    // Auto-save networth snapshot after every confirmed capture
    try {
      const freshState = useFinanceStore.getState()
      const s = computeStats(freshState)
      addNetworthSnapshot({
        id:        uid(),
        date:      today(),
        netWorth:         s.netWorth,
        totalAssets:      s.totalAssets,
        totalLiabilities: s.totalLiabilities,
        totalCash:        s.totalCash,
        investmentValue:  s.investmentValue,
        totalCardDebt:    s.totalCardDebt,
        monthIncome:      s.monthIncome,
        monthExpenses:    s.monthExpenses,
        monthFlow:        s.monthFlow,
        source: 'capture',
      })
    } catch {}

    setTimeout(onClose, 900)
  }

  // ── Target selector options ───────────────────────────────────────────────
  const targetOptions = (() => {
    if (accountType === 'card') return [
      { id: '__new__', label: '+ Crear nueva tarjeta' },
      ...cards.map(c => ({ id: c.id, label: `${c.bankName} — ${c.cardName || c.bankName}` })),
    ]
    if (accountType === 'account') return [
      { id: '__new__', label: '+ Crear nueva cuenta' },
      ...accounts.map(a => ({ id: a.id, label: a.name || 'Cuenta' })),
    ]
    return [{ id: '__ibkr__', label: 'Panel Inversiones / IBKR' }]
  })()

  const activeFields = FIELDS[accountType] ?? FIELDS.account

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center fade-in">

      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={step !== STEP.ANALYZING ? onClose : undefined}
      />

      {/* Sheet */}
      <div
        className="relative w-full max-w-lg slide-up"
        style={{
          background: '#0E0E1A',
          borderRadius: '28px 28px 0 0',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: 'env(safe-area-inset-bottom, 20px)',
          maxHeight: '92dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1 shrink-0"
          style={{ background: 'rgba(255,255,255,0.10)' }} />

        {/* ── Header (always visible) ── */}
        <div className="px-5 pb-2 pt-2 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#4F46E5,#818CF8)' }}>
              <Camera size={14} color="#fff" />
            </div>
            <h2 className="text-white text-base font-black">Actualizar con captura</h2>
          </div>
          {step !== STEP.ANALYZING && (
            <button
              onClick={onClose}
              className="btn-press w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: '#151525', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <X size={15} color="#8B8BAD" />
            </button>
          )}
        </div>

        {/* ══════════ STEP 0 — UPLOAD ══════════ */}
        {step === STEP.UPLOAD && (
          <div className="flex-1 overflow-y-auto px-5 pb-6">

            {/* Drop zone / image preview */}
            <div
              onDrop={onDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => !imageUrl && fileInputRef.current?.click()}
              className="relative mt-2 rounded-3xl overflow-hidden"
              style={{
                cursor: imageUrl ? 'default' : 'pointer',
                border: imageUrl
                  ? '2px solid rgba(79,70,229,0.5)'
                  : '2px dashed rgba(255,255,255,0.10)',
                background: imageUrl ? 'transparent' : 'rgba(255,255,255,0.02)',
                minHeight: 150,
              }}
            >
              {imageUrl ? (
                <>
                  <img
                    src={imageUrl} alt="preview"
                    className="w-full rounded-3xl object-cover"
                    style={{ maxHeight: 260 }}
                  />
                  <button
                    onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                    className="btn-press absolute top-3 right-3 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                    style={{ background: 'rgba(14,14,26,0.82)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <RefreshCw size={11} /> Cambiar
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-10">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.2)' }}>
                    <Camera size={26} color="#818CF8" />
                  </div>
                  <p className="text-white text-sm font-semibold">Arrastra o toca para seleccionar</p>
                  <p className="text-[11px]" style={{ color: '#555577' }}>PNG · JPG · WEBP · HEIC</p>
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onInputChange}
            />

            {/* Buttons */}
            {!imageUrl ? (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click() }}
                  className="btn-press flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--t1)' }}
                >
                  <Upload size={15} /> Desde galería
                </button>
                <button
                  onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click() }}
                  className="btn-press flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#4F46E5,#6366F1)' }}
                >
                  <Camera size={15} /> Tomar foto
                </button>
              </div>
            ) : (
              <button
                onClick={startAnalysis}
                className="btn-press w-full flex items-center justify-center gap-2 mt-3 py-4 rounded-2xl text-white font-black text-base"
                style={{ background: 'linear-gradient(135deg,#4F46E5,#6366F1)', boxShadow: '0 4px 20px rgba(79,70,229,0.28)' }}
              >
                <Sparkles size={18} /> Analizar captura
              </button>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-2xl"
                style={{ background: 'rgba(225,29,72,0.06)', border: '1px solid rgba(225,29,72,0.2)' }}>
                <AlertCircle size={15} color="#E11D48" className="shrink-0 mt-0.5" />
                <p className="text-sm" style={{ color: '#E11D48' }}>{error}</p>
              </div>
            )}

            {/* Supported apps */}
            <p className="text-[11px] font-semibold mt-5 mb-2 uppercase tracking-wider" style={{ color: '#555577' }}>
              Apps compatibles
            </p>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED.map(app => (
                <span key={app.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: `${app.color}18`, border: `1px solid ${app.color}30`, color: app.color }}>
                  {app.icon} {app.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ══════════ STEP 1 — ANALYZING ══════════ */}
        {step === STEP.ANALYZING && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 pb-10">
            {imageUrl && (
              <img src={imageUrl} alt="preview"
                className="w-24 h-32 object-cover rounded-2xl"
                style={{ opacity: 0.55, border: '1px solid rgba(255,255,255,0.08)' }} />
            )}
            <div className="relative flex items-center justify-center">
              <ProgressRing pct={progress} />
              <span className="absolute text-white text-sm font-black">
                {Math.round(progress * 100)}%
              </span>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-sm">Leyendo captura...</p>
              <p className="text-[12px] mt-1" style={{ color: '#555577' }}>
                {progress < 0.3
                  ? 'Cargando motor OCR'
                  : progress < 0.8
                  ? 'Reconociendo texto'
                  : 'Extrayendo datos'}
              </p>
            </div>
          </div>
        )}

        {/* ══════════ STEP 2 — REVIEW ══════════ */}
        {step === STEP.REVIEW && result && (() => {
          const cl       = result.classification ?? {}
          const ptMeta   = PT[cl.productType] ?? PT.unknown
          const movements = result.movements ?? []
          const isNew    = targetId === '__new__' || targetId === '__ibkr__'
          const prevBalance = !isNew
            ? ([...accounts, ...cards].find(x => x.id === targetId)?.balance ?? 0)
            : null
          const newBal = parseFloat(String(values.balance || values.nlv || '').replace(/,/g, '')) || 0
          const balDiff = prevBalance !== null ? newBal - prevBalance : null

          // Balance impact calculation
          let impactCash = 0, impactAssets = 0, impactLibs = 0, impactNet = 0, impactNote = ''
          if (accountType === 'account') {
            impactCash = newBal; impactAssets = newBal; impactNet = newBal
            impactNote = 'Saldo disponible suma a efectivo y activos. No afecta pasivos.'
          } else if (accountType === 'card') {
            impactLibs = newBal; impactNet = -newBal
            impactNote = 'Deuda en tarjeta suma a pasivos. Crédito disponible NO suma a activos.'
          } else if (accountType === 'broker' || accountType === 'investment') {
            const nlv = parseFloat(String(values.nlv || values.balance || '').replace(/,/g, '')) || 0
            impactAssets = nlv; impactNet = nlv
            impactNote = 'NLV suma a inversiones (activos). No afecta efectivo ni pasivos.'
          }

          return (
          <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">

            {/* ── Product classification header ── */}
            <div className="flex items-center justify-between mt-1 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-2xl shrink-0">{result.institutionMeta?.icon ?? '📄'}</span>
                <div className="min-w-0">
                  <p className="text-white font-black text-sm leading-tight truncate">
                    {cl.productName || result.institution || 'Producto desconocido'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${ptMeta.color}22`, color: ptMeta.color }}>
                      {ptMeta.badge}
                    </span>
                    {cl.confidence > 0 && (
                      <span className="text-[9px] font-semibold"
                        style={{ color: cl.confidence >= 0.7 ? '#4ADE80' : '#FBBF24' }}>
                        {cl.confidence >= 0.7 ? '✓ Alta confianza' : '⚠ Verifica el tipo'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Type override selector */}
              <div className="relative shrink-0">
                <select
                  value={accountType}
                  onChange={e => { setAccountType(e.target.value); setValues({}) }}
                  className="appearance-none text-[11px] font-bold pl-2.5 pr-6 py-1.5 rounded-xl"
                  style={{ background:'rgba(79,70,229,0.14)', border:'1px solid rgba(79,70,229,0.28)', color:'#818CF8' }}>
                  <option value="account">Cuenta</option>
                  <option value="card">Tarjeta crédito</option>
                  <option value="broker">Broker/IBKR</option>
                  <option value="investment">Inversión</option>
                </select>
                <ChevronDown size={11} color="#818CF8"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Thumbnail */}
            {imageUrl && (
              <img src={imageUrl} alt="captura" className="w-full rounded-2xl object-cover"
                style={{ maxHeight: 110, border: '1px solid rgba(255,255,255,0.06)' }} />
            )}

            {/* ── Detected fields ── */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: '#13131F', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="px-4 py-2.5 border-b flex items-center gap-1.5"
                style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <Sparkles size={13} color="#818CF8" />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#818CF8' }}>
                  Datos detectados — edita si es necesario
                </span>
                {cl.last4 && (
                  <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-lg"
                    style={{ background:'rgba(79,70,229,0.15)', color:'#818CF8' }}>
                    •{cl.last4}
                  </span>
                )}
              </div>
              <div className="px-4 py-1">
                {activeFields.map(def => (
                  <FieldRow key={def.key} def={def} value={displayValue(def)}
                    onChange={setValue} wasDetected={result.detected?.[def.key] != null} />
                ))}
                {/* Fallback amount chips when no institution detected */}
                {!result.institution && result.topAmounts?.length > 0 && (
                  <div className="py-2">
                    <p className="text-[11px] mb-2" style={{ color: '#555577' }}>
                      Montos detectados — toca para asignar:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.topAmounts.map((amt, i) => (
                        <button key={i}
                          onClick={() => setValue(activeFields[0]?.key ?? 'balance', String(amt))}
                          className="btn-press px-2.5 py-1 rounded-lg text-xs font-bold"
                          style={{ background:'rgba(79,70,229,0.15)', color:'#818CF8', border:'1px solid rgba(79,70,229,0.2)' }}>
                          {fmxD(amt)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Impacto estimado en patrimonio ── */}
            {newBal > 0 && (
              <div className="rounded-2xl p-3.5"
                style={{ background:'rgba(74,222,128,0.06)', border:'1px solid rgba(74,222,128,0.14)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5"
                  style={{ color:'#4ADE80' }}>Impacto estimado en patrimonio</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label:'Efectivo',    v: impactCash,   show: impactCash   !== 0 },
                    { label:'Activos',     v: impactAssets, show: true              },
                    { label:'Pasivos',     v: impactLibs,   show: impactLibs   !== 0 },
                    { label:'Patrimonio',  v: impactNet,    show: true              },
                  ].filter(x => x.show).map(({ label, v }) => (
                    <div key={label} className="rounded-xl px-3 py-2"
                      style={{ background:'rgba(0,0,0,0.20)' }}>
                      <p style={{ fontSize:9, color:'rgba(74,222,128,0.55)', textTransform:'uppercase', marginBottom:2 }}>{label}</p>
                      <p className="font-black text-sm" style={{ color: v >= 0 ? '#4ADE80' : '#F87171' }}>
                        {v >= 0 ? '+' : ''}{fmxD(Math.abs(v))}
                      </p>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize:9, color:'rgba(74,222,128,0.40)', marginTop:6 }}>{impactNote}</p>
              </div>
            )}

            {/* ── Comparación con saldo anterior ── */}
            {prevBalance !== null && prevBalance !== 0 && balDiff !== null && balDiff !== 0 && (
              <div className="rounded-2xl p-3.5"
                style={{ background:'rgba(79,70,229,0.08)', border:'1px solid rgba(79,70,229,0.18)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2"
                  style={{ color:'#818CF8' }}>Comparación con saldo anterior</p>
                <div className="flex items-center gap-3">
                  <div>
                    <p style={{ fontSize:9, color:'rgba(129,140,248,0.55)' }}>Anterior</p>
                    <p className="text-sm font-bold" style={{ color:'rgba(129,140,248,0.75)' }}>{fmxD(prevBalance)}</p>
                  </div>
                  <div style={{ fontSize:18, color:'rgba(129,140,248,0.40)' }}>→</div>
                  <div>
                    <p style={{ fontSize:9, color:'rgba(129,140,248,0.55)' }}>Nuevo</p>
                    <p className="text-sm font-bold text-white">{fmxD(newBal)}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p style={{ fontSize:9, color:'rgba(129,140,248,0.55)' }}>Diferencia</p>
                    <p className="text-sm font-bold"
                      style={{ color: balDiff >= 0 ? '#4ADE80' : '#F87171' }}>
                      {balDiff >= 0 ? '+' : ''}{fmxD(balDiff)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Movimientos detectados ── */}
            {movements.length > 0 && (
              <div className="rounded-2xl overflow-hidden"
                style={{ background:'#13131F', border:'1px solid rgba(255,255,255,0.05)' }}>
                <div className="px-4 py-2.5 border-b flex items-center justify-between"
                  style={{ borderColor:'rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color:'#8B8BAD' }}>
                      Movimientos detectados
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                      style={{ background:'rgba(79,70,229,0.15)', color:'#818CF8' }}>
                      {confirmedMovements.length}/{movements.length} seleccionados
                    </span>
                  </div>
                  <button
                    onClick={() => setConfirmedMovements(
                      confirmedMovements.length === movements.length ? [] : movements.map(m => m.id)
                    )}
                    className="text-[10px] font-bold"
                    style={{ color:'#818CF8' }}>
                    {confirmedMovements.length === movements.length ? 'Ninguno' : 'Todos'}
                  </button>
                </div>
                <div className="divide-y" style={{ borderColor:'rgba(255,255,255,0.04)' }}>
                  {movements.map(m => {
                    const checked = confirmedMovements.includes(m.id)
                    return (
                      <button key={m.id}
                        onClick={() => setConfirmedMovements(prev =>
                          checked ? prev.filter(id => id !== m.id) : [...prev, m.id]
                        )}
                        className="btn-press w-full flex items-center gap-3 px-4 py-2.5 text-left"
                        style={{ background: checked ? 'rgba(79,70,229,0.08)' : 'transparent' }}>
                        <div className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                          style={{ borderColor: checked ? '#818CF8' : 'rgba(255,255,255,0.15)',
                            background: checked ? 'rgba(79,70,229,0.25)' : 'transparent' }}>
                          {checked && <span style={{ fontSize:10, color:'#818CF8' }}>✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color:'var(--t1)' }}>
                            {m.description}
                          </p>
                          <p className="text-[10px]" style={{ color:'var(--t3)' }}>{m.date}</p>
                        </div>
                        <span className="text-xs font-bold shrink-0"
                          style={{ color: m.sign === 'debit' ? '#F87171' : '#4ADE80' }}>
                          {m.sign === 'debit' ? '−' : '+'}{fmxD(m.amount)}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {confirmedMovements.length > 0 && (
                  <div className="px-4 py-2" style={{ borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                    <p className="text-[9px]" style={{ color:'rgba(129,140,248,0.55)' }}>
                      ✓ Se registrarán al confirmar. Se omiten duplicados.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Aplicar a ── */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: '#13131F', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="px-4 py-2.5 border-b" style={{ borderColor:'rgba(255,255,255,0.05)' }}>
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color:'#8B8BAD' }}>
                  Aplicar a
                </span>
              </div>
              <div className="px-4 py-3 relative">
                <select value={targetId} onChange={e => setTargetId(e.target.value)}
                  style={{ width:'100%', appearance:'none', background:'rgba(255,255,255,0.04)',
                    border:'1px solid rgba(255,255,255,0.08)', color:'var(--t1)',
                    borderRadius:12, padding:'10px 36px 10px 12px', fontSize:14, fontWeight:600 }}>
                  {targetOptions.map(o => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} color="#8B8BAD"
                  className="absolute right-7 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* ── Confirm ── */}
            <button onClick={handleConfirm}
              className="btn-press w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2"
              style={{ background:'linear-gradient(135deg,#4F46E5,#6366F1)', boxShadow:'0 4px 20px rgba(79,70,229,0.28)' }}>
              <CheckCircle2 size={18} /> Confirmar y actualizar
            </button>
          </div>
          )
        })()}

        {/* ══════════ STEP 3 — DONE ══════════ */}
        {step === STEP.DONE && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-5 pb-10">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <CheckCircle2 size={32} color="#4ADE80" />
            </div>
            <div className="text-center">
              <p className="text-white font-black text-lg">¡Actualizado!</p>
              <p className="text-sm mt-1" style={{ color: '#8B8BAD' }}>
                Los datos se aplicaron al dashboard
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

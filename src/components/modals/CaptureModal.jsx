import { useState, useRef, useCallback } from 'react'
import {
  X, Camera, Upload, CheckCircle2, ChevronDown,
  AlertCircle, RefreshCw, Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import useFinanceStore from '../../store/useFinanceStore.js'
import { preprocessImage, analyzeCapture } from '../../lib/captureParser.js'
import { computeStats } from '../../store/selectors.js'
import { fmxD, uid, today } from '../../lib/formatters.js'

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
  const [accountType, setAccountType] = useState('card')
  const [values,      setValues]      = useState({})   // fieldKey → raw string
  const [targetId,    setTargetId]    = useState('__new__')

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
      const blob     = await preprocessImage(imageFile)
      const ocr      = await analyzeCapture(blob, setProgress)
      const type     = ocr.defaultType === 'broker' ? 'broker' : ocr.defaultType

      setResult(ocr)
      setAccountType(type)
      // Convert detected numeric values to strings for the editable inputs
      const init = {}
      for (const [k, v] of Object.entries(ocr.detected || {})) {
        if (v != null) init[k] = String(v)
      }
      setValues(init)

      // Auto-select matching existing card or account
      const instName = ocr.institution?.toLowerCase() ?? ''
      if (type === 'card') {
        const match = cards.find(c =>
          instName && c.bankName?.toLowerCase().startsWith(instName.split(' ')[0])
        )
        setTargetId(match?.id ?? '__new__')
      } else if (type === 'account') {
        const match = accounts.find(a =>
          instName && (
            a.name?.toLowerCase().includes(instName.split(' ')[0]) ||
            a.institution?.toLowerCase().includes(instName.split(' ')[0])
          )
        )
        setTargetId(match?.id ?? '__new__')
      } else {
        setTargetId('__ibkr__')
      }

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
    if (accountType === 'card') {
      const payload = {}
      const b = num('balance');           if (b  != null) payload.balance           = b
      const l = num('limit');             if (l  != null) payload.limit             = l
      const cd = day('cutDay');           if (cd != null) payload.cutDay            = cd
      const dd = day('dueDay');           if (dd != null) payload.dueDay            = dd
      const mp = num('minPayment');       if (mp != null) payload.minPayment        = mp
      const ni = num('noInterestPayment');if (ni != null) payload.noInterestPayment = ni

      if (targetId === '__new__') {
        const name = result?.institution || 'Nuevo'
        addCard({ bankName: name, cardName: name, ...payload })
        toast.success(`Tarjeta ${name} creada ✓`)
      } else {
        updateCard(targetId, payload)
        const c = cards.find(x => x.id === targetId)
        toast.success(`${c?.cardName || c?.bankName || 'Tarjeta'} actualizada ✓`)
      }

    } else if (accountType === 'account') {
      const b = num('balance')
      if (b == null) { toast.error('Ingresa el saldo'); return }

      if (targetId === '__new__') {
        const name = result?.institution || 'Nueva cuenta'
        addAccount({ name, type: 'ahorro', balance: b })
        toast.success(`Cuenta ${name} creada ✓`)
      } else {
        updateAccount(targetId, { balance: b })
        const a = accounts.find(x => x.id === targetId)
        toast.success(`${a?.name || 'Cuenta'} actualizada ✓`)
      }

    } else {
      // broker or investment → goes into settings.ibkr
      const patch = {}
      const nlv = num('nlv') ?? num('balance'); if (nlv != null) patch.lastNLV = nlv
      const cash = num('cash');                 if (cash != null) patch.lastCash = cash
      const upnl = num('unrealizedPnl');        if (upnl != null) patch.lastUnrealizedPnl = upnl
      const dpnl = num('dailyPnl');             if (dpnl != null) patch.lastDailyPnl = dpnl
      patch.syncedAt = new Date().toISOString()
      patch.source   = 'capture'

      updateSettings({ ibkr: { ...(settings?.ibkr ?? {}), ...patch } })
      toast.success('Datos de inversión actualizados ✓')
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
        {step === STEP.REVIEW && result && (
          <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">

            {/* Institution + type selector */}
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">{result.institutionMeta?.icon ?? '📄'}</span>
                <div>
                  <p className="text-white font-black text-sm">
                    {result.institution ?? 'Institución desconocida'}
                  </p>
                  <p className="text-[11px]" style={{ color: result.institution ? '#4ADE80' : '#FBBF24' }}>
                    {result.institution ? '✓ Detectada automáticamente' : '⚠ Verifica y ajusta los datos'}
                  </p>
                </div>
              </div>

              <div className="relative">
                <select
                  value={accountType}
                  onChange={e => { setAccountType(e.target.value); setValues({}) }}
                  className="appearance-none text-xs font-bold pl-3 pr-7 py-2 rounded-xl"
                  style={{
                    background: 'rgba(79,70,229,0.14)',
                    border: '1px solid rgba(79,70,229,0.28)',
                    color: '#818CF8',
                  }}
                >
                  <option value="card">Tarjeta</option>
                  <option value="account">Cuenta</option>
                  <option value="broker">Broker / IBKR</option>
                  <option value="investment">Inversión</option>
                </select>
                <ChevronDown size={12} color="#818CF8"
                  className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Thumbnail */}
            {imageUrl && (
              <img src={imageUrl} alt="captura"
                className="w-full rounded-2xl object-cover"
                style={{ maxHeight: 130, border: '1px solid rgba(255,255,255,0.06)' }} />
            )}

            {/* Fields */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: '#13131F', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="px-4 py-2.5 border-b flex items-center gap-1.5"
                style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <Sparkles size={13} color="#818CF8" />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#818CF8' }}>
                  Datos detectados — edita si es necesario
                </span>
              </div>
              <div className="px-4 py-1">
                {activeFields.map(def => (
                  <FieldRow
                    key={def.key}
                    def={def}
                    value={displayValue(def)}
                    onChange={setValue}
                    wasDetected={result.detected?.[def.key] != null}
                  />
                ))}

                {/* Fallback: clickable amount chips when institution unknown */}
                {!result.institution && result.topAmounts?.length > 0 && (
                  <div className="py-2">
                    <p className="text-[11px] mb-2" style={{ color: '#555577' }}>
                      Montos detectados — toca para asignar al primer campo:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.topAmounts.map((amt, i) => (
                        <button key={i}
                          onClick={() => setValue(activeFields[0]?.key ?? 'balance', String(amt))}
                          className="btn-press px-2.5 py-1 rounded-lg text-xs font-bold"
                          style={{ background: 'rgba(79,70,229,0.15)', color: '#818CF8', border: '1px solid rgba(79,70,229,0.2)' }}>
                          {fmxD(amt)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Aplicar a */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: '#13131F', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="px-4 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#8B8BAD' }}>
                  Aplicar a
                </span>
              </div>
              <div className="px-4 py-3 relative">
                <select
                  value={targetId}
                  onChange={e => setTargetId(e.target.value)}
                  style={{
                    width: '100%',
                    appearance: 'none',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'var(--t1)',
                    borderRadius: 12,
                    padding: '10px 36px 10px 12px',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {targetOptions.map(o => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} color="#8B8BAD"
                  className="absolute right-7 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Confirm */}
            <button
              onClick={handleConfirm}
              className="btn-press w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#4F46E5,#6366F1)', boxShadow: '0 4px 20px rgba(79,70,229,0.28)' }}
            >
              <CheckCircle2 size={18} /> Confirmar y actualizar
            </button>
          </div>
        )}

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

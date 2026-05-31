import { useState, useRef, useCallback } from 'react'
import { X, Camera, Upload, Loader2, CheckCircle2, ChevronDown, AlertCircle, RefreshCw, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import useFinanceStore from '../../store/useFinanceStore.js'
import { preprocessImage, analyzeCapture } from '../../lib/captureParser.js'
import { fmxD } from '../../lib/formatters.js'

// ── Steps ──────────────────────────────────────────────────────────────────
const STEP = { UPLOAD: 0, ANALYZING: 1, REVIEW: 2, DONE: 3 }

// ── Supported app list (shown in upload screen) ────────────────────────────
const SUPPORTED = [
  { name: 'BBVA',        color: '#004691', icon: '🏦' },
  { name: 'Nu',          color: '#820AD1', icon: '🟣' },
  { name: 'IBKR',        color: '#E31837', icon: '📊' },
  { name: 'Stori',       color: '#FF5A5F', icon: '🔴' },
  { name: 'DiDi Card',   color: '#FF6620', icon: '🟠' },
  { name: 'Revolut',     color: '#0075EB', icon: '💙' },
  { name: 'GBM+',        color: '#1A1A2E', icon: '📈' },
  { name: 'Mercado Pago',color: '#009EE3', icon: '💛' },
]

// ── Field labels / order per type ─────────────────────────────────────────
const CARD_FIELDS = [
  { key: 'balance',          label: 'Saldo adeudado',      type: 'amount' },
  { key: 'limit',            label: 'Límite de crédito',   type: 'amount' },
  { key: 'available',        label: 'Crédito disponible',  type: 'amount', readOnly: true },
  { key: 'cutDay',           label: 'Día de corte',        type: 'day'    },
  { key: 'dueDay',           label: 'Día límite de pago',  type: 'day'    },
  { key: 'minPayment',       label: 'Pago mínimo',         type: 'amount' },
  { key: 'noInterestPayment',label: 'Pago sin intereses',  type: 'amount' },
]

const ACCOUNT_FIELDS = [
  { key: 'balance',   label: 'Saldo disponible', type: 'amount' },
  { key: 'investment',label: 'Inversión',        type: 'amount' },
]

const BROKER_FIELDS = [
  { key: 'nlv',           label: 'Net Liquidation Value', type: 'amount' },
  { key: 'cash',          label: 'Cash disponible',       type: 'amount' },
  { key: 'dailyPnl',      label: 'Daily P&L',             type: 'amount' },
  { key: 'unrealizedPnl', label: 'P&L no realizado',      type: 'amount' },
]

const INVESTMENT_FIELDS = [
  { key: 'balance',  label: 'Valor del portafolio', type: 'amount' },
  { key: 'dailyPnl', label: 'Rendimiento del día',  type: 'amount' },
]

function getFieldsForType(type) {
  if (type === 'card')       return CARD_FIELDS
  if (type === 'account')    return ACCOUNT_FIELDS
  if (type === 'broker')     return BROKER_FIELDS
  if (type === 'investment') return INVESTMENT_FIELDS
  return ACCOUNT_FIELDS
}

// ── Helpers ────────────────────────────────────────────────────────────────
function amountToStr(val) { return val != null ? String(val) : '' }

// ── Sub-components ─────────────────────────────────────────────────────────

function ProgressRing({ progress }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const dash = circ * Math.min(1, progress)
  return (
    <svg width="88" height="88" className="rotate-[-90deg]">
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
      <circle cx="44" cy="44" r={r} fill="none" stroke="url(#pg)" strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.3s ease' }} />
      <defs>
        <linearGradient id="pg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#818CF8" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function Field({ def, value, onChange, detected }) {
  const hasValue  = value !== '' && value !== null && value !== undefined
  const wasDetect = detected != null

  if (def.readOnly) {
    // Available credit = limit - balance (auto-calculated, show only)
    return (
      <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <span className="text-xs font-medium" style={{ color: '#8B8BAD' }}>{def.label}</span>
        <span className="text-sm font-semibold" style={{ color: '#4ADE80' }}>
          {hasValue ? fmxD(value) : '—'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 py-1.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <label className="text-xs font-medium shrink-0 w-36" style={{ color: '#8B8BAD' }}>
        {def.label}
        {wasDetect && <span className="ml-1 text-[9px] px-1 rounded" style={{ background: 'rgba(79,70,229,0.2)', color: '#818CF8' }}>IA</span>}
      </label>
      <input
        type={def.type === 'day' ? 'number' : 'text'}
        inputMode={def.type === 'day' ? 'numeric' : 'decimal'}
        min={def.type === 'day' ? 1 : undefined}
        max={def.type === 'day' ? 31 : undefined}
        placeholder={def.type === 'day' ? 'Día 1–31' : '0.00'}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        className="flex-1 text-right text-sm font-semibold bg-transparent outline-none min-w-0"
        style={{
          color: hasValue ? 'var(--t1)' : '#555577',
          borderBottom: hasValue ? '1px solid rgba(79,70,229,0.4)' : '1px solid transparent',
        }}
      />
    </div>
  )
}

// ── Main modal ─────────────────────────────────────────────────────────────
export default function CaptureModal({ onClose }) {
  const { accounts, cards, updateCard, addCard, updateAccount, addAccount, updateSettings, settings } = useFinanceStore()

  const [step,        setStep]        = useState(STEP.UPLOAD)
  const [imageFile,   setImageFile]   = useState(null)
  const [imageUrl,    setImageUrl]    = useState(null)
  const [progress,    setProgress]    = useState(0)
  const [parseResult, setParseResult] = useState(null)   // analyzeCapture result
  const [error,       setError]       = useState(null)

  // Review step — editable values
  const [selectedType,   setSelectedType]   = useState('card')
  const [fieldValues,    setFieldValues]    = useState({})
  const [targetId,       setTargetId]       = useState('__new__')

  const fileRef = useRef(null)
  const dropRef = useRef(null)

  // ── File selection ─────────────────────────────────────────────────────
  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Selecciona una imagen (PNG, JPG, WEBP)')
      return
    }
    const url = URL.createObjectURL(file)
    setImageFile(file)
    setImageUrl(url)
  }, [])

  const handleInputChange = (e) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  // ── Drag-and-drop ──────────────────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  // ── Start OCR analysis ─────────────────────────────────────────────────
  const startAnalysis = async () => {
    if (!imageFile) return
    setStep(STEP.ANALYZING)
    setError(null)
    setProgress(0)

    try {
      const blob   = await preprocessImage(imageFile)
      const result = await analyzeCapture(blob, setProgress)
      setParseResult(result)

      // Pre-fill editable fields with detected values
      const type = result.defaultType === 'broker' ? 'broker' : result.defaultType
      setSelectedType(type)
      setFieldValues(result.detected || {})

      // Pre-select target: find existing card/account matching institution
      const inst = result.institution
      if (type === 'card') {
        const match = cards.find(c =>
          inst && c.bankName?.toLowerCase().includes(inst.toLowerCase().split(' ')[0])
        )
        setTargetId(match?.id ?? '__new__')
      } else if (type === 'account') {
        const match = accounts.find(a =>
          inst && (a.name?.toLowerCase().includes(inst.toLowerCase()) ||
                   a.institution?.toLowerCase().includes(inst.toLowerCase().split(' ')[0]))
        )
        setTargetId(match?.id ?? '__new__')
      } else {
        setTargetId('__ibkr__')
      }

      setStep(STEP.REVIEW)
    } catch (err) {
      console.error(err)
      setError('No se pudo leer la imagen. Intenta con una captura más nítida.')
      setStep(STEP.UPLOAD)
    }
  }

  // ── Field change ───────────────────────────────────────────────────────
  const setField = (key, raw) => {
    setFieldValues(prev => ({ ...prev, [key]: raw === '' ? '' : raw }))
  }

  // Computed: available credit (for cards)
  const computedAvailable = (() => {
    const bal = parseFloat(String(fieldValues.balance ?? '').replace(/,/g, ''))
    const lim = parseFloat(String(fieldValues.limit   ?? '').replace(/,/g, ''))
    if (!isNaN(bal) && !isNaN(lim) && lim > 0) return Math.max(0, lim - bal)
    return null
  })()

  // ── Apply changes to store ─────────────────────────────────────────────
  const handleConfirm = () => {
    const num = (key) => {
      const v = fieldValues[key]
      if (v === '' || v == null) return undefined
      const n = parseFloat(String(v).replace(/,/g, ''))
      return isNaN(n) ? undefined : n
    }
    const day = (key) => {
      const v = fieldValues[key]
      const n = parseInt(v)
      return (n >= 1 && n <= 31) ? n : undefined
    }

    if (selectedType === 'card') {
      const payload = {
        balance:           num('balance'),
        limit:             num('limit'),
        cutDay:            day('cutDay'),
        dueDay:            day('dueDay'),
        minPayment:        num('minPayment'),
        noInterestPayment: num('noInterestPayment'),
      }
      // Remove undefined keys
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

      if (targetId === '__new__') {
        const inst = parseResult?.institution || 'Otro'
        addCard({ bankName: inst, cardName: inst, ...payload })
        toast.success(`Tarjeta ${inst} creada ✓`)
      } else {
        updateCard(targetId, payload)
        const card = cards.find(c => c.id === targetId)
        toast.success(`${card?.cardName || 'Tarjeta'} actualizada ✓`)
      }

    } else if (selectedType === 'account') {
      const bal = num('balance')
      if (bal !== undefined) {
        if (targetId === '__new__') {
          const inst = parseResult?.institution || 'Nueva cuenta'
          addAccount({ name: inst, type: 'ahorro', balance: bal })
          toast.success(`Cuenta ${inst} creada ✓`)
        } else {
          updateAccount(targetId, { balance: bal })
          const acc = accounts.find(a => a.id === targetId)
          toast.success(`${acc?.name || 'Cuenta'} actualizada ✓`)
        }
      }

    } else if (selectedType === 'broker' || selectedType === 'investment') {
      const ibkrData = {
        lastNLV:           num('nlv')    ?? num('balance'),
        lastCash:          num('cash'),
        lastUnrealizedPnl: num('unrealizedPnl'),
        lastDailyPnl:      num('dailyPnl'),
        syncedAt:          new Date().toISOString(),
        source:            'capture',
      }
      Object.keys(ibkrData).forEach(k => ibkrData[k] === undefined && delete ibkrData[k])
      updateSettings({
        ibkr: { ...(settings?.ibkr || {}), ...ibkrData },
      })
      toast.success('Datos de inversión actualizados ✓')
    }

    setStep(STEP.DONE)
    setTimeout(onClose, 900)
  }

  // ── Target options based on type ───────────────────────────────────────
  const targetOptions = (() => {
    if (selectedType === 'card') {
      return [
        { id: '__new__', label: '+ Crear nueva tarjeta' },
        ...cards.map(c => ({ id: c.id, label: `${c.bankName} — ${c.cardName || c.bankName}` })),
      ]
    }
    if (selectedType === 'account') {
      return [
        { id: '__new__', label: '+ Crear nueva cuenta' },
        ...accounts.map(a => ({ id: a.id, label: a.name || a.institution || 'Cuenta' })),
      ]
    }
    return [{ id: '__ibkr__', label: 'Panel Inversiones / IBKR' }]
  })()

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={step !== STEP.ANALYZING ? onClose : undefined} />

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
        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mt-3 mb-1 shrink-0" />

        {/* Header */}
        <div className="px-5 pb-2 pt-2 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#4F46E5,#818CF8)' }}>
              <Camera size={14} color="#fff" />
            </div>
            <h2 className="text-white text-base font-black">Actualizar con captura</h2>
          </div>
          {step !== STEP.ANALYZING && (
            <button onClick={onClose}
              className="btn-press w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: '#151525', border: '1px solid rgba(255,255,255,0.06)' }}>
              <X size={15} color="#8B8BAD" />
            </button>
          )}
        </div>

        {/* ── STEP 0: UPLOAD ── */}
        {step === STEP.UPLOAD && (
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {/* Drop zone */}
            <div
              ref={dropRef}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => !imageUrl && fileRef.current?.click()}
              className="relative rounded-3xl mt-2 overflow-hidden cursor-pointer transition-all"
              style={{
                border: imageUrl
                  ? '2px solid rgba(79,70,229,0.5)'
                  : '2px dashed rgba(255,255,255,0.10)',
                background: imageUrl ? 'transparent' : 'rgba(255,255,255,0.02)',
                minHeight: imageUrl ? 'auto' : 160,
              }}
            >
              {imageUrl ? (
                <div className="relative">
                  <img src={imageUrl} alt="preview"
                    className="w-full rounded-3xl object-cover"
                    style={{ maxHeight: 280 }} />
                  {/* Overlay to re-select */}
                  <button
                    onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
                    className="absolute top-3 right-3 btn-press px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1"
                    style={{ background: 'rgba(14,14,26,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <RefreshCw size={11} /> Cambiar
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-10 px-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.2)' }}>
                    <Camera size={26} color="#818CF8" />
                  </div>
                  <div className="text-center">
                    <p className="text-white text-sm font-semibold">Arrastra o toca para seleccionar</p>
                    <p className="text-[11px] mt-0.5" style={{ color: '#555577' }}>PNG · JPG · WEBP · HEIC</p>
                  </div>
                </div>
              )}
            </div>

            {/* Camera / file button */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleInputChange}
            />

            {!imageUrl && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { fileRef.current.removeAttribute('capture'); fileRef.current?.click() }}
                  className="btn-press flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--t1)' }}>
                  <Upload size={16} /> Desde galería
                </button>
                <button
                  onClick={() => { fileRef.current.setAttribute('capture', 'environment'); fileRef.current?.click() }}
                  className="btn-press flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#4F46E5,#6366F1)' }}>
                  <Camera size={16} /> Tomar foto
                </button>
              </div>
            )}

            {imageUrl && (
              <button
                onClick={startAnalysis}
                className="btn-press w-full flex items-center justify-center gap-2 mt-3 py-4 rounded-2xl text-white font-black text-base"
                style={{ background: 'linear-gradient(135deg,#4F46E5,#6366F1)', boxShadow: '0 4px 20px rgba(79,70,229,0.3)' }}>
                <Sparkles size={18} /> Analizar captura
              </button>
            )}

            {/* Supported apps */}
            <div className="mt-5">
              <p className="text-[11px] font-semibold mb-2.5 uppercase tracking-wider" style={{ color: '#555577' }}>
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

            {error && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-2xl"
                style={{ background: 'rgba(225,29,72,0.06)', border: '1px solid rgba(225,29,72,0.2)' }}>
                <AlertCircle size={16} color="#E11D48" className="shrink-0 mt-0.5" />
                <p className="text-sm" style={{ color: '#E11D48' }}>{error}</p>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 1: ANALYZING ── */}
        {step === STEP.ANALYZING && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5 pb-10">
            {imageUrl && (
              <img src={imageUrl} alt="preview"
                className="w-24 h-32 object-cover rounded-2xl opacity-60"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
            )}
            <div className="relative flex items-center justify-center">
              <ProgressRing progress={progress} />
              <div className="absolute flex flex-col items-center">
                <span className="text-white text-sm font-black">{Math.round(progress * 100)}%</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-sm">Leyendo captura...</p>
              <p className="text-[12px] mt-1" style={{ color: '#555577' }}>
                {progress < 0.3 ? 'Cargando motor de OCR' :
                 progress < 0.7 ? 'Reconociendo texto' :
                 'Extrayendo datos financieros'}
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 2: REVIEW ── */}
        {step === STEP.REVIEW && parseResult && (
          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">

            {/* Institution badge */}
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-2">
                {parseResult.institution ? (
                  <>
                    <span className="text-xl">{parseResult.institutionMeta?.icon || '🏦'}</span>
                    <div>
                      <p className="text-white font-black text-sm">{parseResult.institution}</p>
                      <p className="text-[11px]" style={{ color: '#4ADE80' }}>✓ Institución detectada</p>
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="text-white font-bold text-sm">Captura procesada</p>
                    <p className="text-[11px]" style={{ color: '#FBBF24' }}>⚠ Institución no reconocida — verifica los datos</p>
                  </div>
                )}
              </div>

              {/* Type selector */}
              <div className="relative">
                <select
                  value={selectedType}
                  onChange={e => { setSelectedType(e.target.value); setFieldValues({}) }}
                  className="appearance-none text-xs font-bold pl-3 pr-7 py-2 rounded-xl"
                  style={{
                    background: 'rgba(79,70,229,0.15)',
                    border: '1px solid rgba(79,70,229,0.3)',
                    color: '#818CF8',
                  }}>
                  <option value="card">Tarjeta</option>
                  <option value="account">Cuenta</option>
                  <option value="broker">Broker/IBKR</option>
                  <option value="investment">Inversión</option>
                </select>
                <ChevronDown size={12} color="#818CF8" className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Image thumbnail */}
            {imageUrl && (
              <img src={imageUrl} alt="captura"
                className="w-full rounded-2xl object-cover"
                style={{ maxHeight: 140, border: '1px solid rgba(255,255,255,0.06)' }} />
            )}

            {/* Detected fields */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#13131F', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="px-4 py-2.5 border-b flex items-center gap-1.5" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <Sparkles size={13} color="#818CF8" />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#818CF8' }}>
                  Datos detectados — edita si es necesario
                </span>
              </div>
              <div className="px-4 py-1">
                {getFieldsForType(selectedType).map(def => {
                  const displayVal = def.key === 'available'
                    ? (computedAvailable ?? fieldValues[def.key])
                    : fieldValues[def.key]
                  return (
                    <Field
                      key={def.key}
                      def={def}
                      value={def.key === 'available' ? displayVal : (fieldValues[def.key] ?? '')}
                      onChange={val => setField(def.key, val)}
                      detected={parseResult.detected?.[def.key]}
                    />
                  )
                })}

                {/* Unknown institution fallback: show top amounts */}
                {!parseResult.institution && parseResult.topAmounts?.length > 0 && (
                  <div className="pt-2 pb-1">
                    <p className="text-[11px] font-medium mb-2" style={{ color: '#555577' }}>
                      Montos detectados en la imagen — toca para usar:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {parseResult.topAmounts.map((amt, i) => (
                        <button key={i}
                          onClick={() => setField('balance', amt)}
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

            {/* Apply to */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#13131F', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="px-4 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#8B8BAD' }}>
                  Aplicar a
                </span>
              </div>
              <div className="px-4 py-3">
                <div className="relative">
                  <select
                    value={targetId}
                    onChange={e => setTargetId(e.target.value)}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'var(--t1)',
                      borderRadius: 12,
                      padding: '10px 36px 10px 12px',
                      width: '100%',
                      fontSize: 14,
                      fontWeight: 600,
                      appearance: 'none',
                    }}>
                    {targetOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} color="#8B8BAD" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Confirm button */}
            <button
              onClick={handleConfirm}
              className="btn-press w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#4F46E5,#6366F1)', boxShadow: '0 4px 20px rgba(79,70,229,0.3)' }}>
              <CheckCircle2 size={18} /> Confirmar y actualizar
            </button>
          </div>
        )}

        {/* ── STEP 3: DONE ── */}
        {step === STEP.DONE && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-5 pb-10">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <CheckCircle2 size={32} color="#4ADE80" />
            </div>
            <div className="text-center">
              <p className="text-white font-black text-lg">¡Actualizado!</p>
              <p className="text-sm mt-1" style={{ color: '#8B8BAD' }}>Los datos se aplicaron al dashboard</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

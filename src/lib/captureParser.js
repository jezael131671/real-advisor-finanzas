// ── captureParser.js ──────────────────────────────────────────────────────────
// OCR-based financial screenshot parser.
// Uses Tesseract.js (100% browser, no API key required).
// Supports: BBVA, Nu, Stori, DiDi Card, Revolut, IBKR, GBM+, Mercado Pago.
// ─────────────────────────────────────────────────────────────────────────────

// ── Image preprocessing (resize + contrast boost for better OCR) ──────────
export async function preprocessImage(file) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      const MAX_W = 1400
      const scale = Math.min(1, MAX_W / img.naturalWidth)
      const w = Math.round(img.naturalWidth  * scale)
      const h = Math.round(img.naturalHeight * scale)

      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)

      // Light contrast boost — keeps colour info (Tesseract works on greyscale internally)
      const id   = ctx.getImageData(0, 0, w, h)
      const data = id.data
      const C    = 1.4   // contrast factor
      for (let i = 0; i < data.length; i += 4) {
        data[i]   = clamp((data[i]   - 128) * C + 128)
        data[i+1] = clamp((data[i+1] - 128) * C + 128)
        data[i+2] = clamp((data[i+2] - 128) * C + 128)
      }
      ctx.putImageData(id, 0, 0)

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        resolve(blob || file)
      }, 'image/png')
    }

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

const clamp = (v) => Math.min(255, Math.max(0, Math.round(v)))

// ── Institution fingerprints ───────────────────────────────────────────────
// Each entry: { patterns[], defaultType, fields{} }
const INSTITUTIONS = [
  {
    name: 'IBKR',
    color: '#E31837',
    icon: '📊',
    defaultType: 'broker',
    patterns: [
      /interactive\s*brokers/i, /net\s*liquidation/i,
      /\bIBKR\b/, /\bTWS\b/, /day['']?s\s*p&l/i,
    ],
    fields: {
      nlv:           { label: 'Net Liquidation Value', keywords: ['net liquidation', 'nlv', 'valor liquidaci'] },
      cash:          { label: 'Cash disponible',       keywords: ['total cash', 'cash balance', 'efectivo'] },
      dailyPnl:      { label: 'Daily P&L',             keywords: ["day's p&l", 'daily p&l', 'p&l diario'] },
      unrealizedPnl: { label: 'P&L no realizado',      keywords: ['unrealized', 'no realizado'] },
    },
  },
  {
    name: 'BBVA',
    color: '#004691',
    icon: '🏦',
    defaultType: 'card',
    patterns: [/\bBBVA\b/, /bancomer/i, /az[au]l\s+de\s+coraz/i],
    fields: {
      balance:    { label: 'Saldo adeudado',     keywords: ['saldo adeudado', 'tu deuda', 'debes', 'saldo actual'] },
      limit:      { label: 'Límite de crédito',  keywords: ['límite de crédito', 'limite de credito', 'crédito total'] },
      available:  { label: 'Crédito disponible', keywords: ['crédito disponible', 'credito disponible', 'disponible'] },
      cutDay:     { label: 'Día de corte',        keywords: ['fecha de corte', 'corte'], isDay: true },
      dueDay:     { label: 'Día límite de pago',  keywords: ['fecha límite', 'fecha limite', 'límite de pago'], isDay: true },
      minPayment: { label: 'Pago mínimo',         keywords: ['pago mínimo', 'pago minimo', 'pago mín'] },
    },
  },
  {
    name: 'Nu',
    color: '#820AD1',
    icon: '🟣',
    defaultType: 'card',
    patterns: [/\bNu\b/, /nubank/i, /nu\.com/i, /shopping\s+con\s+nu/i],
    fields: {
      balance:          { label: 'Saldo al corte',            keywords: ['saldo al corte', 'total a pagar', 'debes', 'saldo actual'] },
      available:        { label: 'Crédito disponible',        keywords: ['disponible', 'crédito disponible'] },
      limit:            { label: 'Límite de crédito',         keywords: ['límite', 'limite'] },
      noInterestPayment:{ label: 'Pago sin intereses',        keywords: ['pago para no generar', 'sin intereses', 'pago total'] },
      minPayment:       { label: 'Pago mínimo',               keywords: ['pago mínimo', 'mínimo'] },
      dueDay:           { label: 'Día límite de pago',        keywords: ['fecha límite', 'fecha de pago', 'vence'], isDay: true },
    },
  },
  {
    name: 'Stori',
    color: '#FF5A5F',
    icon: '🔴',
    defaultType: 'card',
    patterns: [/\bStori\b/i, /storicard/i],
    fields: {
      balance:   { label: 'Saldo adeudado',     keywords: ['saldo', 'deuda', 'debes'] },
      available: { label: 'Crédito disponible', keywords: ['disponible', 'crédito disponible'] },
      limit:     { label: 'Límite de crédito',  keywords: ['límite', 'limite'] },
      cutDay:    { label: 'Día de corte',        keywords: ['corte', 'fecha de corte'], isDay: true },
      dueDay:    { label: 'Día de pago',         keywords: ['pago', 'fecha de pago', 'límite'], isDay: true },
    },
  },
  {
    name: 'DiDi Card',
    color: '#FF6620',
    icon: '🟠',
    defaultType: 'card',
    patterns: [/\bDiDi\b/i, /didi\s*card/i, /didicard/i],
    fields: {
      balance:   { label: 'Saldo al corte',      keywords: ['saldo al corte', 'saldo', 'debes'] },
      available: { label: 'Crédito disponible',  keywords: ['crédito disponible', 'disponible'] },
      limit:     { label: 'Límite de crédito',   keywords: ['límite', 'limite'] },
      cutDay:    { label: 'Día de corte',         keywords: ['corte'], isDay: true },
      dueDay:    { label: 'Día de pago',          keywords: ['pago', 'vencimiento'], isDay: true },
    },
  },
  {
    name: 'Revolut',
    color: '#0075EB',
    icon: '💙',
    defaultType: 'account',
    patterns: [/\bRevolut\b/i],
    fields: {
      balance: { label: 'Saldo total', keywords: ['total balance', 'saldo', 'balance'] },
    },
  },
  {
    name: 'GBM+',
    color: '#1A1A2E',
    icon: '📈',
    defaultType: 'investment',
    patterns: [/\bGBM\+?\b/i, /gbm\s+home/i],
    fields: {
      balance:  { label: 'Valor del portafolio', keywords: ['portafolio', 'total', 'valor'] },
      dailyPnl: { label: 'Rendimiento del día',  keywords: ['rendimiento', 'ganancia', 'p&l'] },
    },
  },
  {
    name: 'Mercado Pago',
    color: '#009EE3',
    icon: '💛',
    defaultType: 'account',
    patterns: [/mercado\s*pago/i, /\bMPago\b/i],
    fields: {
      balance:   { label: 'Dinero en cuenta',   keywords: ['dinero en cuenta', 'saldo', 'disponible'] },
      investment:{ label: 'Mercado Fondo',       keywords: ['fondo', 'rendimiento', 'invertido'] },
    },
  },
]

// ── Text utilities ─────────────────────────────────────────────────────────
const AMOUNT_RE = /(-?\s*\$?\s*[\d]{1,3}(?:[,.][\d]{3})*(?:[.,][\d]{1,2})?)/g

function parseAmount(raw) {
  if (!raw) return null
  // Remove spaces, $, then normalise: commas as thousands → remove, dot as decimal
  const s = raw.replace(/\s/g, '').replace(/\$/g, '').trim()
  // Handle "1,234.56" format (comma=thousands, dot=decimal)
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) {
    return parseFloat(s.replace(/,/g, '')) || null
  }
  // Handle "1.234,56" format (dot=thousands, comma=decimal) — common in Latin America
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || null
  }
  // Plain number
  return parseFloat(s.replace(/,/g, '')) || null
}

function findAmountNearKeyword(lines, keywords, maxAfter = 4) {
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase()
    if (!keywords.some(kw => lower.includes(kw.toLowerCase()))) continue

    // Search in the same line and next maxAfter lines
    const window = lines.slice(i, i + maxAfter + 1).join(' ')
    const matches = [...window.matchAll(AMOUNT_RE)]
    for (const m of matches) {
      const val = parseAmount(m[1])
      if (val !== null && val > 0) return val
    }
  }
  return null
}

function findDayNearKeyword(lines, keywords, maxAfter = 3) {
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase()
    if (!keywords.some(kw => lower.includes(kw.toLowerCase()))) continue

    const window = lines.slice(i, i + maxAfter + 1).join(' ')

    // "15 de julio" or "15 de jul"
    const mde = window.match(/(\d{1,2})\s+de\s+\w+/i)
    if (mde) { const d = parseInt(mde[1]); if (d >= 1 && d <= 31) return d }

    // "15/07" or "15-07"
    const mslash = window.match(/\b(\d{1,2})[\/\-]\d{2}/)
    if (mslash) { const d = parseInt(mslash[1]); if (d >= 1 && d <= 31) return d }

    // Standalone day number
    const mday = window.match(/\b(\d{1,2})\b/)
    if (mday) { const d = parseInt(mday[1]); if (d >= 1 && d <= 31) return d }
  }
  return null
}

// ── Institution detection ──────────────────────────────────────────────────
function detectInstitution(text) {
  for (const inst of INSTITUTIONS) {
    if (inst.patterns.some(re => re.test(text))) return inst
  }
  return null
}

// ── All amounts in text (for "unknown" mode) ───────────────────────────────
function extractAllAmounts(text) {
  const found = []
  const matches = [...text.matchAll(AMOUNT_RE)]
  for (const m of matches) {
    const val = parseAmount(m[1])
    if (val !== null && val >= 10) found.push(val)   // skip tiny numbers
  }
  // Deduplicate
  return [...new Set(found)].sort((a, b) => b - a).slice(0, 8)
}

// ── Main OCR + parse pipeline ──────────────────────────────────────────────
export async function analyzeCapture(imageBlob, onProgress) {
  // Dynamic import so the heavy Tesseract bundle only loads when actually used
  const { createWorker } = await import('tesseract.js')

  // Progress phases: loading (0–0.3) → recognising (0.3–1.0)
  let loadDone = false
  const worker = await createWorker('spa+eng', 1, {
    logger: (m) => {
      if (!onProgress) return
      if (m.status === 'loading tesseract core' || m.status === 'loading language traineddata') {
        if (!loadDone) onProgress(m.progress * 0.3)
      } else if (m.status === 'recognizing text') {
        loadDone = true
        onProgress(0.3 + m.progress * 0.7)
      }
    },
  })

  let text = ''
  try {
    const result = await worker.recognize(imageBlob)
    text = result.data.text || ''
  } finally {
    await worker.terminate()
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const institution = detectInstitution(text)

  // ── Extract fields ───────────────────────────────────────────────────────
  const detected = {}
  if (institution) {
    for (const [fieldKey, fieldDef] of Object.entries(institution.fields)) {
      if (fieldDef.isDay) {
        detected[fieldKey] = findDayNearKeyword(lines, fieldDef.keywords)
      } else {
        detected[fieldKey] = findAmountNearKeyword(lines, fieldDef.keywords)
      }
    }
  }

  // Always extract a "topAmounts" list — useful for unknown or fallback
  const topAmounts = extractAllAmounts(text)

  return {
    institution: institution?.name     ?? null,
    institutionMeta: institution        ?? null,
    defaultType: institution?.defaultType ?? 'account',
    detected,
    topAmounts,
    rawText: text,
    lines,
  }
}

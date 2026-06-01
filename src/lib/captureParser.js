// ── captureParser.js ──────────────────────────────────────────────────────────
// OCR-based financial screenshot parser (Tesseract.js v7, 100% browser).
// Supports: IBKR, BBVA, Nu, Stori, DiDi Card, Revolut, GBM+, Mercado Pago.
// ─────────────────────────────────────────────────────────────────────────────

// ── Image pre-processing ───────────────────────────────────────────────────
// Resize large images and lightly boost contrast for better OCR accuracy.
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

      // Mild contrast boost — Tesseract handles grayscale internally
      const id   = ctx.getImageData(0, 0, w, h)
      const d    = id.data
      const C    = 1.35
      for (let i = 0; i < d.length; i += 4) {
        d[i]   = clamp((d[i]   - 128) * C + 128)
        d[i+1] = clamp((d[i+1] - 128) * C + 128)
        d[i+2] = clamp((d[i+2] - 128) * C + 128)
      }
      ctx.putImageData(id, 0, 0)

      canvas.toBlob(
        (blob) => { URL.revokeObjectURL(url); resolve(blob || file) },
        'image/png'
      )
    }

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

const clamp = (v) => Math.min(255, Math.max(0, Math.round(v)))

// ── Institution definitions ────────────────────────────────────────────────
// patterns: array of RegExps that identify this app in OCR text.
// defaultType: 'card' | 'account' | 'broker' | 'investment'
// fields: keys to extract → { label, keywords[], isDay? }
// ──────────────────────────────────────────────────────────────────────────
const INSTITUTIONS = [
  {
    name: 'IBKR',
    color: '#E31837',
    icon: '📊',
    defaultType: 'broker',
    patterns: [
      /interactive\s+brokers/i,
      /net\s+liquidation/i,
      /\bIBKR\b/,
      /\bTWS\b/,
      /day.?s\s+p.?l/i,           // "Day's P&L" (OCR may mangle apostrophe)
      /unrealized\s+p.?l/i,
    ],
    fields: {
      nlv:           { label: 'Net Liquidation Value', keywords: ['net liquidation', 'net liq', 'nlv'] },
      cash:          { label: 'Cash disponible',       keywords: ['total cash', 'cash balance', 'available cash'] },
      dailyPnl:      { label: 'Daily P&L',             keywords: ["day's p", 'daily p', "day p"] },
      unrealizedPnl: { label: 'Unrealized P&L',        keywords: ['unrealized', 'unreal'] },
    },
  },
  {
    name: 'BBVA',
    color: '#004691',
    icon: '🏦',
    defaultType: 'card',
    patterns: [
      /\bBBVA\b/,
      /bancomer/i,
      /azul\s+de\s+coraz/i,
    ],
    fields: {
      balance:    { label: 'Saldo adeudado',     keywords: ['saldo adeudado', 'saldo actual', 'tu deuda', 'total a pagar'] },
      limit:      { label: 'Límite de crédito',  keywords: ['límite de crédito', 'limite de credito', 'crédito total', 'credito total'] },
      available:  { label: 'Crédito disponible', keywords: ['crédito disponible', 'credito disponible', 'disponible para'] },
      cutDay:     { label: 'Día de corte',        keywords: ['fecha de corte', 'fecha corte', 'fecha  corte'], isDay: true },
      dueDay:     { label: 'Día límite de pago',  keywords: ['fecha límite', 'fecha limite', 'límite de pago', 'limite de pago'], isDay: true },
      minPayment: { label: 'Pago mínimo',         keywords: ['pago mínimo', 'pago minimo', 'pago mín', 'pago min'] },
    },
  },
  {
    name: 'Nu',
    color: '#820AD1',
    icon: '🟣',
    defaultType: 'card',
    patterns: [
      /\bNubank\b/i,
      /nu\.com/i,
      /\bNu\b/,                    // logo text — keep last so more specific ones match first
      /hola.*nu/i,                 // "Hola, [name]" on Nu home screen
    ],
    fields: {
      balance:           { label: 'Saldo al corte',       keywords: ['saldo al corte', 'total a pagar', 'saldo actual', 'debes', 'tu saldo'] },
      limit:             { label: 'Límite de crédito',    keywords: ['límite de crédito', 'limite de credito', 'tu límite', 'tu limite'] },
      available:         { label: 'Crédito disponible',   keywords: ['crédito disponible', 'credito disponible', 'disponible'] },
      noInterestPayment: { label: 'Pago sin intereses',   keywords: ['pago para no generar', 'sin intereses', 'pago total', 'pago completo'] },
      minPayment:        { label: 'Pago mínimo',          keywords: ['pago mínimo', 'pago minimo', 'mínimo'] },
      dueDay:            { label: 'Día límite de pago',   keywords: ['fecha límite', 'fecha limite', 'fecha de pago', 'pagar antes'], isDay: true },
    },
  },
  {
    name: 'Stori',
    color: '#FF5A5F',
    icon: '🔴',
    defaultType: 'card',
    patterns: [
      /\bStori\b/i,
      /storicard/i,
      /stori\.mx/i,
    ],
    fields: {
      balance:   { label: 'Saldo adeudado',     keywords: ['saldo', 'deuda', 'debes', 'adeudas'] },
      limit:     { label: 'Límite de crédito',  keywords: ['límite', 'limite', 'crédito total', 'credito total'] },
      available: { label: 'Crédito disponible', keywords: ['disponible', 'crédito disponible'] },
      cutDay:    { label: 'Día de corte',        keywords: ['corte', 'fecha de corte'], isDay: true },
      dueDay:    { label: 'Día de pago',         keywords: ['pago', 'fecha de pago', 'fecha límite'], isDay: true },
    },
  },
  {
    name: 'DiDi Card',
    color: '#FF6620',
    icon: '🟠',
    defaultType: 'card',
    patterns: [/\bDiDi\b/i, /didi\s*card/i, /didicard/i],
    fields: {
      balance:   { label: 'Saldo al corte',     keywords: ['saldo al corte', 'saldo', 'debes'] },
      limit:     { label: 'Límite de crédito',  keywords: ['límite', 'limite'] },
      available: { label: 'Crédito disponible', keywords: ['crédito disponible', 'disponible'] },
      cutDay:    { label: 'Día de corte',        keywords: ['corte', 'fecha de corte'], isDay: true },
      dueDay:    { label: 'Día de pago',         keywords: ['pago', 'vencimiento'], isDay: true },
    },
  },
  {
    name: 'Revolut',
    color: '#0075EB',
    icon: '💙',
    defaultType: 'account',
    patterns: [/\bRevolut\b/i],
    fields: {
      balance: { label: 'Saldo total', keywords: ['total balance', 'total', 'balance', 'saldo'] },
    },
  },
  {
    name: 'GBM+',
    color: '#1A1A2E',
    icon: '📈',
    defaultType: 'investment',
    patterns: [/\bGBM\+?\b/i, /gbm\s+home/i],
    fields: {
      balance:  { label: 'Valor del portafolio', keywords: ['portafolio', 'total', 'valor total'] },
      dailyPnl: { label: 'Rendimiento del día',  keywords: ['rendimiento', 'ganancia del día', 'rendimiento del día'] },
    },
  },
  {
    name: 'Mercado Pago',
    color: '#009EE3',
    icon: '💛',
    defaultType: 'account',
    patterns: [/mercado\s*pago/i, /\bMercadoPago\b/i],
    fields: {
      balance:    { label: 'Dinero disponible', keywords: ['dinero en cuenta', 'disponible', 'saldo'] },
      investment: { label: 'Mercado Fondo',     keywords: ['fondo', 'invertido', 'rendimiento'] },
    },
  },
]

// ── Amount parsing ─────────────────────────────────────────────────────────
// Matches a wide range of formatted and plain numbers:
//   $1,234.56  →  1234.56
//   $1.234,56  →  1234.56  (Latin America format)
//   12450.00   →  12450.00
//   12,450     →  12450
//   12 450.50  →  12450.50
//
// Requires at least 3 digits to avoid matching dates/day-numbers.
const AMOUNT_PATTERNS = [
  // With $: $1,234.56 or $1.234,56 or $12450
  /\$\s*(\d[\d,. ]*\d)/g,
  // Without $, needs at least 4 digits to reduce false positives
  /(?<![/\-])\b(\d{1,3}(?:[,. ]\d{3})+(?:[,.]\d{1,2})?)\b/g,   // thousands-grouped
  /(?<![/\-])\b(\d{4,}(?:[.,]\d{2})?)\b/g,                       // plain 4+ digit number
]

export function parseAmount(raw) {
  if (!raw) return null
  const s = raw.replace(/\s/g, '').replace(/\$/g, '').trim()
  if (!s) return null

  // 1,234.56 — comma=thousands, dot=decimal
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) {
    return parseFloat(s.replace(/,/g, '')) || null
  }
  // 1.234,56 — dot=thousands, comma=decimal
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || null
  }
  // 1 234.56 — space=thousands, dot=decimal
  if (/^\d{1,3}( \d{3})+(\.\d{1,2})?$/.test(s)) {
    return parseFloat(s.replace(/ /g, '')) || null
  }
  // 1234.56 or 1234,56 — plain with optional decimal
  const plain = parseFloat(s.replace(/,/g, '.').replace(/\.(?=.*\.)/g, '')) // keep last dot only
  return isNaN(plain) || plain <= 0 ? null : plain
}

// Extract all amount candidates from a text segment
function extractAmountsFromSegment(seg) {
  const seen = new Set()
  const results = []

  for (const re of AMOUNT_PATTERNS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(seg)) !== null) {
      const raw = m[1]
      if (seen.has(raw)) continue
      seen.add(raw)
      const val = parseAmount(raw)
      if (val !== null && val >= 1 && val < 100_000_000) results.push(val)
    }
  }

  return results
}

// Find the closest amount in the lines near a keyword
function findAmountNearKeyword(lines, keywords, maxAfter = 4) {
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase()
    if (!keywords.some(kw => lower.includes(kw.toLowerCase()))) continue

    // Scan this line + next maxAfter lines for the first valid amount
    const seg = lines.slice(i, i + maxAfter + 1).join(' ')
    const amounts = extractAmountsFromSegment(seg)
    if (amounts.length > 0) return amounts[0]
  }
  return null
}

// Extract a day number (1–31) near a keyword, from date patterns
function findDayNearKeyword(lines, keywords, maxAfter = 3) {
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase()
    if (!keywords.some(kw => lower.includes(kw.toLowerCase()))) continue

    const seg = lines.slice(i, i + maxAfter + 1).join(' ')

    // "15 de julio" or "15 de jul"
    const mDE = seg.match(/(\d{1,2})\s+de\s+\w+/i)
    if (mDE) { const d = parseInt(mDE[1]); if (d >= 1 && d <= 31) return d }

    // "15/07" or "15-07"
    const mSlash = seg.match(/\b(\d{1,2})[/\-]\d{2}\b/)
    if (mSlash) { const d = parseInt(mSlash[1]); if (d >= 1 && d <= 31) return d }

    // Standalone number 1–31 (careful: avoid matching year digits)
    const mDay = seg.match(/\b([12]?\d|3[01])\b/)
    if (mDay) { const d = parseInt(mDay[1]); if (d >= 1 && d <= 31) return d }
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

// ── Fallback: all notable amounts in the full text ─────────────────────────
function extractTopAmounts(text) {
  const all = extractAmountsFromSegment(text)
  // Deduplicate and sort largest first
  return [...new Set(all)].sort((a, b) => b - a).slice(0, 8)
}

// ── Main export ────────────────────────────────────────────────────────────
export async function analyzeCapture(imageBlob, onProgress) {
  // Dynamic import — Tesseract (~1MB) only loads when the user opens this modal
  const { createWorker } = await import('tesseract.js')

  const notify = (pct) => { if (onProgress) onProgress(Math.min(1, pct)) }

  // Track whether the loading phase has finished
  let loadingDone = false

  const worker = await createWorker('spa+eng', 1, {
    logger: (msg) => {
      const { status, progress = 0 } = msg
      if (!loadingDone) {
        // Loading phase (core + traineddata): map to 0–30%
        if (status?.includes('loading') || status?.includes('initializing')) {
          notify(progress * 0.3)
        }
      }
      if (status === 'recognizing text') {
        loadingDone = true
        notify(0.3 + progress * 0.7)
      }
    },
  })

  let rawText = ''
  try {
    const result = await worker.recognize(imageBlob)
    rawText = result?.data?.text || ''
  } finally {
    // Always terminate to free memory
    await worker.terminate().catch(() => {})
  }

  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1)   // drop single-char noise lines

  const institution = detectInstitution(rawText)

  // Extract typed fields for detected institution
  const detected = {}
  if (institution) {
    for (const [key, def] of Object.entries(institution.fields)) {
      detected[key] = def.isDay
        ? findDayNearKeyword(lines, def.keywords)
        : findAmountNearKeyword(lines, def.keywords)
    }
  }

  return {
    institution:     institution?.name        ?? null,
    institutionMeta: institution              ?? null,
    defaultType:     institution?.defaultType ?? 'account',
    detected,
    topAmounts: extractTopAmounts(rawText),
    rawText,
    lines,
  }
}

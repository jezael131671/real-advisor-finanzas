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

// ── Product type classification ─────────────────────────────────────────────
// Determines the FINANCIAL PRODUCT TYPE from OCR text, independent of institution.
// This fixes the bug where BBVA debit screenshots were classified as credit cards.
//
// productType: 'debit_account' | 'credit_card' | 'savings_account' |
//              'investment_account' | 'loan' | 'unknown'
// ──────────────────────────────────────────────────────────────────────────

const PRODUCT_RULES = {
  investment_account: {
    positive: [
      /net\s+liquidation/i, /market\s+value/i, /total\s+cash/i,
      /day.?s?\s+p.?[&l]/i, /unrealized/i, /positions/i,
      /\bIBKR\b/i, /\bTWS\b/i, /portfolio\s+value/i, /net\s+liq/i,
    ],
    negative: [],
    weight: 4,
  },
  credit_card: {
    positive: [
      /saldo\s+adeudado/i, /l[ií]mite\s+de\s+cr[eé]dito/i,
      /cr[eé]dito\s+disponible/i, /pago\s+m[íi]nimo/i,
      /pago\s+sin\s+intereses/i, /d[íi]a\s+de\s+corte/i,
      /fecha\s+l[íi]mite/i, /fecha\s+de\s+corte/i,
      /pago\s+para\s+no\s+generar/i, /tu\s+deuda/i,
    ],
    negative: [
      /visa\s+d[eé]bito/i, /tarjeta\s+de\s+d[eé]bito/i,
      /cuenta\s+asociada/i,
    ],
    weight: 3,
  },
  debit_account: {
    positive: [
      /visa\s+d[eé]bito/i, /tarjeta\s+de\s+d[eé]bito/i,
      /cuenta\s+asociada/i, /saldo\s+disponible/i,
      /d[eé]bito/i, /cuenta\s+de\s+d[eé]bito/i,
      /disponible\s+en\s+cuenta/i,
    ],
    negative: [
      /pago\s+m[íi]nimo/i, /l[íi]mite\s+de\s+cr[eé]dito/i,
      /saldo\s+adeudado/i, /pago\s+sin\s+intereses/i,
    ],
    weight: 3,
  },
  savings_account: {
    positive: [
      /rendimiento/i, /tasa\s+de\s+inter[eé]s/i,
      /cuenta\+/i, /ahorro/i, /fondo\s+de/i,
      /invertido/i, /garant[íi]a/i,
    ],
    negative: [
      /visa\s+d[eé]bito/i, /pago\s+m[íi]nimo/i,
    ],
    weight: 2,
  },
  loan: {
    positive: [
      /pr[eé]stamo/i, /cr[eé]dito\s+personal/i,
      /saldo\s+insoluto/i, /mensualidad/i, /adeudo/i,
    ],
    negative: [],
    weight: 2,
  },
}

export function classifyCapture(rawText, lines) {
  const institution = detectInstitution(rawText)
  const scores = {}

  // Score each product type
  for (const [type, rule] of Object.entries(PRODUCT_RULES)) {
    let s = 0
    rule.positive.forEach(re => { if (re.test(rawText)) s += rule.weight })
    rule.negative.forEach(re => { if (re.test(rawText)) s -= rule.weight * 2 })
    scores[type] = s
  }

  // Institution-level strong priors
  if (institution?.name === 'IBKR')         scores.investment_account += 10
  if (institution?.name === 'GBM+')         scores.investment_account += 10
  if (institution?.name === 'Revolut')      scores.debit_account      += 2
  if (institution?.name === 'Mercado Pago') scores.debit_account      += 1
  if (institution?.defaultType === 'broker') scores.investment_account += 5

  // Pick winner — must have positive score
  let productType = 'unknown'
  let maxScore    = 0
  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) { maxScore = score; productType = type }
  }

  // ── Extract card / account terminal digits ─────────────────────────────
  // Matches: •0084  ***0084  ****0084  terminación 0084
  const last4Match = rawText.match(/[•·*]{2,}\s*(\d{4})\b/)
    || rawText.match(/terminaci[oó]n[:\s]+(\d{4})/i)
    || rawText.match(/\*{3,}\s*(\d{4})/)
  const last4 = last4Match?.[1] ?? null

  // Linked account: •82638 (up to 5 digits after bullet)
  const linkedMatch = rawText.match(/cuenta\s+asociada[^•·*\d]*[•·*]+\s*(\d{3,6})/i)
    || rawText.match(/cuenta\s+n[uú]m[ero]*[^•·*\d]*[•·*]+\s*(\d{3,6})/i)
  const linkedAccountLast4 = linkedMatch ? linkedMatch[1].slice(-4) : null

  // Currency
  const currency = /\bUSD\b|u\.s\.\s*dollar/i.test(rawText) ? 'USD' : 'MXN'

  // ── Build product name ─────────────────────────────────────────────────
  let productName = institution?.name ?? ''
  if (/visa\s+d[eé]bito/i.test(rawText))       productName += ' Débito'
  else if (/oro\b/i.test(rawText) && productType === 'credit_card') productName += ' Oro'
  else if (/cuenta\+/i.test(rawText))            productName += ' Cuenta+'
  else if (/garant[íi]a/i.test(rawText))         productName += ' Garantía'
  else if (productType === 'credit_card')         productName += ' Crédito'
  else if (productType === 'debit_account')       productName += ' Débito'
  else if (productType === 'savings_account')     productName += ' Ahorro'
  else if (productType === 'investment_account')  productName += ' Portfolio'
  if (last4 && productType !== 'investment_account') productName += ` •${last4}`

  const confidence = Math.min(1, maxScore / 12)

  // ── Suggested action (human-readable) ─────────────────────────────────
  const suggestedAction = {
    debit_account:       'Actualizar saldo de cuenta débito',
    credit_card:         'Actualizar saldo de tarjeta de crédito',
    savings_account:     'Actualizar saldo de cuenta de ahorro',
    investment_account:  'Actualizar NLV de portafolio IBKR',
    loan:                'Actualizar saldo de préstamo',
    unknown:             'Revisar y clasificar manualmente',
  }[productType] ?? 'Revisar manualmente'

  return {
    institution:        institution?.name          ?? null,
    institutionMeta:    institution                ?? null,
    productType,
    productName:        productName.trim(),
    last4,
    linkedAccountLast4,
    currency,
    confidence,
    scores,
    suggestedAction,
  }
}

// ── Movement detection ──────────────────────────────────────────────────────
// Extracts visible transactions from the OCR text (e.g. account statement lines).
// Returns up to 5 movement candidates with status='pending'.
// ──────────────────────────────────────────────────────────────────────────
const MONTH_MAP = {
  enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,
  julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12,
  jan:1,feb:2,mar:3,apr:4,may:5,jun:6,
  jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
}

export function detectMovements(rawText, lines) {
  const movements = []
  const seen = new Set()
  const year  = new Date().getFullYear()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Match a signed/negative amount: -$150.00  –150.00  +$200
    const amtMatch = line.match(/([+\-–−])\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/)
    if (!amtMatch) continue

    const sign   = amtMatch[1] === '+' ? 'credit' : 'debit'
    const amount = parseAmount(amtMatch[2])
    if (!amount || amount < 1 || amount > 1_000_000) continue

    const key = `${sign}-${amount.toFixed(2)}`
    if (seen.has(key)) continue
    seen.add(key)

    // Build description from context
    const ctx = [lines[i - 2], lines[i - 1], line, lines[i + 1]]
      .filter(Boolean)
      .join(' ')
    const desc = ctx
      .replace(/[+\-–−]?\$?\s*[\d,]+(?:\.\d{1,2})?/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 60) || 'Movimiento detectado'

    // Detect date in context
    let date = new Date().toISOString().split('T')[0]
    const dMatch = ctx.match(/(\d{1,2})\s+de\s+(\w+)/i)
      || ctx.match(/(\d{1,2})[/\-](\d{1,2})/)
    if (dMatch) {
      const day   = parseInt(dMatch[1])
      const month = MONTH_MAP[dMatch[2]?.toLowerCase()] ?? parseInt(dMatch[2])
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        date = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
      }
    }

    movements.push({
      id:          `mov-${Date.now()}-${i}`,
      description: desc,
      amount,
      sign,
      type:        sign === 'debit' ? 'gasto' : 'ingreso',
      date,
      status:      'pending',
    })

    if (movements.length >= 5) break
  }

  return movements
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

  const institution    = detectInstitution(rawText)
  const classification = classifyCapture(rawText, lines)
  const movements      = detectMovements(rawText, lines)

  // Extract typed fields for detected institution
  const detected = {}
  if (institution) {
    for (const [key, def] of Object.entries(institution.fields)) {
      detected[key] = def.isDay
        ? findDayNearKeyword(lines, def.keywords)
        : findAmountNearKeyword(lines, def.keywords)
    }
  }

  // ── Product-type-aware extraction (overrides institution keywords) ─────────
  // BBVA institution uses credit-card keywords ('saldo adeudado', 'tu deuda').
  // For a debit screenshot, those don't match — we need 'saldo disponible'.
  const pt = classification.productType
  if (pt === 'debit_account' || pt === 'savings_account') {
    const debitKws = [
      'saldo disponible', 'disponible', 'disponible en cuenta',
      'saldo en cuenta', 'saldo al día', 'saldo actual',
    ]
    const debitBal = findAmountNearKeyword(lines, debitKws)
    if (debitBal != null) detected.balance = debitBal
  }
  if (pt === 'investment_account') {
    // Ensure NLV is populated even if institution field missed it
    if (detected.nlv == null) {
      detected.nlv = findAmountNearKeyword(lines,
        ['net liquidation value', 'net liq', 'nlv', 'valor neto', 'portfolio value'])
    }
    if (detected.cash == null) {
      detected.cash = findAmountNearKeyword(lines,
        ['total cash', 'cash balance', 'cash disponible', 'available cash'])
    }
  }

  // productType → modal accountType mapping
  const typeMap = {
    investment_account: 'broker',
    credit_card:        'card',
    debit_account:      'account',
    savings_account:    'account',
    loan:               'account',
    unknown:            institution?.defaultType ?? 'account',
  }

  return {
    institution:     institution?.name        ?? null,
    institutionMeta: institution              ?? null,
    defaultType:     typeMap[classification.productType] ?? (institution?.defaultType ?? 'account'),
    detected,
    topAmounts:      extractTopAmounts(rawText),
    rawText,
    lines,
    // ── New classification fields ──────────────────────────────────────
    classification,
    movements,
  }
}

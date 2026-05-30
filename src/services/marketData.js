// ── Market Data Service ───────────────────────────────────────────────────────
// Fetches real-time prices for portfolio positions.
//
// Providers:
//   • Stocks / ETFs  → Finnhub (requires VITE_MARKET_API_KEY in .env)
//   • Crypto         → CoinGecko (free, no key required)
//   • Options        → underlying ticker price via Finnhub (ITM/OTM auto-badge)
//   • CETES / cash   → manual only (not traded on real-time feeds)
//
// Fallback: if a fetch fails or the API key is missing, the app silently
// keeps the existing manual price — nothing breaks.

// Prefer the dedicated Finnhub key; fall back to the generic key for compat
const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY
             || import.meta.env.VITE_MARKET_API_KEY
             || ''

// ── CoinGecko ID map ──────────────────────────────────────────────────────────
// Add more entries as needed: https://api.coingecko.com/api/v3/coins/list
const GECKO_IDS = {
  BTC:   'bitcoin',
  ETH:   'ethereum',
  SOL:   'solana',
  BNB:   'binancecoin',
  ADA:   'cardano',
  XRP:   'ripple',
  DOGE:  'dogecoin',
  DOT:   'polkadot',
  MATIC: 'matic-network',
  POL:   'matic-network',
  AVAX:  'avalanche-2',
  LINK:  'chainlink',
  UNI:   'uniswap',
  LTC:   'litecoin',
  ATOM:  'cosmos',
  NEAR:  'near',
  FIL:   'filecoin',
  SHIB:  'shiba-inu',
  ARB:   'arbitrum',
  OP:    'optimism',
}

// ── Finnhub — stocks & ETFs ───────────────────────────────────────────────────
async function finnhubBatch(tickers) {
  if (!API_KEY || !tickers.length) return {}
  const out = {}
  await Promise.allSettled(
    tickers.map(sym =>
      fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${API_KEY}`,
        { signal: AbortSignal.timeout(6000) }
      )
        .then(r => r.json())
        .then(d => {
          // d.c = current price, d.d = change, d.dp = change %
          // d.c = current  d.d = change$  d.dp = change%  d.h = high  d.l = low
          if (d?.c > 0) {
            out[sym] = {
              price:     d.c,
              change:    d.d  ?? 0,
              changePct: d.dp ?? 0,
              high:      d.h  ?? 0,
              low:       d.l  ?? 0,
              source:    'finnhub',
            }
          }
        })
        .catch(() => {}) // per-ticker silent fail
    )
  )
  return out
}

// ── CoinGecko — crypto (free, no key) ────────────────────────────────────────
async function coingeckoBatch(tickers) {
  const unique = [...new Set(tickers.map(t => t.toUpperCase()))]
  const ids    = unique.map(t => GECKO_IDS[t]).filter(Boolean)
  if (!ids.length) return {}
  try {
    const url  = `https://api.coingecko.com/api/v3/simple/price`
      + `?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`
    const data = await fetch(url, { signal: AbortSignal.timeout(8000) }).then(r => r.json())
    const out  = {}
    unique.forEach(t => {
      const id = GECKO_IDS[t]
      if (id && data?.[id]?.usd > 0) {
        out[t] = {
          price:     data[id].usd,
          changePct: data[id].usd_24h_change ?? 0,
          change:    0,
          source:    'coingecko',
        }
      }
    })
    return out
  } catch {
    return {}
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
/**
 * Fetch current market prices for a portfolio of investments.
 *
 * @param   {object[]} investments  Array of investment objects from Zustand store
 * @returns {Promise<{
 *   prices:     { [ticker]: { price, change, changePct, source } },
 *   underlying: { [ticker]: { price, change, changePct, source } },
 *   errors:     string[]   — 'stock_no_key' | 'fetch_error'
 * }>}
 */
export async function fetchMarketPrices(investments) {
  const errors     = []
  const stockSet   = new Set()
  const cryptoSet  = new Set()
  const optionSet  = new Set()

  investments.forEach(inv => {
    const sym = inv.ticker?.toUpperCase()
    if (!sym) return
    switch (inv.type) {
      case 'accion':
      case 'etf':    stockSet.add(sym);  break
      case 'cripto': cryptoSet.add(sym); break
      case 'call':
      case 'put':    optionSet.add(sym); break
      // cetes / efectivo → skip (manual)
    }
  })

  // Options underlying tickers that aren't already in the stock set
  const stockTickers  = [...stockSet]
  const optionTickers = [...optionSet].filter(t => !stockSet.has(t))
  const allFinnhub    = [...stockTickers, ...optionTickers]

  if (allFinnhub.length && !API_KEY) {
    errors.push('stock_no_key')
  }

  // Both fetches in parallel
  const [finnhubPrices, cryptoPrices] = await Promise.all([
    finnhubBatch(allFinnhub),
    coingeckoBatch([...cryptoSet]),
  ])

  // Stock/ETF prices
  const prices = { ...cryptoPrices }
  stockTickers.forEach(t => {
    if (finnhubPrices[t]) prices[t] = finnhubPrices[t]
  })

  // Underlying prices for options
  const underlying = {}
  optionTickers.forEach(t => {
    if (finnhubPrices[t]) underlying[t] = finnhubPrices[t]
  })
  // If the underlying is also a stock in the portfolio (already fetched), reuse
  optionSet.forEach(t => {
    if (stockSet.has(t) && finnhubPrices[t]) underlying[t] = finnhubPrices[t]
  })

  return { prices, underlying, errors }
}

/** True if VITE_MARKET_API_KEY is configured. */
export const hasApiKey = () => Boolean(API_KEY)

// ── Historical portfolio value ─────────────────────────────────────────────────
// Returns [{time: unixSeconds, value: USD}] sorted ascending, or null.
//
// Data sources:
//   Stocks / ETFs  → Yahoo Finance via corsproxy.io (free, no key required)
//   Crypto         → CoinGecko /market_chart         (free, no key required)
//   Options / CETES / cash → constant current/buy price

const _isOpt = (t) => t === 'call' || t === 'put'

// Yahoo Finance period → range + interval
const YF_CFG = {
  '1D':  { range: '1d',   interval: '5m'  },
  '1W':  { range: '5d',   interval: '60m' },
  '1M':  { range: '1mo',  interval: '1d'  },
  '3M':  { range: '3mo',  interval: '1d'  },
  '6M':  { range: '6mo',  interval: '1d'  },
  'YTD': { range: 'ytd',  interval: '1d'  },
  '1Y':  { range: '1y',   interval: '1d'  },
  'ALL': { range: '5y',   interval: '1wk' },
}

// CoinGecko days param per period
function _geckoDays(period) {
  if (period === 'ALL') return 'max'
  const now = Math.floor(Date.now() / 1000)
  const MAP = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }
  if (period === 'YTD') {
    const ytd = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000)
    return Math.max(1, Math.ceil((now - ytd) / 86_400))
  }
  return MAP[period] ?? 30
}

// Binary-search: last price at or before timestamp t
function _priceAt(candles, t) {
  let lo = 0, hi = candles.length - 1, best = null
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (candles[mid].t <= t) { best = candles[mid].p; lo = mid + 1 }
    else hi = mid - 1
  }
  return best
}

// Approximate "from" timestamp for the static-only flat-line fallback
function _fromTs(period) {
  const now = Math.floor(Date.now() / 1000)
  const MAP = { '1D': 86_400, '1W': 604_800, '1M': 2_678_400, '3M': 7_862_400,
                '6M': 15_724_800, 'YTD': now - Math.floor(new Date(new Date().getFullYear(),0,1).getTime()/1000),
                '1Y': 31_536_000, 'ALL': 157_680_000 }
  return now - (MAP[period] ?? 2_678_400)
}

/**
 * Fetch historical portfolio value timeseries.
 * @param   {object[]} investments
 * @param   {string}   period  '1D'|'1W'|'1M'|'3M'|'6M'|'YTD'|'1Y'|'ALL'
 * @returns {Promise<{time:number,value:number}[]|null>}
 */
export async function fetchHistoricalPortfolio(investments, period) {
  if (!investments?.length) return null

  const now = Math.floor(Date.now() / 1000)
  const yfCfg = YF_CFG[period] ?? YF_CFG['1M']

  // ── Bucket investments by data source ──────────────────────────────────────
  const stockInvs  = new Map() // sym → [{qty,mult}]
  const cryptoInvs = new Map()
  let   staticVal  = 0

  for (const inv of investments) {
    const sym  = (inv.ticker || inv.asset || '').toUpperCase()
    if (!sym) continue
    const qty  = Number(inv.quantity)  || 1
    const mult = _isOpt(inv.type)      ? 100 : 1
    const curr = Number(inv.currentPrice || inv.buyPrice) || 0

    if (inv.type === 'accion' || inv.type === 'etf') {
      const a = stockInvs.get(sym) || []; a.push({ qty, mult }); stockInvs.set(sym, a)
    } else if (inv.type === 'cripto') {
      const a = cryptoInvs.get(sym) || []; a.push({ qty, mult }); cryptoInvs.set(sym, a)
    } else {
      staticVal += curr * qty * mult  // CETES, options, cash → constant
    }
  }

  // ── Yahoo Finance candle fetcher (via corsproxy.io — free, CORS-enabled) ───
  async function yahooCandles(sym) {
    try {
      const yfUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`
        + `?range=${yfCfg.range}&interval=${yfCfg.interval}&includePrePost=false`
      const url = `https://corsproxy.io/?${encodeURIComponent(yfUrl)}`
      const d   = await fetch(url, { signal: AbortSignal.timeout(14000) }).then(r => r.json())
      const res = d?.chart?.result?.[0]
      if (!res) return null
      const ts = res.timestamp
      const cl = res.indicators?.quote?.[0]?.close
      if (!ts?.length || !cl?.length) return null
      const candles = ts.map((t, i) => ({ t, p: cl[i] })).filter(c => c.p != null)
      return candles.length >= 2 ? candles : null
    } catch { return null }
  }

  // ── CoinGecko candle fetcher ────────────────────────────────────────────────
  async function geckoCandles(sym) {
    const id = GECKO_IDS[sym]
    if (!id) return null
    try {
      const days = String(_geckoDays(period))
      const url  = `https://api.coingecko.com/api/v3/coins/${id}/market_chart`
        + `?vs_currency=usd&days=${days}`
      const d = await fetch(url, { signal: AbortSignal.timeout(10000) }).then(r => r.json())
      if (!Array.isArray(d?.prices) || !d.prices.length) return null
      return d.prices.map(([tsMs, p]) => ({ t: Math.floor(tsMs / 1000), p }))
    } catch { return null }
  }

  // ── Fetch all in parallel ──────────────────────────────────────────────────
  const stockSyms  = [...stockInvs.keys()]
  const cryptoSyms = [...cryptoInvs.keys()]

  const [stockRes, cryptoRes] = await Promise.all([
    Promise.allSettled(stockSyms.map(sym => yahooCandles(sym).then(d => ({ sym, d })))),
    Promise.allSettled(cryptoSyms.map(sym => geckoCandles(sym).then(d => ({ sym, d })))),
  ])

  // ── Map results; fall back failed symbols to their current/buy price ────────
  const candlesBySym = {}

  const _fallback = (sym, invMap) => {
    const invMatches = investments.filter(i => (i.ticker || i.asset || '').toUpperCase() === sym)
    for (const inv of invMatches) {
      for (const { qty, mult } of (invMap.get(sym) || [])) {
        staticVal += Number(inv.currentPrice || inv.buyPrice || 0) * qty * mult
      }
    }
    invMap.delete(sym)
  }

  for (const r of stockRes) {
    if (r.status !== 'fulfilled') continue
    const { sym, d } = r.value
    if (d?.length) candlesBySym[sym] = d; else _fallback(sym, stockInvs)
  }
  for (const r of cryptoRes) {
    if (r.status !== 'fulfilled') continue
    const { sym, d } = r.value
    if (d?.length) candlesBySym[sym] = d; else _fallback(sym, cryptoInvs)
  }

  // ── Build reference timeline from dataset with most points ─────────────────
  let refTimeline = []
  let maxLen = 0
  for (const candles of Object.values(candlesBySym)) {
    if (candles.length > maxLen) { maxLen = candles.length; refTimeline = candles.map(c => c.t) }
  }

  if (!refTimeline.length) {
    // Only static positions → flat line
    if (!staticVal) return null
    const from = _fromTs(period)
    return [
      { time: from + 60, value: Math.round(staticVal * 100) / 100 },
      { time: now,       value: Math.round(staticVal * 100) / 100 },
    ]
  }

  // ── Compute portfolio value at each reference timestamp ────────────────────
  const activeStocks  = [...stockInvs.entries()].filter(([sym]) => candlesBySym[sym])
  const activeCryptos = [...cryptoInvs.entries()].filter(([sym]) => candlesBySym[sym])

  const raw = []
  for (const t of refTimeline) {
    let value = staticVal

    for (const [sym, invsList] of activeStocks) {
      const p = _priceAt(candlesBySym[sym], t)
      if (p == null) continue
      for (const { qty, mult } of invsList) value += p * qty * mult
    }
    for (const [sym, invsList] of activeCryptos) {
      const p = _priceAt(candlesBySym[sym], t)
      if (p == null) continue
      for (const { qty, mult } of invsList) value += p * qty * mult
    }

    if (value > 0) raw.push({ time: t, value: Math.round(value * 100) / 100 })
  }

  // Deduplicate timestamps and sort ascending
  const seen = new Set()
  const out  = raw
    .filter(p => { if (seen.has(p.time)) return false; seen.add(p.time); return true })
    .sort((a, b) => a.time - b.time)

  return out.length >= 2 ? out : null
}

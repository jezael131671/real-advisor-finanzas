// ── Market status (US equities — NYSE / NASDAQ) ───────────────────────────────
// Computes market state from current US Eastern Time.
// Note: does NOT account for market holidays (requires a full holiday calendar).
// When ready to connect a live data feed, implement fetchPrices() below.

/**
 * Returns 'open' | 'premarket' | 'afterhours' | 'closed'
 * based on current US Eastern Time (ET).
 */
export function getMarketStatus() {
  const now = new Date()
  const et  = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(now)

  const p    = Object.fromEntries(et.map(({ type, value }) => [type, value]))
  const day  = p.weekday
  const mins = parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10)

  if (day === 'Sat' || day === 'Sun') return 'closed'

  if (mins >= 570 && mins < 960)  return 'open'        // 09:30 – 16:00 ET
  if (mins >= 240 && mins < 570)  return 'premarket'   // 04:00 – 09:30 ET
  if (mins >= 960 && mins < 1200) return 'afterhours'  // 16:00 – 20:00 ET
  return 'closed'
}

/**
 * Stub for future real-time price API.
 * Returns { [ticker]: { price, change, changePct } } when wired up.
 *
 * To connect a real feed:
 *   1. Add VITE_PRICE_API_KEY to your .env file
 *   2. Replace the body below with a real fetch() call
 *   Suggested free-tier providers: Finnhub, Polygon.io, Alpha Vantage
 *
 * @param   {string[]} tickers  e.g. ['AAPL', 'TSLA']
 * @returns {Promise<null>}     null until the API is connected
 */
/**
 * Returns a short human-readable label for the next market event.
 * e.g. "Cierra en 2h 15m" | "Abre en 45m" | "Abre mañana 9:30 ET"
 */
export function getMarketNextEvent() {
  const now = new Date()
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(now)
  const p   = Object.fromEntries(etParts.map(({ type, value }) => [type, value]))
  const day = p.weekday
  const tot = parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10)

  const OPEN  = 570   // 09:30
  const CLOSE = 960   // 16:00

  const fmtM = (m) => {
    const h = Math.floor(m / 60), mm = m % 60
    if (h > 0 && mm > 0) return `${h}h ${mm}m`
    if (h > 0)            return `${h}h`
    return `${mm}m`
  }

  if (day === 'Sun') return `Abre mañana en ${fmtM((24 * 60 - tot) + OPEN)}`
  if (day === 'Sat') return `Abre el lunes en ${fmtM((24 * 60 - tot) + 24 * 60 + OPEN)}`

  if (tot >= OPEN && tot < CLOSE)  return `Cierra en ${fmtM(CLOSE - tot)}`
  if (tot < OPEN)                  return `Abre en ${fmtM(OPEN - tot)}`

  // After hours on a weekday
  const isFriday = day === 'Fri'
  if (isFriday) return `Abre el lunes en ${fmtM((24 * 60 - tot) + 2 * 24 * 60 + OPEN)}`
  return `Abre mañana en ${fmtM((24 * 60 - tot) + OPEN)}`
}

export async function fetchPrices(tickers) { // eslint-disable-line no-unused-vars
  // Example Finnhub integration (uncomment + set VITE_PRICE_API_KEY):
  //
  // const key = import.meta.env.VITE_PRICE_API_KEY
  // if (!key || !tickers.length) return null
  // const results = await Promise.all(
  //   tickers.map(sym =>
  //     fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${key}`)
  //       .then(r => r.json())
  //       .then(d => [sym, { price: d.c, change: d.d, changePct: d.dp }])
  //   )
  // )
  // return Object.fromEntries(results)
  return null
}

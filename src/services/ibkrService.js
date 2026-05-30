// ── IBKR Client Portal Web API — Service Layer ────────────────────────────────
//
// Docs: https://www.interactivebrokers.com/api/doc.html
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  MODES                                                                   │
// │                                                                          │
// │  MOCK  (default — zero network)                                          │
// │    Synthetic data mirroring the dev portfolio. Safe for offline/dev.     │
// │    Auto-active when VITE_IBKR_GATEWAY_URL is not set.                   │
// │    Force:  VITE_IBKR_MODE=mock                                           │
// │                                                                          │
// │  REAL                                                                    │
// │    Connects to the Client Portal Gateway running locally.                │
// │    Force:  VITE_IBKR_MODE=real                                           │
// │            VITE_IBKR_GATEWAY_URL=https://localhost:5000                 │
// └──────────────────────────────────────────────────────────────────────────┘
//
// ── SETUP (real mode) ─────────────────────────────────────────────────────────
//   1. Download Client Portal Gateway:
//      https://www.interactivebrokers.com/en/trading/ib-api.php
//   2. Launch: ./bin/run.sh root/conf.yaml  (macOS/Linux)
//              bin\run.bat root\conf.yaml   (Windows)
//   3. Open https://localhost:5000 in browser → complete IB login (once per day)
//   4. In .env.local add:
//        VITE_IBKR_MODE=real
//        VITE_IBKR_GATEWAY_URL=https://localhost:5000
//        VITE_IBKR_ACCOUNT_ID=U1234567   # optional — auto-detected otherwise
//
// ── FUTURE ROADMAP ────────────────────────────────────────────────────────────
//   • Backend proxy (e.g. Node/Hono) to avoid browser CORS + self-signed cert
//   • iBeam (Docker) for headless auth without manual browser login
//   • TWS WebSocket (port 7496/7497) for streaming live P&L
//   • IBKR Flex Reports for historical trades / P&L reconciliation
//   • OAuth 2.0 (IBKR OAuth) for production web deployments
//   • Automatic token keep-alive (tickle endpoint every ~55 s)

// ── Env config ────────────────────────────────────────────────────────────────
const ENV_MODE        = import.meta.env.VITE_IBKR_MODE        || 'mock'
const ENV_GATEWAY_URL = import.meta.env.VITE_IBKR_GATEWAY_URL || 'https://localhost:5000'
const ENV_ACCOUNT_ID  = import.meta.env.VITE_IBKR_ACCOUNT_ID  || ''

// ── IBKR assetCategory → our investment type ──────────────────────────────────
// IBKR asset categories: STK, OPT, FUT, CASH, FND, BOND, WAR, BAG, CRYPTO
// Our types: accion, etf, cripto, cetes, call, put, efectivo
const CATEGORY_MAP = {
  STK:    'accion',   // resolved to 'etf' if ticker is in TICKER_DB with type=etf
  FND:    'etf',
  OPT:    'call',     // refined to 'put' when putOrCall === 'P'
  CRYPTO: 'cripto',
  BOND:   'cetes',    // treat bonds/notes as CETES-equivalent
  CASH:   'efectivo',
  FUT:    'accion',   // futures — approximate as stock-like
  WAR:    'call',     // warrants — approximate as call-like
}

// Known ETF tickers (mirrors TICKER_DB etf entries for quick lookup without import)
const KNOWN_ETFS = new Set([
  'QQQ','SPY','VOO','VTI','ARKK','XLK','VGT','SOXX','GLD','IWM',
  'TQQQ','SQQQ','SCHD','JEPI','QQQM','VEA','EEM',
])

// ── Helpers ───────────────────────────────────────────────────────────────────
const num   = (v) => Number(v) || 0
const today = () => new Date().toISOString().slice(0, 10)

/** Convert IBKR expiry string "YYYYMMDD" → "YYYY-MM-DD" */
function parseExpiry(s) {
  if (!s || s.length !== 8) return null
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

/** Derive our investment type from an IBKR raw position */
function resolveType(raw) {
  const cat = (raw.assetCategory || raw.assetClass || '').toUpperCase()
  const poc  = (raw.putOrCall || '').toUpperCase()

  if (cat === 'OPT' || cat === 'WAR') {
    return poc === 'P' ? 'put' : 'call'
  }
  if (cat === 'STK') {
    return KNOWN_ETFS.has((raw.ticker || '').toUpperCase()) ? 'etf' : 'accion'
  }
  return CATEGORY_MAP[cat] || 'accion'
}

// ─────────────────────────────────────────────────────────────────────────────
//  IBKRMapper — raw API response → our store investment format
// ─────────────────────────────────────────────────────────────────────────────
export class IBKRMapper {
  /**
   * Convert a raw IBKR position object to our Zustand investment format.
   *
   * @param {object} raw    - IBKR position from /portfolio/{id}/positions/0
   * @param {string} [existingId] - Preserve existing store ID for update vs insert
   * @returns {object}  investment record ready for useFinanceStore
   */
  static positionToStore(raw, existingId = null) {
    const ticker   = (raw.ticker || raw.contractDesc || '').toUpperCase().split(/\s/)[0]
    const type     = resolveType(raw)
    const qty      = Math.abs(num(raw.position))
    const avgCost  = num(raw.avgCost)
    const avgPrice = num(raw.avgPrice)
    const buyPrice = avgCost > 0 ? avgCost : avgPrice   // avgCost includes commission
    const mktPrice = num(raw.mktPrice)
    const mktValue = num(raw.mktValue)

    // Derive currentPrice: prefer mktPrice, fall back to mktValue / qty
    const currentPrice = mktPrice > 0
      ? mktPrice
      : (qty > 0 ? mktValue / qty : buyPrice)

    const unrealizedPnl = num(raw.unrealizedPnl)
    const realizedPnl   = num(raw.realizedPnl)

    const base = {
      // Identity
      id:           existingId || `ibkr_${raw.conid || ticker}_${Date.now()}`,
      ticker,
      broker:       'ibkr',
      ibkrSynced:   true,
      ibkrConId:    raw.conid ?? null,

      // Core fields
      type,
      quantity:     qty,
      buyPrice:     parseFloat(buyPrice.toFixed(6)),
      currentPrice: parseFloat(currentPrice.toFixed(6)),
      currency:     raw.currency || 'USD',

      // P&L (from broker — authoritative)
      unrealizedPnl: parseFloat(unrealizedPnl.toFixed(2)),
      realizedPnl:   parseFloat(realizedPnl.toFixed(2)),

      // buyDate intentionally omitted — IBKR /positions does not return the
      // original open date. Fetch /pa/performance or Flex Reports for history.
      // The store merge will preserve any buyDate the user already set manually.
      syncedAt:  new Date().toISOString(),
    }

    // ── Option-specific fields ────────────────────────────────────────────────
    if (type === 'call' || type === 'put') {
      base.strikePrice    = num(raw.strike)
      base.expiryDate     = parseExpiry(raw.expiry || raw.lastTradingDayOrContractMonth)
      base.underlyingSymbol = ticker
      base.multiplier     = num(raw.multiplier) || 100
    }

    // ── Futures-specific ──────────────────────────────────────────────────────
    if ((raw.assetCategory || '').toUpperCase() === 'FUT') {
      base.expiryDate = parseExpiry(raw.expiry || raw.lastTradingDayOrContractMonth)
      base.multiplier = num(raw.multiplier) || 1
    }

    return base
  }

  /**
   * Convert a raw IBKR account summary to our summary format.
   *
   * @param {object} raw  - IBKR summary from /portfolio/{id}/summary
   * @returns {IBKRSummary}
   */
  static summaryToStore(raw) {
    // The IBKR summary API returns fields as { amount, currency } objects
    const field = (key) => num(raw?.[key]?.amount ?? raw?.[key])

    return {
      netLiquidation:     field('netliquidation'),
      totalCash:          field('totalcashvalue'),
      unrealizedPnl:      field('unrealizedpnl'),
      realizedPnl:        field('realizedpnl'),
      grossPositionValue: field('grosspositionvalue'),
      equityWithLoanValue: field('equitywithloanvalue'),
      availableFunds:     field('availablefunds'),
      excessLiquidity:    field('excessliquidity'),
      buyingPower:        field('buyingpower'),
      leverage:           field('grossleverage'),
      currency:           raw?.netliquidation?.currency || 'USD',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  IBKRMock — synthetic data for development / offline use
// ─────────────────────────────────────────────────────────────────────────────
class IBKRMock {
  /** Positions mirroring the current dev portfolio (IBKR-only positions) */
  static positions() {
    return [
      // ── Equities ─────────────────────────────────────────────────────────
      {
        conid:          4815747,
        ticker:        'NVDA',
        assetCategory: 'STK',
        position:       2.5,
        avgCost:        875.50,
        avgPrice:       875.50,
        mktPrice:       215.33,
        mktValue:       538.33,
        unrealizedPnl: -1650.42,
        realizedPnl:    0,
        currency:      'USD',
        fullName:      'NVIDIA CORP',
      },
      {
        conid:          320227571,
        ticker:        'QQQ',
        assetCategory: 'FND',       // IBKR classifies ETFs as FND
        position:       3.75,
        avgCost:        440.00,
        avgPrice:       440.00,
        mktPrice:       717.54,
        mktValue:       2690.78,
        unrealizedPnl:  1040.78,
        realizedPnl:    0,
        currency:      'USD',
        fullName:      'INVESCO QQQ TRUST SERIES 1',
      },
      // ── Options ───────────────────────────────────────────────────────────
      {
        conid:          625143891,
        ticker:        'SOFI',
        assetCategory: 'OPT',
        putOrCall:     'C',
        strike:         15.00,
        expiry:        '20260117',
        multiplier:     100,
        position:       3,            // 3 contracts
        avgCost:        0.85,
        avgPrice:       0.85,
        mktPrice:       1.25,
        mktValue:       375.00,       // 3 × 1.25 × 100
        unrealizedPnl:  120.00,       // 3 × (1.25−0.85) × 100
        realizedPnl:    0,
        currency:      'USD',
        contractDesc:  'SOFI  260117C00015000',
      },
      {
        conid:          687241023,
        ticker:        'TSLA',
        assetCategory: 'OPT',
        putOrCall:     'P',
        strike:         250.00,
        expiry:        '20260620',
        multiplier:     100,
        position:       2,            // 2 contracts
        avgCost:        5.50,
        avgPrice:       5.50,
        mktPrice:       8.00,
        mktValue:       1600.00,      // 2 × 8 × 100
        unrealizedPnl:  500.00,       // 2 × (8−5.5) × 100
        realizedPnl:    0,
        currency:      'USD',
        contractDesc:  'TSLA  260620P00250000',
      },
    ]
  }

  /** Account summary matching the dev store */
  static summary(accountId = 'U_MOCK_001') {
    // Portfolio value breakdown:
    //   NVDA:       $538.33
    //   QQQ:       $2,690.78
    //   SOFI CALL:   $375.00
    //   TSLA PUT:  $1,600.00
    //   Cash:      $5,000.00  (mock)
    //   Total NLV: $10,204.11
    return {
      netliquidation:      { amount: 10204.11, currency: 'USD' },
      totalcashvalue:      { amount: 5000.00,  currency: 'USD' },
      unrealizedpnl:       { amount:  210.36,  currency: 'USD' },
      realizedpnl:         { amount:    0.00,  currency: 'USD' },
      grosspositionvalue:  { amount: 5204.11,  currency: 'USD' },
      equitywithloanvalue: { amount: 10204.11, currency: 'USD' },
      availablefunds:      { amount: 4800.00,  currency: 'USD' },
      excessliquidity:     { amount: 4500.00,  currency: 'USD' },
      buyingpower:         { amount: 9600.00,  currency: 'USD' },
      grossleverage:       { amount: 0.51,     currency: 'USD' },
      accountId,
    }
  }

  /** Auth status (always authenticated in mock) */
  static authStatus() {
    return {
      authenticated: true,
      competing:     false,
      connected:     true,
      message:       'mock — no gateway needed',
    }
  }

  /** Account list */
  static accounts() {
    return ['U_MOCK_001']
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  IBKRClient — low-level HTTP client for the Client Portal Gateway
// ─────────────────────────────────────────────────────────────────────────────
class IBKRClient {
  /**
   * @param {string} gatewayUrl  e.g. 'https://localhost:5000'
   * @param {number} [timeout]   ms, default 10 000
   */
  constructor(gatewayUrl = ENV_GATEWAY_URL, timeout = 10_000) {
    // Normalize: strip trailing slash
    this.base    = gatewayUrl.replace(/\/$/, '')
    this.timeout = timeout
    // Direct requests to the Gateway URL.
    // The browser handles CORS + TLS — the user must accept the self-signed cert
    // at https://localhost:5000 ONCE and then session cookies are shared across
    // all localhost origins (same-site). The Gateway conf.yaml is configured
    // with allowCredentials:true and origin.allowed pointing to this app's origin.
  }

  /**
   * Low-level GET — direct request to the Gateway.
   *
   * Flow:
   *   1. User accepts Gateway TLS cert at https://localhost:5000 (once per session)
   *   2. User logs in → Gateway sets session cookie for localhost
   *   3. This app (any localhost port) calls fetch with credentials:'include'
   *   4. Browser sends the session cookie (same-site: localhost shares across ports)
   *   5. Gateway checks CORS origin → matches conf.yaml → responds with data
   *
   * @param {string}  path       e.g. '/v1/api/iserver/auth/status'
   * @param {object}  [params]   query-string params
   * @returns {Promise<any>}
   */
  async get(path, params = {}) {
    const qs  = new URLSearchParams(params).toString()
    const url = `${this.base}${path}${qs ? '?' + qs : ''}`
    const res = await fetch(url, {
      method:      'GET',
      credentials: 'include',             // session cookie (same-site: localhost)
      headers:     { 'Content-Type': 'application/json' },
      signal:      AbortSignal.timeout(this.timeout),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new IBKRError(`HTTP ${res.status} — ${path}`, res.status, body)
    }
    return res.json()
  }

  /**
   * POST (used for reauthenticate / tickle).
   */
  async post(path, body = {}) {
    const url = `${this.base}${path}`
    const res = await fetch(url, {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(body),
      signal:      AbortSignal.timeout(this.timeout),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new IBKRError(`HTTP ${res.status} — ${path}`, res.status, text)
    }
    return res.json().catch(() => ({}))
  }

  // ── Gateway endpoints ──────────────────────────────────────────────────────

  /** Check authentication status */
  async authStatus() {
    return this.get('/v1/api/iserver/auth/status')
  }

  /** Keep session alive (call every ~55 s when app is active) */
  async tickle() {
    return this.post('/v1/api/tickle')
  }

  /** Reauthenticate an existing session */
  async reauthenticate() {
    return this.post('/v1/api/iserver/reauthenticate')
  }

  /**
   * List all account IDs on this gateway session.
   *
   * Two-step per IBKR Client Portal recommendations:
   *   1. GET /v1/api/iserver/accounts — initializes the trading session.
   *      Must be called before any /portfolio/* endpoint.
   *   2. GET /v1/api/portfolio/accounts — returns full account metadata.
   *      Preferred source when available; falls back to iserver list.
   */
  async accounts() {
    // Step 1 — session init (required before portfolio API calls)
    const isData     = await this.get('/v1/api/iserver/accounts')
    const iserverIds = Array.isArray(isData)
      ? isData.map(a => a.accountId || a.id || a).filter(Boolean)
      : (isData?.accounts || [])

    // Step 2 — portfolio accounts (richer metadata, definitive for portfolio API)
    try {
      const portData = await this.get('/v1/api/portfolio/accounts')
      if (Array.isArray(portData) && portData.length > 0) {
        return portData.map(a => a.accountId || a.id || String(a)).filter(Boolean)
      }
    } catch { /* portfolio/accounts not always available — fall back */ }

    return iserverIds
  }

  /**
   * Fetch all positions for an account (paginated; page 0 first).
   * IBKR returns up to 30 positions per page.
   *
   * @param {string}  accountId
   * @param {boolean} [allPages=true]  automatically fetch page 1, 2, … until empty
   */
  async positions(accountId, allPages = true) {
    const fetchPage = (page) =>
      this.get(`/v1/api/portfolio/${accountId}/positions/${page}`)

    const page0 = await fetchPage(0)
    if (!allPages || !Array.isArray(page0) || page0.length < 30) {
      return Array.isArray(page0) ? page0 : []
    }

    // More pages may exist
    const all = [...page0]
    let page  = 1
    while (true) {
      const more = await fetchPage(page).catch(() => [])
      if (!Array.isArray(more) || more.length === 0) break
      all.push(...more)
      if (more.length < 30) break
      page++
    }
    return all
  }

  /**
   * Account summary — NLV, cash, P&L, margin.
   * @param {string} accountId
   */
  async summary(accountId) {
    return this.get(`/v1/api/portfolio/${accountId}/summary`)
  }

  /**
   * Ledger — per-currency cash breakdown.
   * @param {string} accountId
   */
  async ledger(accountId) {
    return this.get(`/v1/api/portfolio/${accountId}/ledger`)
  }

  /**
   * Performance — account P&L over time.
   * @param {string[]} accountIds
   */
  async performance(accountIds) {
    return this.get('/v1/api/pa/performance', {
      acctIds: accountIds.join(','),
      freq:    'D',   // daily
    })
  }

  /**
   * Market data snapshot (delayed/live depending on subscription).
   * @param {number[]} conids
   * @param {string[]} fields  e.g. ['31','84','86','88'] = last, bid, ask, volume
   */
  async marketData(conids, fields = ['31', '84', '86', '88', '87', '85']) {
    return this.get('/v1/api/md/snapshot', {
      conids:  conids.join(','),
      fields:  fields.join(','),
    })
  }

  /** Test gateway reachability (non-throwing) */
  async isReachable() {
    try {
      await this.get('/v1/api/iserver/auth/status')
      return true
    } catch {
      return false
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  IBKRError — typed error for gateway failures
// ─────────────────────────────────────────────────────────────────────────────
export class IBKRError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode]
   * @param {string} [body]
   */
  constructor(message, statusCode = 0, body = '') {
    super(message)
    this.name       = 'IBKRError'
    this.statusCode = statusCode
    this.body       = body
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  IBKRService — public API used by the UI layer
// ─────────────────────────────────────────────────────────────────────────────
class IBKRService {
  constructor() {
    this._mode       = ENV_MODE          // 'mock' | 'real'
    this._gatewayUrl = ENV_GATEWAY_URL
    this._accountId  = ENV_ACCOUNT_ID    // '' → auto-detect
    this._client     = new IBKRClient(this._gatewayUrl)
    this._tickleRef  = null
  }

  // ── Config ─────────────────────────────────────────────────────────────────

  get config() {
    return {
      mode:       this._mode,
      gatewayUrl: this._gatewayUrl,
      accountId:  this._accountId,
      isMock:     this._mode === 'mock',
      isReal:     this._mode === 'real',
    }
  }

  /** Switch mode at runtime (e.g. from settings UI) */
  setMode(mode) {
    if (mode !== 'mock' && mode !== 'real') throw new Error('mode must be "mock" or "real"')
    this._mode = mode
  }

  /** Update gateway URL at runtime */
  setGatewayUrl(url) {
    this._gatewayUrl = url
    this._client     = new IBKRClient(url)
  }

  /** Update account ID at runtime */
  setAccountId(id) {
    this._accountId = id
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  /**
   * Check gateway status.
   *
   * @returns {Promise<{
   *   ok:            boolean,
   *   mode:          'mock' | 'real',
   *   authenticated: boolean,
   *   connected:     boolean,
   *   competing:     boolean,
   *   message:       string,
   * }>}
   */
  async checkStatus() {
    if (this._mode === 'mock') {
      const s = IBKRMock.authStatus()
      return { ok: true, mode: 'mock', ...s }
    }
    try {
      const s = await this._client.authStatus()
      return {
        ok:            Boolean(s?.authenticated),
        mode:          'real',
        authenticated: Boolean(s?.authenticated),
        connected:     Boolean(s?.connected),
        competing:     Boolean(s?.competing),
        message:       s?.message || '',
      }
    } catch (err) {
      return {
        ok:            false,
        mode:          'real',
        authenticated: false,
        connected:     false,
        competing:     false,
        message:       err.message,
      }
    }
  }

  // ── Accounts ───────────────────────────────────────────────────────────────

  /**
   * List account IDs available on this gateway session.
   * @returns {Promise<string[]>}
   */
  async fetchAccounts() {
    if (this._mode === 'mock') return IBKRMock.accounts()
    return this._client.accounts()
  }

  /**
   * Resolve the account ID to use (configured or first from gateway).
   * @returns {Promise<string>}
   */
  async resolveAccountId() {
    if (this._accountId) return this._accountId
    const accounts = await this.fetchAccounts()
    if (!accounts.length) throw new IBKRError('No IBKR accounts found on this session')
    this._accountId = accounts[0]
    return this._accountId
  }

  // ── Data fetchers ──────────────────────────────────────────────────────────

  /**
   * Fetch raw positions (before mapping).
   * @param {string} [accountId]
   * @returns {Promise<object[]>}
   */
  async fetchRawPositions(accountId) {
    const acId = accountId || await this.resolveAccountId()
    if (this._mode === 'mock') return IBKRMock.positions()
    return this._client.positions(acId)
  }

  /**
   * Fetch raw account summary (before mapping).
   * @param {string} [accountId]
   * @returns {Promise<object>}
   */
  async fetchRawSummary(accountId) {
    const acId = accountId || await this.resolveAccountId()
    if (this._mode === 'mock') return IBKRMock.summary(acId)
    return this._client.summary(acId)
  }

  // ── Main sync ──────────────────────────────────────────────────────────────

  /**
   * Full account sync: health check → accounts → positions + summary.
   *
   * Steps (real mode):
   *   0. GET /v1/api/iserver/auth/status   — verify session is live
   *   1. GET /v1/api/iserver/accounts      — session init
   *      GET /v1/api/portfolio/accounts    — resolve accountId
   *   2. GET /v1/api/portfolio/{id}/positions/0  — all positions (paginated)
   *      GET /v1/api/portfolio/{id}/summary      — NLV, cash, P&L
   *   3. Map raw responses → Zustand investment format
   *   4. Return result (safe to pass directly to syncIBKRPositions)
   *
   * @param {string}   [accountId]          override — omit for auto-detect
   * @param {object[]} [existingInvestments] current store investments (ID preservation)
   * @returns {Promise<IBKRSyncResult>}
   */
  async sync(accountId, existingInvestments = []) {
    const t0  = Date.now()
    const now = new Date()

    /** Build a typed failure result */
    const fail = (error) => ({
      ok: false, positions: [], summary: null,
      accountId: accountId || this._accountId || '',
      syncedAt: now, latencyMs: Date.now() - t0, error,
    })

    try {
      // ── 0. Health check — real mode only ─────────────────────────────────────
      if (this._mode === 'real') {
        let authResult
        try {
          authResult = await this._client.authStatus()
        } catch {
          // Network error → gateway is off or unreachable
          return fail(
            'Gateway no disponible. Verifica que IBKR Client Portal Gateway esté corriendo en localhost:5000'
          )
        }

        if (!authResult?.authenticated) {
          return fail(authResult?.competing
            ? 'Sesión IBKR competida — otra instancia está activa. Ciérrala y re-autentícate.'
            : 'Sesión IBKR expirada. Re-autentícate en https://localhost:5000'
          )
        }
      }

      // ── 1. Resolve account ────────────────────────────────────────────────────
      const acId = accountId || await this.resolveAccountId()
      if (!acId) return fail('No se encontró cuenta IBKR. Verifica tu conexión al Gateway.')

      // ── 2. Fetch positions + summary in parallel ──────────────────────────────
      const [rawPositions, rawSummary] = await Promise.all([
        this.fetchRawPositions(acId),
        this.fetchRawSummary(acId),
      ])

      // ── 3. Map positions → store format ──────────────────────────────────────
      //   Preserve existing store IDs on ticker+type match (avoids orphaning entries
      //   the user already has when they first enable real sync).
      const existingMap = new Map(
        existingInvestments
          .filter(i => i.ibkrSynced || i.broker === 'ibkr')
          .map(i => [`${i.ticker}:${i.type}`, i.id])
      )
      const positions = (Array.isArray(rawPositions) ? rawPositions : []).map(raw => {
        const ticker = (raw.ticker || raw.contractDesc || '').toUpperCase().split(/\s/)[0]
        const type   = resolveType(raw)
        const key    = `${ticker}:${type}`
        return IBKRMapper.positionToStore(raw, existingMap.get(key) || null)
      })

      // ── 4. Map summary ────────────────────────────────────────────────────────
      const summary = IBKRMapper.summaryToStore(rawSummary)
      summary.accountId = acId

      return {
        ok: true, positions, summary, accountId: acId,
        syncedAt: now, latencyMs: Date.now() - t0, error: null,
      }

    } catch (err) {
      // Categorize remaining (unexpected) errors
      const isNetErr  = err.name === 'TypeError'
                     || err.message?.includes('Failed to fetch')
                     || err.message?.includes('NetworkError')
                     || err.message?.includes('network')
      const isAuth    = err instanceof IBKRError
                     && (err.statusCode === 401 || err.statusCode === 403)
      const isNotFound = err instanceof IBKRError && err.statusCode === 404

      if (isNetErr)   return fail('Gateway no disponible. Verifica que IBKR Client Portal Gateway esté corriendo en localhost:5000')
      if (isAuth)     return fail('Sesión IBKR expirada. Re-autentícate en https://localhost:5000')
      if (isNotFound) return fail('No se encontró la cuenta IBKR. Verifica tu Account ID en Configuración.')

      return fail(err instanceof IBKRError
        ? err.message
        : (err.message || 'Error desconocido al sincronizar IBKR'))
    }
  }

  // ── Keep-alive ─────────────────────────────────────────────────────────────

  /**
   * Start automatic session keep-alive (tickle every 55 s).
   * Only relevant in real mode — no-op in mock.
   */
  startKeepAlive() {
    if (this._mode !== 'real') return
    this.stopKeepAlive()
    this._tickleRef = setInterval(async () => {
      try { await this._client.tickle() } catch { /* silent */ }
    }, 55_000)
  }

  /** Stop the keep-alive interval */
  stopKeepAlive() {
    if (this._tickleRef) {
      clearInterval(this._tickleRef)
      this._tickleRef = null
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Singleton export
// ─────────────────────────────────────────────────────────────────────────────

/** Shared service instance — import and use directly in components/hooks */
export const ibkrService = new IBKRService()

export default ibkrService

// ── Named type exports for JSDoc consumers ────────────────────────────────────

/**
 * @typedef {Object} IBKRAuthStatus
 * @property {boolean} ok
 * @property {'mock'|'real'} mode
 * @property {boolean} authenticated
 * @property {boolean} connected
 * @property {boolean} competing
 * @property {string}  message
 */

/**
 * @typedef {Object} IBKRSummary
 * @property {number} netLiquidation    Net Liquidation Value (all assets − liabilities)
 * @property {number} totalCash         Available cash (USD)
 * @property {number} unrealizedPnl     Open position P&L
 * @property {number} realizedPnl       Closed position P&L (day)
 * @property {number} grossPositionValue Total market value of securities
 * @property {number} availableFunds    Cash available to trade
 * @property {number} buyingPower       Total buying power
 * @property {string} currency
 * @property {string} accountId
 */

/**
 * @typedef {Object} IBKRSyncResult
 * @property {boolean}     ok
 * @property {object[]}    positions   Mapped investment records (store-ready)
 * @property {IBKRSummary|null} summary
 * @property {string}      accountId
 * @property {Date}        syncedAt
 * @property {number}      latencyMs
 * @property {string|null} error
 */

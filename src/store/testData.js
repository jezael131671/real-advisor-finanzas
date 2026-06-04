// ── testData.js ──────────────────────────────────────────────────────────────
// Controlled test states for validating computeBreakdown and dashboard numbers.
// Load via: restoreState(TEST_CASES.caseA)  (available in Configuracion)
//
// Expected results are documented inline so any regression is immediately visible.
// ─────────────────────────────────────────────────────────────────────────────

import { DEFAULT_CATEGORIES, DEFAULT_METAS } from './defaultData.js'

const T0 = new Date(0).toISOString()
const NOW = new Date().toISOString()

// ── Case A ────────────────────────────────────────────────────────────────────
// BBVA efectivo $3,000 · Revolut $5,000 · IBKR NLV $2,000 · Tarjeta Nu −$1,000
//
// Expected:
//   totalCash        = $8,000  (3000 + 5000)
//   investmentValue  = $2,000  (IBKR NLV; no positions → NLV is source)
//   totalCardDebt    = $1,000
//   totalReceivable  = $0
//   totalAssets      = $10,000 (8000 + 2000)
//   totalLiabilities = $1,000
//   netWorth         = $9,000
//   monthIncome      = $5,000
//   monthExpenses    = $2,500  (gastos, NOT counting card payment)
//   monthFlow        = $2,500
// ─────────────────────────────────────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0]

export const CASE_A = {
  accounts: [
    { id: 'tA-bbva',    name: 'BBVA Efectivo',  institution: 'BBVA',    type: 'debito',   balance: 3000, colorIndex: 0, createdAt: T0 },
    { id: 'tA-revolut', name: 'Revolut',         institution: 'Revolut', type: 'ahorro',   balance: 5000, colorIndex: 1, createdAt: T0 },
  ],
  cards: [
    {
      id: 'tA-nu', bankName: 'Nu', cardName: 'Nu',
      balance: 1000, limit: 10000, cutDay: 10, dueDay: 20,
      minPayment: 200, noInterestPayment: 1000,
      colorIndex: 0, createdAt: T0,
    },
  ],
  transactions: [
    // Ingreso sueldo → BBVA (already reflected in balance above)
    { id: 'tA-tx1', type: 'ingreso',  amount: 5000, description: 'Sueldo', accountId: 'tA-bbva',    date: today, createdAt: NOW, labels: [] },
    // Gasto super → cuenta BBVA
    { id: 'tA-tx2', type: 'gasto',    amount: 1000, description: 'Super',  accountId: 'tA-bbva',    date: today, createdAt: NOW, labels: [] },
    // Gasto restaurante → tarjeta Nu
    { id: 'tA-tx3', type: 'gasto',    amount: 500,  description: 'Cena',   cardId:    'tA-nu',      date: today, createdAt: NOW, labels: [] },
    // Pago tarjeta desde BBVA (NO debe contar como gasto extra — R10)
    { id: 'tA-tx4', type: 'pago_tarjeta', amount: 500, description: 'Pago Nu parcial',
      accountId: 'tA-bbva', cardId: 'tA-nu', date: today, createdAt: NOW, labels: [] },
    // Transferencia BBVA → Revolut (no debe alterar patrimonio — R1)
    { id: 'tA-tx5', type: 'transferencia', amount: 1000, description: 'Traspaso ahorro',
      accountId: 'tA-bbva', targetAccountId: 'tA-revolut', date: today, createdAt: NOW, labels: [] },
  ],
  investments: [],
  assets: [],
  liabilities: [],
  bajoquintos: [],
  subscriptions: [],
  metas: DEFAULT_METAS,
  categories: DEFAULT_CATEGORIES,
  cashflowItems: [],
  networthHistory: [],
  settings: {
    currency: 'MXN',
    seeded: true,
    ibkr: {
      lastNLV:           2000,
      lastCash:          400,
      lastUnrealizedPnl: 150,
      lastDailyPnl:      -30,
      syncedAt:          NOW,
      source:            'test',
    },
  },
  // ── Expected results (verified against computeStats) ──────────────────────
  // NOTE: transactions above represent ACTIVITY, but balances on accounts/cards
  // are the CURRENT BALANCES after all activity. The transactions feed the
  // monthly flow stats; the balances feed cash/liability totals.
  _expected: {
    totalCash:        8000,  // 3000 + 5000
    investmentValue:  2000,  // IBKR NLV (no positions)
    totalCardDebt:    1000,
    totalReceivable:  0,
    totalAssets:      10000, // 8000 + 2000
    totalLiabilities: 1000,
    netWorth:         9000,
    // Monthly flow — pago_tarjeta excluded from expenses (R10)
    // Only tx1 income = 5000; tx2 gasto = 1000; tx3 gasto = 500; tx5 transferencia = neither
    monthIncome:      5000,
    monthExpenses:    1500,  // tx2 $1000 + tx3 $500
    monthFlow:        3500,
  },
}

// ── Case B ────────────────────────────────────────────────────────────────────
// Solo inversiones: IBKR NLV $10,000 · Sin cuentas · Sin pasivos
//
// Expected:
//   totalCash        = $0
//   investmentValue  = $10,000 (IBKR NLV)
//   totalCardDebt    = $0
//   totalReceivable  = $0
//   totalAssets      = $10,000
//   totalLiabilities = $0
//   netWorth         = $10,000
// ─────────────────────────────────────────────────────────────────────────────
export const CASE_B = {
  accounts: [],
  cards: [],
  transactions: [],
  investments: [],
  assets: [],
  liabilities: [],
  bajoquintos: [],
  subscriptions: [],
  metas: DEFAULT_METAS,
  categories: DEFAULT_CATEGORIES,
  cashflowItems: [],
  networthHistory: [],
  settings: {
    currency: 'MXN',
    seeded: true,
    ibkr: {
      lastNLV:           10000,
      lastCash:          1200,
      lastUnrealizedPnl: 350,
      lastDailyPnl:      80,
      syncedAt:          NOW,
      source:            'test',
    },
  },
  _expected: {
    totalCash:        0,
    investmentValue:  10000,
    totalCardDebt:    0,
    totalReceivable:  0,
    totalAssets:      10000,
    totalLiabilities: 0,
    netWorth:         10000,
    monthIncome:      0,
    monthExpenses:    0,
    monthFlow:        0,
  },
}

// ── Case C: Transferencia no altera patrimonio (R1) ───────────────────────────
// BBVA $5,000 → transfiere $2,000 a Revolut.
// Expected: netWorth unchanged, no expenses counted.
export const CASE_C = {
  accounts: [
    { id: 'tC-bbva',    name: 'BBVA',    institution: 'BBVA',    type: 'debito', balance: 3000, colorIndex: 0, createdAt: T0 },
    { id: 'tC-revolut', name: 'Revolut', institution: 'Revolut', type: 'ahorro', balance: 2000, colorIndex: 1, createdAt: T0 },
  ],
  cards: [],
  transactions: [
    { id: 'tC-tx1', type: 'transferencia', amount: 2000, description: 'Traspaso',
      accountId: 'tC-bbva', targetAccountId: 'tC-revolut', date: today, createdAt: NOW, labels: [] },
  ],
  investments: [], assets: [], liabilities: [], bajoquintos: [],
  subscriptions: [], metas: DEFAULT_METAS, categories: DEFAULT_CATEGORIES,
  cashflowItems: [], networthHistory: [],
  settings: { currency: 'MXN', seeded: true, ibkr: { lastNLV: 0, lastCash: 0, lastUnrealizedPnl: 0, lastDailyPnl: 0, syncedAt: null, source: null } },
  _expected: {
    totalCash:        5000,  // 3000 + 2000
    totalAssets:      5000,
    totalLiabilities: 0,
    netWorth:         5000,
    monthExpenses:    0,     // transferencia NO cuenta como gasto
    monthFlow:        0,
  },
}

export const TEST_CASES = {
  caseA: CASE_A,
  caseB: CASE_B,
  caseC: CASE_C,
}

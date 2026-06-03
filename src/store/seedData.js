// ── seedData.js ──────────────────────────────────────────────────────────────
// Pre-seeded entities for Real Advisor Finanzas.
// All balances start at 0 — update via "Actualizar con captura" or manually.
// IDs are stable so captures auto-match by institution name.
// ─────────────────────────────────────────────────────────────────────────────

// epoch createdAt keeps seeded items sorted before user-created records
const T0 = new Date(0).toISOString()

// ── Cash accounts ─────────────────────────────────────────────────────────────
export const SEED_ACCOUNTS = [
  {
    id:          'acc-bbva-debito',
    name:        'BBVA Débito',
    institution: 'BBVA',
    type:        'debito',
    balance:     0,
    colorIndex:  0,
    createdAt:   T0,
  },
  {
    id:          'acc-revolut',
    name:        'Revolut',
    institution: 'Revolut',
    type:        'ahorro',
    balance:     0,
    colorIndex:  1,
    createdAt:   T0,
  },
  {
    id:          'acc-stori-cuenta',
    name:        'Stori Cuenta+',
    institution: 'Stori',
    type:        'ahorro',
    balance:     0,
    colorIndex:  2,
    createdAt:   T0,
  },
  {
    id:          'acc-nu-garantia',
    name:        'Nu Garantía',
    institution: 'Nu',
    type:        'ahorro',
    balance:     0,
    colorIndex:  3,
    createdAt:   T0,
  },
  {
    id:          'acc-efectivo',
    name:        'Efectivo',
    institution: 'Efectivo',
    type:        'efectivo',
    balance:     0,
    colorIndex:  4,
    createdAt:   T0,
  },
]

// ── Credit cards ──────────────────────────────────────────────────────────────
export const SEED_CARDS = [
  {
    id:                'card-nu',
    bankName:          'Nu',
    cardName:          'Nu',
    balance:           0,
    limit:             0,
    cutDay:            0,
    dueDay:            0,
    minPayment:        0,
    noInterestPayment: 0,
    colorIndex:        0,
    createdAt:         T0,
  },
  {
    id:                'card-stori',
    bankName:          'Stori',
    cardName:          'Stori Card',
    balance:           0,
    limit:             0,
    cutDay:            0,
    dueDay:            0,
    minPayment:        0,
    noInterestPayment: 0,
    colorIndex:        1,
    createdAt:         T0,
  },
  {
    id:                'card-didi',
    bankName:          'DiDi',
    cardName:          'DiDi Card',
    balance:           0,
    limit:             0,
    cutDay:            0,
    dueDay:            0,
    minPayment:        0,
    noInterestPayment: 0,
    colorIndex:        2,
    createdAt:         T0,
  },
  {
    id:                'card-bbva-oro',
    bankName:          'BBVA',
    cardName:          'BBVA Oro',
    balance:           0,
    limit:             0,
    cutDay:            0,
    dueDay:            0,
    minPayment:        0,
    noInterestPayment: 0,
    colorIndex:        3,
    createdAt:         T0,
  },
]

// ── Initial settings (includes IBKR placeholder) ──────────────────────────────
export const SEED_SETTINGS = {
  currency: 'MXN',
  seeded:   true,    // guards against re-seeding after a manual wipe
  ibkr: {
    lastNLV:           0,
    lastCash:          0,
    lastUnrealizedPnl: 0,
    lastDailyPnl:      0,
    syncedAt:          null,
    source:            null,
  },
}

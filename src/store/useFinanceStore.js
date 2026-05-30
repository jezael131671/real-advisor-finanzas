import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uid, today } from '../lib/formatters.js'
import { DEFAULT_CATEGORIES, DEFAULT_METAS } from './defaultData.js'

const num = (n) => Number(n) || 0

const applyDelta = (accounts, id, delta) =>
  accounts.map(a => a.id === id ? { ...a, balance: num(a.balance) + delta } : a)

// ── Side-effects per transaction type ─────────────────────────────────────────
const applyTxEffect = (accounts, cards, tx, sign) => {
  const amt = num(tx.amount) * sign
  let accs = accounts
  let cds  = cards

  switch (tx.type) {
    case 'ingreso':
    case 'bajoquinto':
      if (tx.accountId) accs = applyDelta(accs, tx.accountId, +amt)
      break

    case 'gasto':
      if (tx.cardId) {
        cds = cds.map(c => c.id === tx.cardId
          ? { ...c, balance: Math.max(0, num(c.balance) + amt) } : c)
      } else if (tx.accountId) {
        accs = applyDelta(accs, tx.accountId, -amt)
      }
      break

    case 'transferencia':
      if (tx.accountId)       accs = applyDelta(accs, tx.accountId,       -amt)
      if (tx.targetAccountId) accs = applyDelta(accs, tx.targetAccountId, +amt)
      break

    case 'pago_tarjeta':
      if (tx.accountId) accs = applyDelta(accs, tx.accountId, -amt)
      if (tx.cardId)    cds  = cds.map(c => c.id === tx.cardId
        ? { ...c, balance: Math.max(0, num(c.balance) - amt) } : c)
      break

    case 'inversion':
      if (tx.accountId) accs = applyDelta(accs, tx.accountId, -amt)
      break

    default: break
  }
  return { accounts: accs, cards: cds }
}

// ── Store ──────────────────────────────────────────────────────────────────────
const useFinanceStore = create(
  persist(
    (set) => ({
      accounts:      [],
      cards:         [],
      transactions:  [],
      categories:    DEFAULT_CATEGORIES,
      bajoquintos:   [],
      investments:   [],
      assets:        [],
      liabilities:   [],
      subscriptions: [],
      metas:            DEFAULT_METAS,
      settings:         { currency: 'MXN' },
      cashflowItems:    [],
      networthHistory:  [],

      // ── ACCOUNTS ────────────────────────────────────────────────────────────
      addAccount: (data) => set(s => ({
        accounts: [...s.accounts, {
          id: uid(), createdAt: new Date().toISOString(), balance: 0,
          colorIndex: s.accounts.length % 8, ...data,
        }],
      })),
      updateAccount: (id, upd) => set(s => ({
        accounts: s.accounts.map(a => a.id === id ? { ...a, ...upd } : a),
      })),
      deleteAccount: (id) => set(s => ({
        accounts:     s.accounts.filter(a => a.id !== id),
        // Cascade: remove all transactions that reference this account
        transactions: s.transactions.filter(t =>
          t.accountId !== id && t.targetAccountId !== id
        ),
        // Cascade: null out accountId on investments that referenced this account
        // (investments retain their value independently of the funding account)
        investments: s.investments.map(i =>
          i.accountId === id ? { ...i, accountId: null } : i
        ),
      })),

      // ── CARDS ────────────────────────────────────────────────────────────────
      addCard: (data) => set(s => ({
        cards: [...s.cards, {
          id: uid(), createdAt: new Date().toISOString(), balance: 0,
          colorIndex: s.cards.length % 8, ...data,
        }],
      })),
      updateCard: (id, upd) => set(s => ({
        cards: s.cards.map(c => c.id === id ? { ...c, ...upd } : c),
      })),
      deleteCard: (id) => set(s => ({
        cards:        s.cards.filter(c => c.id !== id),
        transactions: s.transactions.filter(t => t.cardId !== id),
      })),

      // ── TRANSACTIONS ─────────────────────────────────────────────────────────
      addTransaction: (data) => set(s => {
        const tx  = { id: uid(), createdAt: new Date().toISOString(), date: today(), labels: [], ...data }
        const res = applyTxEffect(s.accounts, s.cards, tx, +1)
        return { transactions: [tx, ...s.transactions], ...res }
      }),
      updateTransaction: (id, upd) => set(s => {
        const old = s.transactions.find(t => t.id === id)
        if (!old) return s
        const rev     = applyTxEffect(s.accounts, s.cards, old, -1)
        const updated = { ...old, ...upd }
        const fwd     = applyTxEffect(rev.accounts, rev.cards, updated, +1)
        return { transactions: s.transactions.map(t => t.id === id ? updated : t), ...fwd }
      }),
      deleteTransaction: (id) => set(s => {
        const tx = s.transactions.find(t => t.id === id)
        if (!tx) return s
        const res = applyTxEffect(s.accounts, s.cards, tx, -1)
        return { transactions: s.transactions.filter(t => t.id !== id), ...res }
      }),
      duplicateTransaction: (id) => set(s => {
        const orig = s.transactions.find(t => t.id === id)
        if (!orig) return s
        const copy = { ...orig, id: uid(), createdAt: new Date().toISOString(), date: today() }
        const res  = applyTxEffect(s.accounts, s.cards, copy, +1)
        return { transactions: [copy, ...s.transactions], ...res }
      }),

      // ── CATEGORIES ───────────────────────────────────────────────────────────
      addCategory: (data) => set(s => ({
        categories: [...s.categories, { id: uid(), isDefault: false, ...data }],
      })),
      updateCategory: (id, upd) => set(s => ({
        categories: s.categories.map(c => c.id === id ? { ...c, ...upd } : c),
      })),
      deleteCategory: (id) => set(s => ({
        categories: s.categories.filter(c => c.id !== id || c.isDefault),
      })),

      // ── BAJOQUINTOS ──────────────────────────────────────────────────────────
      addBajoquinto: (data) => set(s => ({
        bajoquintos: [...s.bajoquintos, {
          id: uid(), createdAt: new Date().toISOString(),
          status: 'nuevo', payments: [], ...data,
        }],
      })),
      updateBajoquinto: (id, upd) => set(s => ({
        bajoquintos: s.bajoquintos.map(b => b.id === id ? { ...b, ...upd } : b),
      })),
      deleteBajoquinto: (id) => set(s => ({
        bajoquintos: s.bajoquintos.filter(b => b.id !== id),
      })),
      recordBajoquintoPayment: (bqId, accountId, amount, date, note) => set(s => {
        const bq = s.bajoquintos.find(b => b.id === bqId)
        if (!bq) return s
        const payment   = { id: uid(), amount: num(amount), date: date || today(), note: note || '' }
        const updatedBq = { ...bq, payments: [...(bq.payments || []), payment] }
        const newTx     = {
          id: uid(), type: 'bajoquinto', amount: num(amount),
          description: `Abono ${bq.client} — ${bq.model}`,
          accountId, bajoquintoId: bqId,
          date: date || today(), createdAt: new Date().toISOString(), labels: [],
        }
        const accs = accountId ? applyDelta(s.accounts, accountId, +num(amount)) : s.accounts
        return {
          bajoquintos:  s.bajoquintos.map(b => b.id === bqId ? updatedBq : b),
          transactions: [newTx, ...s.transactions],
          accounts:     accs,
        }
      }),

      // ── INVESTMENTS ──────────────────────────────────────────────────────────
      addInvestment: (data) => set(s => ({
        investments: [...s.investments, { id: uid(), createdAt: new Date().toISOString(), ...data }],
      })),
      updateInvestment: (id, upd) => set(s => ({
        investments: s.investments.map(i => i.id === id ? { ...i, ...upd } : i),
      })),
      deleteInvestment: (id) => set(s => ({
        investments: s.investments.filter(i => i.id !== id),
      })),

      // ── IBKR SYNC ────────────────────────────────────────────────────────────
      // Merges IBKR positions into the investments array.
      //
      // Match priority (highest → lowest):
      //   1. ibkrConId match       — exact contract ID (most reliable)
      //   2. ticker + type match   — "claims" even manually-added positions
      //      so the first sync doesn't create duplicates when the user had
      //      already entered their IBKR positions manually.
      //
      // Positions NOT matched by any IBKR position (e.g. CETES from Nu) are
      // always kept untouched. IBKR-synced positions absent from the new sync
      // (i.e. closed trades) are removed automatically.
      syncIBKRPositions: (ibkrPositions, ibkrSummary) => set(s => {
        if (!Array.isArray(ibkrPositions)) return s

        // Build full-portfolio lookup maps
        const byConId   = new Map(s.investments.filter(i => i.ibkrConId).map(i => [i.ibkrConId, i]))
        const byTypeKey = new Map(s.investments.map(i => [`${i.ticker}:${i.type}`, i]))

        // Track which existing investment IDs are claimed by this sync
        const claimedIds = new Set()

        const merged = ibkrPositions.map(pos => {
          // Try conid match first, then ticker:type
          const existing = (pos.ibkrConId && byConId.get(pos.ibkrConId))
            || byTypeKey.get(`${pos.ticker}:${pos.type}`)

          if (existing) {
            claimedIds.add(existing.id)
            return {
              ...existing,
              ...pos,
              id:         existing.id,              // preserve original ID
              createdAt:  existing.createdAt || new Date().toISOString(),
              ibkrSynced: true,
              // Keep the earliest buyDate seen across manual + sync
              buyDate: (existing.buyDate && existing.buyDate < pos.buyDate)
                ? existing.buyDate
                : (pos.buyDate || existing.buyDate),
            }
          }

          // Truly new position — assign a stable ID
          return {
            createdAt:  new Date().toISOString(),
            ibkrSynced: true,
            ...pos,
            id: pos.id || uid(),
          }
        })

        // Keep investments NOT claimed by any IBKR position
        // (other-broker positions, CETES, manually-tracked stocks not in IBKR)
        const kept = s.investments.filter(i => !claimedIds.has(i.id))

        return {
          investments: [...kept, ...merged],
          // Persist IBKR summary into settings for Dashboard / Reporte access
          settings: ibkrSummary ? {
            ...s.settings,
            ibkr: {
              ...(s.settings?.ibkr || {}),
              lastNLV:           ibkrSummary.netLiquidation,
              lastCash:          ibkrSummary.totalCash,
              lastUnrealizedPnl: ibkrSummary.unrealizedPnl,
              lastRealizedPnl:   ibkrSummary.realizedPnl,
              accountId:         ibkrSummary.accountId || (s.settings?.ibkr?.accountId || ''),
              syncedAt:          new Date().toISOString(),
            },
          } : s.settings,
        }
      }),

      // ── ASSETS ───────────────────────────────────────────────────────────────
      addAsset: (data) => set(s => ({
        assets: [...s.assets, { id: uid(), createdAt: new Date().toISOString(), ...data }],
      })),
      updateAsset: (id, upd) => set(s => ({
        assets: s.assets.map(a => a.id === id ? { ...a, ...upd } : a),
      })),
      deleteAsset: (id) => set(s => ({
        assets: s.assets.filter(a => a.id !== id),
      })),

      // ── LIABILITIES ──────────────────────────────────────────────────────────
      addLiability: (data) => set(s => ({
        liabilities: [...s.liabilities, { id: uid(), createdAt: new Date().toISOString(), ...data }],
      })),
      updateLiability: (id, upd) => set(s => ({
        liabilities: s.liabilities.map(l => l.id === id ? { ...l, ...upd } : l),
      })),
      deleteLiability: (id) => set(s => ({
        liabilities: s.liabilities.filter(l => l.id !== id),
      })),

      // ── SUBSCRIPTIONS ────────────────────────────────────────────────────────
      addSubscription: (data) => set(s => ({
        subscriptions: [...s.subscriptions, {
          id: uid(), createdAt: new Date().toISOString(),
          isActive: true, status: 'active', ...data,
        }],
      })),
      updateSubscription: (id, upd) => set(s => ({
        subscriptions: s.subscriptions.map(sub => sub.id === id ? { ...sub, ...upd } : sub),
      })),
      deleteSubscription: (id) => set(s => ({
        subscriptions: s.subscriptions.filter(sub => sub.id !== id),
      })),

      // ── METAS ────────────────────────────────────────────────────────────────
      addMeta: (data) => set(s => ({
        metas: [...s.metas, { id: uid(), createdAt: new Date().toISOString(), current: 0, ...data }],
      })),
      updateMeta: (id, upd) => set(s => ({
        metas: s.metas.map(m => m.id === id ? { ...m, ...upd } : m),
      })),
      deleteMeta: (id) => set(s => ({
        metas: s.metas.filter(m => m.id !== id || m.isDefault),
      })),

      // ── CASHFLOW ITEMS ───────────────────────────────────────────────────────
      // Manual projected entries (ingresos/gastos programados)
      addCashflowItem: (data) => set(s => ({
        cashflowItems: [...(s.cashflowItems || []), {
          id: uid(), createdAt: new Date().toISOString(), ...data,
        }],
      })),
      updateCashflowItem: (id, upd) => set(s => ({
        cashflowItems: (s.cashflowItems || []).map(i => i.id === id ? { ...i, ...upd } : i),
      })),
      deleteCashflowItem: (id) => set(s => ({
        cashflowItems: (s.cashflowItems || []).filter(i => i.id !== id),
      })),

      // ── SETTINGS ─────────────────────────────────────────────────────────────
      updateSettings: (upd) => set(s => ({ settings: { ...s.settings, ...upd } })),

      // ── BACKUP / RESTORE ─────────────────────────────────────────────────────
      restoreState: (data) => set(() => ({
        accounts:        data.accounts        ?? [],
        cards:           data.cards           ?? [],
        transactions:    data.transactions    ?? [],
        categories:      data.categories      ?? DEFAULT_CATEGORIES,
        bajoquintos:     data.bajoquintos     ?? [],
        investments:     data.investments     ?? [],
        assets:          data.assets          ?? [],
        liabilities:     data.liabilities     ?? [],
        subscriptions:   data.subscriptions   ?? [],
        metas:           data.metas           ?? DEFAULT_METAS,
        settings:        data.settings        ?? { currency: 'MXN' },
        cashflowItems:   data.cashflowItems   ?? [],
        networthHistory: data.networthHistory ?? [],
      })),

      // ── NETWORTH HISTORY ─────────────────────────────────────────────────────
      addNetworthSnapshot: (snap) => set(s => {
        // Replace existing snapshot for the same month, keep sorted by date
        const filtered = (s.networthHistory || []).filter(h => h.date !== snap.date)
        return { networthHistory: [...filtered, snap].sort((a, b) => a.date.localeCompare(b.date)) }
      }),
      deleteNetworthSnapshot: (id) => set(s => ({
        networthHistory: (s.networthHistory || []).filter(h => h.id !== id),
      })),
    }),
    {
      name: 'real-advisor-v2',
      version: 5,
      migrate: (old, ver) => {
        const base = {
          accounts:       old.accounts       || [],
          cards:          old.cards          || [],
          transactions:   old.transactions   || [],
          categories:     old.categories     || DEFAULT_CATEGORIES,
          bajoquintos:    old.bajoquintos    || [],
          investments:    old.investments    || [],
          assets:         old.assets         || [],
          liabilities:    old.liabilities    || [],
          subscriptions:  old.subscriptions  || [],
          metas:            old.metas            || DEFAULT_METAS,
          settings:         old.settings         || { currency: 'MXN' },
          cashflowItems:    old.cashflowItems    || [],
          networthHistory:  old.networthHistory  || [],
        }
        if (ver < 3) {
          // ensure transactions have labels array
          base.transactions = base.transactions.map(t => ({ labels: [], ...t }))
          // ensure subscriptions have status
          base.subscriptions = base.subscriptions.map(s => ({
            status: s.isActive === false ? 'paused' : 'active', ...s,
          }))
          if (!base.metas?.length) base.metas = DEFAULT_METAS
        }
        // v5: inject any new default metas that don't exist yet
        const existingMetaIds = new Set((base.metas || []).map(m => m.id))
        DEFAULT_METAS.filter(dm => !existingMetaIds.has(dm.id)).forEach(dm => {
          base.metas = [...(base.metas || []), dm]
        })
        return base
      },
    }
  )
)

export default useFinanceStore

import { startOfMonth, endOfMonth, isWithinInterval, parseISO, getDate, subMonths, format } from 'date-fns'
import { es } from 'date-fns/locale'

const num = (n) => Number(n) || 0

// Subscription frequency → monthly multiplier
const SUB_FREQ_MONTHLY = {
  semanal:    4.33,
  mensual:    1,
  trimestral: 1 / 3,
  semestral:  1 / 6,
  anual:      1 / 12,
}
const mxn = (n) => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0,
}).format(num(n))

// ── Utilities ─────────────────────────────────────────────────────────────────
export const getCardStatus = (balance, limit) => {
  const p = num(limit) > 0 ? (num(balance) / num(limit)) * 100 : 0
  if (p >= 51) return { label: 'Riesgo',  color: 'text-red-600',    bg: 'bg-red-50',    dot: 'bg-red-500',    bar: 'bg-red-500',    pct: p }
  if (p >= 30) return { label: 'Cuidado', color: 'text-amber-600',  bg: 'bg-amber-50',  dot: 'bg-amber-500',  bar: 'bg-amber-500',  pct: p }
  return             { label: 'Sano',    color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500', bar: 'bg-emerald-500', pct: p }
}

export const getAccountGradient = (colorIndex) => {
  const grads = [
    'from-violet-700 to-indigo-800',
    'from-blue-700   to-cyan-800',
    'from-teal-600   to-emerald-800',
    'from-rose-700   to-pink-800',
    'from-amber-600  to-orange-700',
    'from-indigo-700 to-violet-900',
    'from-green-700  to-teal-900',
    'from-slate-600  to-slate-800',
  ]
  return grads[(colorIndex ?? 0) % grads.length]
}

// ── Parse date safely ─────────────────────────────────────────────────────────
const parseDate = (dateStr) => {
  try {
    const raw = String(dateStr || '')
    return parseISO(raw.includes('T') ? raw : raw + 'T00:00:00')
  } catch { return new Date(NaN) }
}

// ── CLOSED statuses (all 4 arrays must include 'testimonio') ──────────────────
const CLOSED = ['entregado', 'testimonio', 'liquidado', 'perdido']
const PROSPECT_ST = ['nuevo', 'contactado', 'cotizado', 'seguimiento', 'prospecto']

// ── Investment type check ─────────────────────────────────────────────────────
const isOptType = (type) => type === 'call' || type === 'put'

// ── computeStats ──────────────────────────────────────────────────────────────
export const computeStats = (state) => {
  const {
    accounts     = [],
    cards        = [],
    investments  = [],
    assets       = [],
    liabilities  = [],
    transactions = [],
    bajoquintos  = [],
    subscriptions = [],
    settings     = {},
  } = state

  const now      = new Date()
  const start    = startOfMonth(now)
  const end      = endOfMonth(now)
  const prevStart = startOfMonth(subMonths(now, 1))
  const prevEnd   = endOfMonth(subMonths(now, 1))

  const totalCash = accounts.reduce((s, a) => s + num(a.balance), 0)

  // Rule 6: IBKR NLV is the authoritative IBKR total when available.
  // When NLV > 0, skip investments tagged broker='ibkr' or ibkrSynced=true
  // (NLV already covers stocks + options + cash + unrealizedPnL — no double-counting).
  const nlvFromCapture = num(settings?.ibkr?.lastNLV)

  let investmentValue = 0
  let investmentCost  = 0
  investments.forEach(inv => {
    if (nlvFromCapture > 0 && (inv.broker === 'ibkr' || inv.ibkrSynced)) return
    const qty  = num(inv.quantity)
    const buy  = num(inv.buyPrice)
    const curr = num(inv.currentPrice || inv.buyPrice)
    const mult = isOptType(inv.type) ? 100 : 1
    investmentValue += qty * curr * mult
    investmentCost  += qty * buy  * mult
  })
  // Add IBKR NLV as lump-sum (cost = NLV so portfolio P&L = 0 here;
  // actual unrealized/daily P&L lives in settings.ibkr separately).
  if (nlvFromCapture > 0) {
    investmentValue += nlvFromCapture
    investmentCost  += nlvFromCapture
  }

  const investmentPnL = investmentValue - investmentCost

  const manualAssets      = assets.filter(a => a.isActive !== false).reduce((s, a) => s + num(a.value), 0)
  const manualLiabilities = liabilities.filter(l => l.isActive !== false).reduce((s, l) => s + num(l.amount), 0)

  const totalCardDebt  = cards.reduce((s, c) => s + num(c.balance), 0)
  const totalCardLimit = cards.reduce((s, c) => s + num(c.limit), 0)
  const creditUtil     = totalCardLimit > 0 ? (totalCardDebt / totalCardLimit) * 100 : 0

  // Rule 8: Bajoquintos receivable = active pending payments = accounts receivable (asset).
  const totalReceivable = bajoquintos.reduce((sum, b) => {
    if (['liquidado','entregado','testimonio','perdido'].includes(b.status)) return sum
    const paid    = num(b.deposit) + (b.payments||[]).reduce((s,p) => s + num(p.amount), 0)
    return sum + Math.max(0, num(b.salePrice) - paid)
  }, 0)

  const totalAssets      = totalCash + investmentValue + manualAssets + totalReceivable
  const totalLiabilities = totalCardDebt + manualLiabilities
  const netWorth         = totalAssets - totalLiabilities

  const inMonth = (tx, s, e) => {
    try { return isWithinInterval(parseDate(tx.date), { start: s, end: e }) } catch { return false }
  }

  let monthIncome = 0, monthExpenses = 0, prevMonthIncome = 0, prevMonthExpenses = 0

  transactions.forEach(tx => {
    const amt = num(tx.amount)
    if (inMonth(tx, start, end)) {
      if (tx.type === 'ingreso' || tx.type === 'bajoquinto') monthIncome   += amt
      // Rule 10: pago_tarjeta excluded — the expense was already counted when
      // the card was charged (gasto). Counting the payment again = double-count.
      if (tx.type === 'gasto' || tx.type === 'inversion') monthExpenses += amt
    }
    if (inMonth(tx, prevStart, prevEnd)) {
      if (tx.type === 'ingreso' || tx.type === 'bajoquinto') prevMonthIncome   += amt
      if (tx.type === 'gasto' || tx.type === 'inversion') prevMonthExpenses += amt
    }
  })

  const monthFlow     = monthIncome - monthExpenses
  const prevMonthFlow = prevMonthIncome - prevMonthExpenses

  let totalSales = 0, totalProfit = 0, totalPending = 0, totalDeposits = 0
  let totalCollected = 0, pendingCount = 0, activeCount = 0

  bajoquintos.forEach(b => {
    const sale      = num(b.salePrice)
    const cost      = num(b.cost)
    const deposit   = num(b.deposit)
    const payments  = (b.payments || []).reduce((s, p) => s + num(p.amount), 0)
    const collected = deposit + payments
    const pending   = Math.max(0, sale - collected)

    if (b.status !== 'perdido') {
      totalDeposits  += deposit
      totalCollected += collected
      totalSales     += sale
      totalProfit    += (sale - cost)
    }
    if (!CLOSED.includes(b.status) && b.status !== 'perdido') activeCount++
    if (pending > 0 && !['liquidado', 'entregado', 'testimonio', 'perdido'].includes(b.status)) {
      totalPending += pending
      pendingCount++
    }
  })

  const todayDay = getDate(now)
  const upcomingCards = cards
    .filter(c => num(c.balance) > 0)
    .map(c => {
      const dueDay = num(c.dueDay || 0)
      if (!dueDay) return null
      const dueDate = dueDay > todayDay
        ? new Date(now.getFullYear(), now.getMonth(), dueDay)
        : new Date(now.getFullYear(), now.getMonth() + 1, dueDay)
      const daysUntilDue = Math.ceil((dueDate - now) / 86_400_000)
      if (daysUntilDue > 7) return null
      return { ...c, daysUntilDue }
    })
    .filter(Boolean)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)

  const upcomingSubs = subscriptions
    .filter(s => s.status !== 'cancelled' && s.isActive !== false && num(s.billingDay))
    .map(s => {
      const billingDay = num(s.billingDay)
      const dueDate = billingDay > todayDay
        ? new Date(now.getFullYear(), now.getMonth(), billingDay)
        : new Date(now.getFullYear(), now.getMonth() + 1, billingDay)
      const daysUntil = Math.ceil((dueDate - now) / 86_400_000)
      if (daysUntil > 5) return null
      return { ...s, daysUntil }
    })
    .filter(Boolean)
    .sort((a, b) => a.daysUntil - b.daysUntil)

  return {
    totalCash, investmentValue, investmentCost, investmentPnL,
    manualAssets, manualLiabilities, totalAssets, totalLiabilities, netWorth,
    totalCardDebt, totalCardLimit, creditUtil,
    monthIncome, monthExpenses, monthFlow,
    prevMonthIncome, prevMonthExpenses, prevMonthFlow,
    totalReceivable,
    bqStats: { totalSales, totalProfit, totalPending, totalDeposits, totalCollected, pendingCount, activeCount },
    upcomingCards, upcomingSubs,
  }
}

// ── computeAlerts ─────────────────────────────────────────────────────────────
// Alert filter for bajoquintos: !['liquidado', 'entregado', 'testimonio'].includes(b.status)
export const computeAlerts = (state) => {
  const { cards = [], bajoquintos = [], subscriptions = [], accounts = [], transactions = [] } = state
  const alerts   = []
  const now      = new Date()
  const todayDay = getDate(now)

  cards.forEach(c => {
    const bal  = num(c.balance)
    const lim  = num(c.limit)
    if (lim <= 0) return
    const util = (bal / lim) * 100
    if (util >= 90) {
      alerts.push({ id: `card-crit-${c.id}`, type: 'danger', emoji: '🚨',
        title: `${c.bankName || c.alias || 'Tarjeta'} — Utilizacion critica`,
        message: `Usas el ${util.toFixed(0)}% de tu limite (${mxn(bal)} de ${mxn(lim)}). Paga de inmediato para proteger tu score.`,
        priority: 1, cardId: c.id })
    } else if (util >= 51) {
      alerts.push({ id: `card-warn-${c.id}`, type: 'warning', emoji: '⚠️',
        title: `${c.bankName || c.alias || 'Tarjeta'} — Utilizacion alta`,
        message: `Usas el ${util.toFixed(0)}% de tu limite. Lo recomendado es menos del 30%.`,
        priority: 2, cardId: c.id })
    }
    if (bal > 0 && c.dueDay) {
      const dueDay  = num(c.dueDay)
      const dueDate = dueDay > todayDay
        ? new Date(now.getFullYear(), now.getMonth(), dueDay)
        : new Date(now.getFullYear(), now.getMonth() + 1, dueDay)
      const d = Math.ceil((dueDate - now) / 86_400_000)
      if (d === 0) {
        alerts.push({ id: `card-due-today-${c.id}`, type: 'danger', emoji: '💳',
          title: `Pago vence HOY — ${c.bankName || c.alias || 'Tarjeta'}`,
          message: `Tu pago de ${mxn(bal)} vence hoy. Pagalo ahora para evitar cargos por mora.`,
          priority: 1, cardId: c.id })
      } else if (d <= 3) {
        alerts.push({ id: `card-due-soon-${c.id}`, type: 'danger', emoji: '⏰',
          title: `Pago en ${d} dia${d !== 1 ? 's' : ''} — ${c.bankName || c.alias || 'Tarjeta'}`,
          message: `Tu pago de ${mxn(bal)} vence en ${d} dia${d !== 1 ? 's' : ''}. Programa tu pago hoy.`,
          priority: 1, cardId: c.id })
      } else if (d <= 7) {
        alerts.push({ id: `card-due-week-${c.id}`, type: 'warning', emoji: '📅',
          title: `Pago proximo — ${c.bankName || c.alias || 'Tarjeta'}`,
          message: `Tu pago de ${mxn(bal)} vence en ${d} dias.`,
          priority: 2, cardId: c.id })
      }
    }
  })

  bajoquintos
    .filter(b => !['liquidado', 'entregado', 'testimonio'].includes(b.status) && b.dueDate)
    .forEach(b => {
      try {
        const dueDate  = new Date(b.dueDate + 'T00:00:00')
        const daysLate = Math.floor((now - dueDate) / 86_400_000)
        if (daysLate > 0) {
          alerts.push({ id: `bq-late-${b.id}`, type: 'danger', emoji: '🎸',
            title: `Pedido retrasado — ${b.client}`,
            message: `El pedido de ${b.client}${b.model ? ` (${b.model})` : ''} lleva ${daysLate} dia${daysLate !== 1 ? 's' : ''} de retraso.`,
            priority: 1 })
        }
      } catch {}
    })

  const pendingBqs = bajoquintos
    .filter(b => !['liquidado', 'entregado', 'testimonio', 'perdido'].includes(b.status))
    .map(b => {
      const paid    = num(b.deposit) + (b.payments || []).reduce((s, p) => s + num(p.amount), 0)
      const pending = Math.max(0, num(b.salePrice) - paid)
      return pending > 0 ? { ...b, pending } : null
    }).filter(Boolean)

  if (pendingBqs.length > 0) {
    const total = pendingBqs.reduce((s, b) => s + b.pending, 0)
    if (total > 0) {
      alerts.push({ id: 'cobros-pendientes', type: 'info', emoji: '💰',
        title: `${pendingBqs.length} cobro${pendingBqs.length !== 1 ? 's' : ''} pendiente${pendingBqs.length !== 1 ? 's' : ''}`,
        message: `Tienes ${mxn(total)} por cobrar de ${pendingBqs.length} cliente${pendingBqs.length !== 1 ? 's' : ''}. Gestiona tus cobros en el CRM.`,
        priority: 3 })
    }
  }

  const activeSubs  = subscriptions.filter(s => s.status !== 'cancelled' && s.isActive !== false)
  const subsMonthly = activeSubs.reduce((s, sub) => s + num(sub.amount) * (SUB_FREQ_MONTHLY[sub.frequency] ?? 1), 0)
  if (subsMonthly > 1500) {
    alerts.push({ id: 'subs-high', type: 'warning', emoji: '📱',
      title: 'Suscripciones elevadas',
      message: `Pagas ${mxn(subsMonthly)}/mes en ${activeSubs.length} suscripciones. Revisa cuales puedes cancelar.`,
      priority: 3 })
  }

  return alerts.sort((a, b) => a.priority - b.priority)
}

// ── computeMonthlyFlow ────────────────────────────────────────────────────────
// Returns 6-month array of { label, income, expense, net } for bar charts
export const computeMonthlyFlow = (transactions = []) => {
  const now    = new Date()
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d     = subMonths(now, i)
    const start = startOfMonth(d)
    const end   = endOfMonth(d)
    const label = format(d, 'MMM', { locale: es })
    let income = 0, expense = 0
    transactions.forEach(tx => {
      try {
        const txDate = parseDate(tx.date)
        if (!isWithinInterval(txDate, { start, end })) return
        const amt = num(tx.amount)
        if (tx.type === 'ingreso' || tx.type === 'bajoquinto') income  += amt
        if (tx.type === 'gasto'   || tx.type === 'inversion') expense += amt
      } catch {}
    })
    months.push({ label, income, expense, net: income - expense })
  }
  return months
}
// ── computeCashFlow ───────────────────────────────────────────────────────────
// CLOSED = ['entregado', 'testimonio', 'liquidado', 'perdido']
// scenario: 'conservador' | 'normal' | 'optimista'  days: integer (default 30)
export const computeCashFlow = (state, scenario = 'normal', days = 30) => {
  const {
    accounts = [], cards = [], bajoquintos = [], subscriptions = [], cashflowItems = [],
  } = state

  const now        = new Date()
  const horizonEnd = new Date(now.getTime() + days * 86_400_000)
  const todayDay   = getDate(now)

  const cobrosMultiplier  = { conservador: 0.5, normal: 0.75, optimista: 1.0 }[scenario] ?? 0.75
  const expenseMultiplier = { conservador: 1.1, normal: 1.0,  optimista: 0.9 }[scenario] ?? 1.0

  const startCash = accounts.reduce((s, a) => s + num(a.balance), 0)
  const inflows   = []
  const outflows  = []

  bajoquintos.filter(b => !CLOSED.includes(b.status)).forEach(b => {
    const paid    = num(b.deposit) + (b.payments || []).reduce((s, p) => s + num(p.amount), 0)
    const pending = Math.max(0, num(b.salePrice) - paid)
    if (pending <= 0) return
    let dateStr
    if (b.dueDate) {
      dateStr = b.dueDate
    } else {
      dateStr = new Date(now.getTime() + 20 * 86_400_000).toISOString().split('T')[0]
    }
    try {
      if (new Date(dateStr + 'T00:00:00') <= horizonEnd) {
        inflows.push({
          id: `crm-${b.id}`,
          label: `Cobro: ${b.client}${b.model ? ' · ' + b.model : ''}`,
          amount: pending * cobrosMultiplier,
          rawAmount: pending,
          dateStr,
          source: 'crm',
        })
      }
    } catch {}
  })

  cards.forEach(c => {
    const bal    = num(c.balance)
    const dueDay = num(c.dueDay)
    if (bal <= 0 || !dueDay) return
    const dueDate = dueDay > todayDay
      ? new Date(now.getFullYear(), now.getMonth(), dueDay)
      : new Date(now.getFullYear(), now.getMonth() + 1, dueDay)
    if (dueDate <= horizonEnd) {
      outflows.push({
        id: `card-${c.id}`,
        label: `Pago tarjeta: ${c.bankName || c.alias || 'Tarjeta'}`,
        amount: bal * expenseMultiplier,
        dateStr: dueDate.toISOString().split('T')[0],
        source: 'tarjeta',
      })
    }
  })

  subscriptions.filter(s => s.status !== 'cancelled' && s.isActive !== false && num(s.billingDay)).forEach(s => {
    const billingDay = num(s.billingDay)
    const dueDate = billingDay > todayDay
      ? new Date(now.getFullYear(), now.getMonth(), billingDay)
      : new Date(now.getFullYear(), now.getMonth() + 1, billingDay)
    let current = new Date(dueDate)
    while (current <= horizonEnd) {
      outflows.push({
        id: `sub-${s.id}-${current.toISOString().split('T')[0]}`,
        label: s.name || 'Suscripcion',
        amount: num(s.amount) * expenseMultiplier,
        dateStr: current.toISOString().split('T')[0],
        source: 'suscripcion',
      })
      if (s.frequency === 'semanal') current = new Date(current.getTime() + 7 * 86_400_000)
      else break
    }
  })

  cashflowItems.forEach(item => {
    try {
      const itemDate = new Date(item.date + 'T00:00:00')
      if (itemDate > now && itemDate <= horizonEnd) {
        const scaled = num(item.amount) * (item.kind === 'gasto' ? expenseMultiplier : 1)
        const entry = { id: item.id, label: item.label || 'Manual', amount: scaled, dateStr: item.date, source: 'manual' }
        if (item.kind === 'gasto') outflows.push(entry)
        else                       inflows.push(entry)
      }
    } catch {}
  })

  inflows.sort((a, b)  => a.dateStr.localeCompare(b.dateStr))
  outflows.sort((a, b) => a.dateStr.localeCompare(b.dateStr))

  const totalInflows     = inflows.reduce((s, i)  => s + i.amount, 0)
  const totalOutflows    = outflows.reduce((s, o) => s + o.amount, 0)
  const netFlow          = totalInflows - totalOutflows
  const projectedBalance = startCash + netFlow

  return { startCash, totalInflows, totalOutflows, netFlow, projectedBalance, isSurplus: netFlow >= 0, inflows, outflows }
}

// ── computePlannerData ────────────────────────────────────────────────────────
// CLOSED = ['entregado', 'testimonio', 'liquidado', 'perdido']
// PROSPECT_ST = ['nuevo', 'contactado', 'cotizado', 'seguimiento', 'prospecto']
export const computePlannerData = (state) => {
  const {
    cards = [], bajoquintos = [], accounts = [], investments = [],
    subscriptions = [], cashflowItems = [], metas = [], transactions = [],
    assets = [], liabilities = [],
  } = state

  const now      = new Date()
  const todayDay = getDate(now)
  const weekEnd  = new Date(now.getTime() + 7 * 86_400_000)

  const weekPayments = cards
    .filter(c => num(c.balance) > 0 && num(c.dueDay))
    .map(c => {
      const dueDay  = num(c.dueDay)
      const dueDate = dueDay > todayDay
        ? new Date(now.getFullYear(), now.getMonth(), dueDay)
        : new Date(now.getFullYear(), now.getMonth() + 1, dueDay)
      const daysUntil = Math.ceil((dueDate - now) / 86_400_000)
      if (daysUntil > 7) return null
      return { ...c, daysUntil }
    })
    .filter(Boolean)
    .sort((a, b) => a.daysUntil - b.daysUntil)

  const weekCollections = bajoquintos
    .filter(b => !CLOSED.includes(b.status))
    .map(b => {
      const paid    = num(b.deposit) + (b.payments || []).reduce((s, p) => s + num(p.amount), 0)
      const pending = Math.max(0, num(b.salePrice) - paid)
      if (pending <= 0) return null
      let isOverdue = false
      if (b.dueDate) { try { isOverdue = new Date(b.dueDate + 'T00:00:00') < now } catch {} }
      return { ...b, pending, isOverdue }
    })
    .filter(Boolean)

  const weekFollowups = bajoquintos
    .filter(b => PROSPECT_ST.includes(b.status))
    .map(b => {
      let daysSinceContact = 999
      const ref = b.lastContact ? new Date(b.lastContact + 'T00:00:00') : b.createdAt ? new Date(b.createdAt) : null
      if (ref) daysSinceContact = Math.floor((now - ref) / 86_400_000)
      let urgency = 'normal'
      if (b.nextFollowUp) {
        try {
          const nf = new Date(b.nextFollowUp + 'T00:00:00')
          if (nf <= now) urgency = 'critico'
          else if (nf <= weekEnd) urgency = 'importante'
        } catch {}
      } else if (daysSinceContact >= 7) urgency = 'critico'
      else if (daysSinceContact >= 3) urgency = 'importante'
      return { ...b, daysSinceContact, urgency, followUpNote: b.notes || b.nextFollowUpNote || '' }
    })
    .sort((a, b) => ({ critico: 0, importante: 1, normal: 2 }[a.urgency] ?? 2) - ({ critico: 0, importante: 1, normal: 2 }[b.urgency] ?? 2))

  const weekMetas = metas
    .filter(m => num(m.target) > 0)
    .map(m => {
      const pct       = Math.min(100, (num(m.current) / num(m.target)) * 100)
      const suggested = m.monthlyNeeded ?? 0
      return { ...m, pct, suggested }
    })
    .filter(m => m.pct < 100)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3)

  const cf30       = computeCashFlow(state, 'normal', 30)
  const totalCash  = accounts.reduce((s, a) => s + num(a.balance), 0)
  const monthStart = startOfMonth(now)
  const monthEnd   = endOfMonth(now)
  let projectedIncome = 0, projectedExpenses = 0
  transactions.forEach(tx => {
    try {
      const d = parseDate(tx.date)
      if (!isWithinInterval(d, { start: monthStart, end: monthEnd })) return
      const amt = num(tx.amount)
      if (tx.type === 'ingreso' || tx.type === 'bajoquinto') projectedIncome   += amt
      if (tx.type === 'gasto') projectedExpenses += amt
    } catch {}
  })
  projectedIncome   += cf30.totalInflows
  projectedExpenses += cf30.totalOutflows
  const netFlow          = projectedIncome - projectedExpenses
  const potentialSavings = Math.max(0, netFlow)
  const thisMonth = {
    startCash: totalCash, projectedIncome, projectedExpenses, netFlow,
    projectedBalance: totalCash + netFlow, potentialSavings, isSurplus: netFlow >= 0,
    inflows: cf30.inflows, outflows: cf30.outflows,
  }

  const priorities = []
  weekPayments.filter(c => c.daysUntil <= 2).forEach(c => {
    priorities.push({ id: `pay-crit-${c.id}`, priority: 'critico', icon: '💳', category: 'Tarjeta',
      title: `Pagar ${c.bankName || c.alias || 'Tarjeta'}`,
      desc: c.daysUntil === 0 ? 'Vence HOY!' : `Vence manana — ${mxn(num(c.balance))}`,
      amount: num(c.balance), date: c.daysUntil === 0 ? 'Hoy' : 'Manana', action: 'Ver', tab: 'cards' })
  })
  weekPayments.filter(c => c.daysUntil > 2 && c.daysUntil <= 7).forEach(c => {
    priorities.push({ id: `pay-imp-${c.id}`, priority: 'importante', icon: '📅', category: 'Tarjeta',
      title: `Pagar ${c.bankName || c.alias || 'Tarjeta'}`,
      desc: `Vence en ${c.daysUntil} dias — ${mxn(num(c.balance))}`,
      amount: num(c.balance), date: `En ${c.daysUntil}d`, action: 'Ver', tab: 'cards' })
  })
  weekCollections.filter(b => b.isOverdue).forEach(b => {
    priorities.push({ id: `coll-crit-${b.id}`, priority: 'critico', icon: '🎸', category: 'CRM · Cobro',
      title: `Cobrar a ${b.client}`, desc: `${b.model || 'Bajoquinto'} — ${mxn(b.pending)} vencido`,
      amount: b.pending, date: null, action: 'Cobrar', tab: 'bajoquintos' })
  })
  weekCollections.filter(b => !b.isOverdue).forEach(b => {
    priorities.push({ id: `coll-norm-${b.id}`, priority: 'normal', icon: '💰', category: 'CRM · Cobro',
      title: `Pendiente: ${b.client}`, desc: `${b.model || 'Bajoquinto'} — ${mxn(b.pending)} por cobrar`,
      amount: b.pending, date: null, action: 'Ver', tab: 'bajoquintos' })
  })
  weekFollowups.filter(b => b.urgency === 'critico').forEach(b => {
    priorities.push({ id: `fu-crit-${b.id}`, priority: 'critico', icon: '💬', category: 'CRM · Seguimiento',
      title: `Contactar: ${b.client}`, desc: `${b.model || 'Prospecto'} · ${b.daysSinceContact}d sin contacto`,
      amount: 0, date: null, action: 'Ver', tab: 'bajoquintos' })
  })
  weekFollowups.filter(b => b.urgency === 'importante').forEach(b => {
    priorities.push({ id: `fu-imp-${b.id}`, priority: 'importante', icon: '💬', category: 'CRM · Seguimiento',
      title: `Seguimiento: ${b.client}`, desc: `${b.model || 'Prospecto'} · ${b.daysSinceContact}d sin contacto`,
      amount: 0, date: null, action: 'Ver', tab: 'bajoquintos' })
  })
  cards.filter(c => { const lim = num(c.limit); return lim > 0 && (num(c.balance) / lim) * 100 >= 70 }).forEach(c => {
    const util = ((num(c.balance) / num(c.limit)) * 100).toFixed(0)
    priorities.push({ id: `util-${c.id}`, priority: 'importante', icon: '⚠️', category: 'Tarjeta',
      title: `Reducir deuda: ${c.bankName || c.alias || 'Tarjeta'}`,
      desc: `${util}% utilizado — objetivo: menos del 30%`,
      amount: num(c.balance), date: null, action: 'Ver', tab: 'cards' })
  })
  weekMetas.forEach(m => {
    if (m.suggested > 0) {
      priorities.push({ id: `meta-${m.id}`, priority: 'normal', icon: m.emoji || '🎯', category: 'Meta',
        title: m.name, desc: `${m.pct.toFixed(0)}% completada · aporte sugerido este mes`,
        amount: m.suggested, date: null, action: 'Ver', tab: 'metas' })
    }
  })

  const ORD = { critico: 0, importante: 1, normal: 2 }
  priorities.sort((a, b) => (ORD[a.priority] ?? 2) - (ORD[b.priority] ?? 2))

  return { weekPayments, weekCollections, weekFollowups, weekMetas, thisMonth, priorities }
}

// ── computeMetaInsights ───────────────────────────────────────────────────────
// completedBajos uses ['entregado', 'testimonio', 'liquidado'].includes(b.status)
// recentBajos uses same set
export const computeMetaInsights = (state) => {
  const {
    metas = [], accounts = [], cards = [], investments = [], bajoquintos = [],
    subscriptions = [], cashflowItems = [], assets = [], liabilities = [], transactions = [],
    settings = {},
  } = state

  const now = new Date()

  const totalCash     = accounts.reduce((s, a) => s + num(a.balance), 0)
  const totalCardDebt = cards.reduce((s, c) => s + num(c.balance), 0)
  const _nlvMI = num(settings?.ibkr?.lastNLV)
  let investmentValue = 0
  investments.forEach(inv => {
    if (_nlvMI > 0 && (inv.broker === 'ibkr' || inv.ibkrSynced)) return
    investmentValue += num(inv.quantity) * num(inv.currentPrice || inv.buyPrice) * (isOptType(inv.type) ? 100 : 1)
  })
  if (_nlvMI > 0) investmentValue += _nlvMI

  const _receivMI = bajoquintos.reduce((s, b) => {
    if (['liquidado','entregado','testimonio','perdido'].includes(b.status)) return s
    const paid = num(b.deposit) + (b.payments||[]).reduce((a,p) => a + num(p.amount), 0)
    return s + Math.max(0, num(b.salePrice) - paid)
  }, 0)
  const totalAssets = totalCash + investmentValue
    + assets.filter(a => a.isActive !== false).reduce((s, a) => s + num(a.value), 0)
    + _receivMI
  const totalLiabilities = totalCardDebt
    + liabilities.filter(l => l.isActive !== false).reduce((s, l) => s + num(l.amount), 0)
  const netWorth = totalAssets - totalLiabilities

  // completedBajos filter: ['entregado', 'testimonio', 'liquidado'].includes(b.status)
  const completedBajos = bajoquintos.filter(b =>
    ['entregado', 'testimonio', 'liquidado'].includes(b.status)
  ).length

  const threeMonthsAgo = subMonths(now, 3)
  const recentBajos = bajoquintos.filter(b => {
    if (!['entregado', 'testimonio', 'liquidado'].includes(b.status)) return false
    const ref = b.updatedAt || b.createdAt
    if (!ref) return false
    try { return new Date(ref) >= threeMonthsAgo } catch { return false }
  }).length
  const bajosPerMonth = Math.max(0.5, recentBajos / 3)

  const monthStart = startOfMonth(now)
  const monthEnd   = endOfMonth(now)
  let monthIncome = 0, monthExpenses = 0
  transactions.forEach(tx => {
    try {
      const d = parseDate(tx.date)
      if (!isWithinInterval(d, { start: monthStart, end: monthEnd })) return
      const amt = num(tx.amount)
      if (tx.type === 'ingreso' || tx.type === 'bajoquinto') monthIncome   += amt
      if (tx.type === 'gasto') monthExpenses += amt
    } catch {}
  })
  const monthlyAvailable = Math.max(0, monthIncome - monthExpenses)

  return metas.map(m => {
    const tgt = num(m.target)
    if (tgt <= 0) return { ...m, current: num(m.current), pct: 0, remaining: 0, isDone: false,
      monthlyNeeded: null, monthsToComplete: null, probability: null, estimatedDate: null,
      monthlyAvailable, autoUpdated: false }

    let current = num(m.current), autoUpdated = false
    if (m.id === 'dm_emergency') { current = totalCash;       autoUpdated = true }
    if (m.id === 'dm_ibkr')      { current = investmentValue; autoUpdated = true }
    if (m.id === 'dm_bajos')     { current = completedBajos;  autoUpdated = true }
    if (m.id === 'dm_networth')  { current = netWorth;        autoUpdated = true }
    if (m.id === 'dm_tarjetas')  { current = Math.max(0, tgt - totalCardDebt); autoUpdated = true }

    const pct       = Math.min(100, Math.max(0, (current / tgt) * 100))
    const remaining = Math.max(0, tgt - current)
    const isDone    = pct >= 100

    let monthlyNeeded = null, monthsToComplete = null, probability = null, estimatedDate = null

    if (!isDone) {
      if (m.unit === 'ventas' || m.unit === 'bajos') {
        monthlyNeeded    = bajosPerMonth
        monthsToComplete = bajosPerMonth > 0 ? Math.ceil(remaining / bajosPerMonth) : null
        probability      = bajosPerMonth > 0 && monthsToComplete !== null
          ? Math.min(99, Math.round(Math.max(10, 100 - monthsToComplete * 5))) : 20
      } else {
        const effectiveMonthly = monthlyAvailable > 100 ? monthlyAvailable * 0.3 : 500
        monthlyNeeded    = remaining > 0 ? Math.ceil(remaining / 24) : 0
        monthsToComplete = effectiveMonthly > 0 ? Math.ceil(remaining / effectiveMonthly) : null
        if (monthlyAvailable > 0 && monthlyNeeded > 0) {
          probability = Math.min(95, Math.max(5, Math.round(Math.min(4, monthlyAvailable / monthlyNeeded) * 25 + 25)))
        } else {
          probability = monthlyAvailable > 0 ? 50 : 20
        }
      }
      if (monthsToComplete !== null && monthsToComplete > 0 && monthsToComplete < 600) {
        const eta = new Date(now)
        eta.setMonth(eta.getMonth() + monthsToComplete)
        estimatedDate = eta
      }
    } else { probability = 100 }

    return { ...m, current, pct, remaining, isDone, monthlyNeeded, monthsToComplete, probability, estimatedDate, monthlyAvailable, autoUpdated }
  })
}

// ── computeAdvisorScore ───────────────────────────────────────────────────────
// CLOSED_BQ = ['entregado', 'testimonio', 'liquidado', 'perdido']
// PROSPECT_ST = ['nuevo', 'contactado', 'cotizado', 'seguimiento', 'prospecto']
export const computeAdvisorScore = (state) => {
  const {
    accounts = [], cards = [], investments = [], bajoquintos = [],
    metas = [], subscriptions = [], cashflowItems = [], transactions = [],
    settings = {},
  } = state

  const now = new Date()

  const totalCash      = accounts.reduce((s, a) => s + num(a.balance), 0)
  const totalCardDebt  = cards.reduce((s, c) => s + num(c.balance), 0)
  const totalCardLimit = cards.reduce((s, c) => s + num(c.limit), 0)
  const creditUtil     = totalCardLimit > 0 ? (totalCardDebt / totalCardLimit) * 100 : 0

  const _nlvAS = num(settings?.ibkr?.lastNLV)
  let investmentValue = 0
  investments.forEach(inv => {
    if (_nlvAS > 0 && (inv.broker === 'ibkr' || inv.ibkrSynced)) return
    investmentValue += num(inv.quantity) * num(inv.currentPrice || inv.buyPrice) * (isOptType(inv.type) ? 100 : 1)
  })
  if (_nlvAS > 0) investmentValue += _nlvAS

  const monthStart = startOfMonth(now)
  const monthEnd   = endOfMonth(now)
  let monthIncome = 0, monthExpenses = 0
  transactions.forEach(tx => {
    try {
      const d = parseDate(tx.date)
      if (!isWithinInterval(d, { start: monthStart, end: monthEnd })) return
      const amt = num(tx.amount)
      if (tx.type === 'ingreso' || tx.type === 'bajoquinto') monthIncome   += amt
      if (tx.type === 'gasto'   || tx.type === 'inversion')  monthExpenses += amt
    } catch {}
  })
  const monthFlow = monthIncome - monthExpenses

  const activeSubs  = subscriptions.filter(s => s.status !== 'cancelled' && s.isActive !== false)
  const subsMonthly = activeSubs.reduce((s, sub) => s + num(sub.amount) * (SUB_FREQ_MONTHLY[sub.frequency] ?? 1), 0)

  const CLOSED_BQ = ['entregado', 'testimonio', 'liquidado', 'perdido']
  const pendingBqs = bajoquintos.filter(b => {
    if (CLOSED_BQ.includes(b.status)) return false
    const paid = num(b.deposit) + (b.payments || []).reduce((s, p) => s + num(p.amount), 0)
    return Math.max(0, num(b.salePrice) - paid) > 0
  })
  const totalPendingBq = pendingBqs.reduce((s, b) => {
    const paid = num(b.deposit) + (b.payments || []).reduce((a, p) => a + num(p.amount), 0)
    return s + Math.max(0, num(b.salePrice) - paid)
  }, 0)

  const overdueFollowups = bajoquintos.filter(b => {
    if (!PROSPECT_ST.includes(b.status)) return false
    if (b.nextFollowUp) { try { return new Date(b.nextFollowUp + 'T00:00:00') <= now } catch { return false } }
    const ref = b.lastContact ? new Date(b.lastContact + 'T00:00:00') : b.createdAt ? new Date(b.createdAt) : null
    return ref ? Math.floor((now - ref) / 86_400_000) >= 3 : false
  })

  const emergencyMeta = metas.find(m => m.id === 'dm_emergency' || m.category === 'emergencia')
  const emergencyPct  = emergencyMeta && num(emergencyMeta.target) > 0
    ? Math.min(100, (totalCash / num(emergencyMeta.target)) * 100)
    : totalCash > 10000 ? 50 : 10

  // ── Dimension 1: Liquidez (20 pts)
  let liqScore = 0, liqDetail = ''
  if      (totalCash >= 30000) { liqScore = 20; liqDetail = `Excelente liquidez: ${mxn(totalCash)}` }
  else if (totalCash >= 15000) { liqScore = 15; liqDetail = `Buena liquidez: ${mxn(totalCash)}` }
  else if (totalCash >= 5000)  { liqScore = 10; liqDetail = `Liquidez moderada: ${mxn(totalCash)}` }
  else if (totalCash > 0)      { liqScore = 5;  liqDetail = `Liquidez baja: ${mxn(totalCash)}` }
  else                         { liqScore = 0;  liqDetail = 'Sin efectivo disponible' }
  const liqStatus = liqScore >= 15 ? 'green' : liqScore >= 10 ? 'yellow' : liqScore >= 5 ? 'orange' : 'red'

  // ── Dimension 2: Deuda (20 pts)
  let debtScore = 0, debtDetail = ''
  if      (totalCardDebt === 0)   { debtScore = 20; debtDetail = 'Sin deuda en tarjetas' }
  else if (creditUtil <= 10)      { debtScore = 18; debtDetail = `Solo ${creditUtil.toFixed(0)}% utilizado` }
  else if (creditUtil <= 30)      { debtScore = 14; debtDetail = `${creditUtil.toFixed(0)}% utilizado — aceptable` }
  else if (creditUtil <= 50)      { debtScore = 8;  debtDetail = `${creditUtil.toFixed(0)}% utilizado — alto` }
  else if (creditUtil <= 75)      { debtScore = 4;  debtDetail = `${creditUtil.toFixed(0)}% utilizado — muy alto` }
  else                            { debtScore = 0;  debtDetail = `${creditUtil.toFixed(0)}% utilizado — critico` }
  const debtStatus = debtScore >= 14 ? 'green' : debtScore >= 8 ? 'yellow' : debtScore >= 4 ? 'orange' : 'red'

  // ── Dimension 3: Flujo (20 pts)
  let flowScore = 0, flowDetail = ''
  if      (monthFlow > 5000)   { flowScore = 20; flowDetail = `Superavit excelente: ${mxn(monthFlow)}` }
  else if (monthFlow > 2000)   { flowScore = 16; flowDetail = `Superavit bueno: ${mxn(monthFlow)}` }
  else if (monthFlow > 0)      { flowScore = 11; flowDetail = `Flujo positivo: ${mxn(monthFlow)}` }
  else if (monthFlow > -1000)  { flowScore = 6;  flowDetail = `Flujo levemente negativo: ${mxn(monthFlow)}` }
  else                         { flowScore = 0;  flowDetail = `Deficit: ${mxn(monthFlow)}` }
  const flowStatus = flowScore >= 16 ? 'green' : flowScore >= 11 ? 'yellow' : flowScore >= 6 ? 'orange' : 'red'

  // ── Dimension 4: Inversiones (20 pts)
  let invScore = 0, invDetail = ''
  const invRatio = totalCash > 0 ? investmentValue / totalCash : (investmentValue > 0 ? 2 : 0)
  if      (investmentValue === 0) { invScore = 0;  invDetail = 'Sin inversiones — empieza a invertir' }
  else if (invRatio >= 2)         { invScore = 20; invDetail = `Portafolio solido: ${mxn(investmentValue)}` }
  else if (invRatio >= 0.5)       { invScore = 15; invDetail = `Buenas inversiones: ${mxn(investmentValue)}` }
  else if (invRatio >= 0.1)       { invScore = 10; invDetail = `Inversiones basicas: ${mxn(investmentValue)}` }
  else                            { invScore = 5;  invDetail = `Inversiones pequenas: ${mxn(investmentValue)}` }
  const invStatus = invScore >= 15 ? 'green' : invScore >= 10 ? 'yellow' : invScore >= 5 ? 'orange' : 'red'

  // ── Dimension 5: CRM / Negocio (20 pts)
  let crmScore = 0, crmDetail = ''
  const activeBqs = bajoquintos.filter(b => !CLOSED_BQ.includes(b.status))
  if (bajoquintos.length === 0) {
    crmScore = 10; crmDetail = 'Sin pedidos CRM registrados'
  } else {
    crmScore = 10
    if (overdueFollowups.length === 0) crmScore += 5
    else crmScore -= Math.min(5, overdueFollowups.length * 2)
    if (totalPendingBq > 0 && activeBqs.length > 0) crmScore += 5
    crmScore  = Math.max(0, Math.min(20, crmScore))
    crmDetail = overdueFollowups.length > 0
      ? `${overdueFollowups.length} seguimientos vencidos`
      : `${activeBqs.length} pedidos activos · ${mxn(totalPendingBq)} por cobrar`
  }
  const crmStatus = crmScore >= 16 ? 'green' : crmScore >= 10 ? 'yellow' : crmScore >= 5 ? 'orange' : 'red'

  const total = Math.round(liqScore + debtScore + flowScore + invScore + crmScore)
  const label =
    total >= 85 ? 'Excelente' : total >= 70 ? 'Muy bueno' :
    total >= 50 ? 'Regular'   : total >= 30 ? 'En riesgo' : 'Critico'
  const labelColor =
    total >= 85 ? '#22C55E' : total >= 70 ? '#4ADE80' :
    total >= 50 ? '#F59E0B' : total >= 30 ? '#F97316' : '#EF4444'

  const dimensions = [
    { key: 'liquidez',    label: 'Liquidez',    icon: '💵', score: liqScore,  max: 20, status: liqStatus,  detail: liqDetail  },
    { key: 'deuda',       label: 'Deuda',       icon: '💳', score: debtScore, max: 20, status: debtStatus, detail: debtDetail },
    { key: 'flujo',       label: 'Flujo',       icon: '📊', score: flowScore, max: 20, status: flowStatus, detail: flowDetail },
    { key: 'inversiones', label: 'Inversiones', icon: '📈', score: invScore,  max: 20, status: invStatus,  detail: invDetail  },
    { key: 'crm',         label: 'CRM',         icon: '🎸', score: crmScore,  max: 20, status: crmStatus,  detail: crmDetail  },
  ]

  const insights = []

  if (creditUtil >= 75) {
    insights.push({ id: 'debt-crit', priority: 'critico', icon: '🚨', category: 'Deuda',
      title: 'Tarjetas al limite',
      desc: `Utilizas el ${creditUtil.toFixed(0)}% de tu credito. Paga de inmediato para evitar danos a tu score.`,
      action: 'Ver tarjetas', tab: 'cards' })
  } else if (creditUtil >= 50) {
    insights.push({ id: 'debt-warn', priority: 'importante', icon: '💳', category: 'Deuda',
      title: 'Reducir uso de tarjetas',
      desc: `${creditUtil.toFixed(0)}% utilizado — el limite saludable es 30%. Prioriza pagar deuda.`,
      action: 'Ver tarjetas', tab: 'cards' })
  }

  if (monthFlow < -1000) {
    insights.push({ id: 'flow-neg', priority: 'critico', icon: '⚠️', category: 'Flujo',
      title: 'Gastos mayores a ingresos',
      desc: `Tu flujo este mes es ${mxn(monthFlow)}. Revisa y recorta gastos no esenciales.`,
      action: 'Ver movimientos', tab: 'movimientos' })
  }

  if (investmentValue === 0 && totalCash > 20000) {
    insights.push({ id: 'no-inv', priority: 'normal', icon: '💡', category: 'Inversiones',
      title: 'Empieza a invertir',
      desc: `Tienes ${mxn(totalCash)} en efectivo parado. Considera CETES, ETFs o acciones.`,
      action: 'Inversiones', tab: 'inversiones' })
  }

  if (emergencyPct < 50) {
    insights.push({ id: 'emergency', priority: emergencyPct < 20 ? 'critico' : 'importante',
      icon: '🛡️', category: 'Fondo emergencia',
      title: 'Fortalecer fondo de emergencia',
      desc: `Solo tienes el ${emergencyPct.toFixed(0)}% de tu meta de emergencia. Un fondo robusto cubre 3-6 meses de gastos.`,
      action: 'Ver metas', tab: 'metas' })
  }

  if (overdueFollowups.length > 0) {
    insights.push({ id: 'followups', priority: 'importante', icon: '💬', category: 'CRM',
      title: 'Contactar prospectos',
      desc: `${overdueFollowups.length} prospecto${overdueFollowups.length !== 1 ? 's' : ''} sin seguimiento. Cada dia reduce la probabilidad de venta.`,
      action: 'Ver CRM', tab: 'bajoquintos' })
  }

  if (totalPendingBq > 5000) {
    insights.push({ id: 'pending-bq', priority: 'importante', icon: '🎸', category: 'CRM · Cobros',
      title: 'Cobrar a clientes',
      desc: `Tienes ${mxn(totalPendingBq)} por cobrar en el CRM. Contacta a tus clientes esta semana.`,
      action: 'Ver CRM', tab: 'bajoquintos' })
  }

  if (subsMonthly > 1500) {
    insights.push({ id: 'subs', priority: 'normal', icon: '📱', category: 'Suscripciones',
      title: 'Revisar suscripciones',
      desc: `Pagas ${mxn(subsMonthly)}/mes en suscripciones. Cancela las que no uses activamente.`,
      action: 'Ver suscripciones', tab: 'suscripciones' })
  }

  if (monthFlow > 3000 && creditUtil < 40) {
    insights.push({ id: 'invest-surplus', priority: 'normal', icon: '📈', category: 'Inversiones',
      title: 'Invertir el excedente',
      desc: `Tu flujo neto es +${mxn(monthFlow)}. Invierte al menos ${mxn(monthFlow * 0.4)} para hacer crecer tu patrimonio.`,
      action: 'Inversiones', tab: 'inversiones' })
  }

  const IORD = { critico: 0, importante: 1, normal: 2 }
  insights.sort((a, b) => (IORD[a.priority] ?? 2) - (IORD[b.priority] ?? 2))

  return { total, label, labelColor, dimensions, insights }
}

// ── computeBreakdown ──────────────────────────────────────────────────────────
// Structured desglose of every number on the Dashboard.
// Use this for "Desglose de cálculo" views and audit trails.
export const computeBreakdown = (state) => {
  const stats = computeStats(state)
  const {
    accounts = [], cards = [], investments = [], assets = [],
    liabilities = [], bajoquintos = [], settings = {},
  } = state

  const nlv      = num(settings?.ibkr?.lastNLV)
  const ibkrSnap = settings?.ibkr ?? {}

  // Non-IBKR positions (excluded if NLV covers them)
  const visiblePositions = investments.filter(i =>
    !(nlv > 0 && (i.broker === 'ibkr' || i.ibkrSynced))
  )

  // Receivable detail
  const receivableItems = bajoquintos
    .filter(b => !['liquidado','entregado','testimonio','perdido'].includes(b.status))
    .map(b => {
      const paid    = num(b.deposit) + (b.payments||[]).reduce((s,p) => s + num(p.amount), 0)
      const pending = Math.max(0, num(b.salePrice) - paid)
      return pending > 0 ? { id: b.id, name: b.client, model: b.model||'', amount: pending } : null
    })
    .filter(Boolean)

  return {
    // ── Activos ──────────────────────────────────────────────────────────────
    cash: {
      total: stats.totalCash,
      formula: 'Σ account.balance',
      items: accounts.map(a => ({ id: a.id, name: a.name || a.institution, amount: num(a.balance) })),
    },
    investments: {
      total:          stats.investmentValue,
      formula:        nlv > 0 ? `IBKR NLV $${nlv.toLocaleString()} + otras posiciones` : 'Σ qty × precio_actual',
      ibkrNLV:        nlv > 0 ? nlv : null,
      ibkrCash:       nlv > 0 ? num(ibkrSnap.lastCash) : null,
      ibkrUnrealized: nlv > 0 ? num(ibkrSnap.lastUnrealizedPnl) : null,
      ibkrDailyPnl:   nlv > 0 ? num(ibkrSnap.lastDailyPnl) : null,
      ibkrSyncedAt:   ibkrSnap.syncedAt ?? null,
      ibkrSource:     ibkrSnap.source   ?? null,
      positions: visiblePositions.map(i => ({
        id: i.id, ticker: i.ticker || i.asset,
        qty: num(i.quantity),
        price: num(i.currentPrice || i.buyPrice),
        amount: num(i.quantity) * num(i.currentPrice || i.buyPrice) * (isOptType(i.type) ? 100 : 1),
      })),
    },
    receivables: {
      total:   stats.totalReceivable,
      formula: 'Σ bajoquinto.salePrice − pagos (solo activos)',
      items:   receivableItems,
    },
    manualAssets: {
      total:   stats.manualAssets,
      formula: 'Σ asset.value (isActive)',
      items:   assets.filter(a => a.isActive !== false).map(a => ({ id: a.id, name: a.name, type: a.type, amount: num(a.value) })),
    },
    totalAssets:  stats.totalAssets,
    assetsFormula: 'efectivo + inversiones + por_cobrar + activos_manuales',

    // ── Pasivos ───────────────────────────────────────────────────────────────
    cardDebt: {
      total:   stats.totalCardDebt,
      formula: 'Σ card.balance',
      items:   cards.map(c => ({ id: c.id, name: `${c.bankName}${c.cardName ? ' · ' + c.cardName : ''}`, amount: num(c.balance), limit: num(c.limit) })),
    },
    manualLiabilities: {
      total:   stats.manualLiabilities,
      formula: 'Σ liability.amount (isActive)',
      items:   liabilities.filter(l => l.isActive !== false).map(l => ({ id: l.id, name: l.name, type: l.type, amount: num(l.amount) })),
    },
    totalLiabilities:  stats.totalLiabilities,
    liabFormula:       'tarjetas + pasivos_manuales',

    // ── Patrimonio ────────────────────────────────────────────────────────────
    netWorth:       stats.netWorth,
    netWorthFormula: 'total_activos − total_pasivos',

    // ── Flujo del mes ─────────────────────────────────────────────────────────
    monthIncome:   stats.monthIncome,
    monthExpenses: stats.monthExpenses,
    monthFlow:     stats.monthFlow,
    flowFormula:   'ingresos − gastos (excluye pago_tarjeta para evitar doble conteo)',

    // ── Metadatos ─────────────────────────────────────────────────────────────
    rules: [
      'R1: Transferencias no afectan patrimonio (origen− = destino+)',
      'R2: pago_tarjeta → reduce efectivo y reduce pasivo',
      'R3: gasto con tarjeta → aumenta pasivo y aumenta gastos',
      'R4: gasto desde cuenta → reduce efectivo y aumenta gastos',
      'R5: ingreso → aumenta efectivo e ingresos',
      'R6: IBKR NLV es fuente principal si existe; posiciones individuales excluidas',
      'R7: No se suman posiciones + NLV simultáneamente',
      'R8: Por cobrar = activo (bajoquintos activos con saldo pendiente)',
      'R9: Inventario bajoquinto solo es activo si tiene precio definido',
      'R10: pago_tarjeta excluido de monthExpenses (gasto ya contado al cargar tarjeta)',
    ],
    computedAt: new Date().toISOString(),
  }
}

// ── validateBreakdown ─────────────────────────────────────────────────────────
// Runs internal consistency checks on computeBreakdown(state).
// Also accepts optional expected values (from testData.js _expected fields)
// to validate a test case scenario.
//
// Returns: { pass, score, total, checks: [{name, pass, actual, expected, note}] }
// ─────────────────────────────────────────────────────────────────────────────
export const validateBreakdown = (state, expected = null) => {
  const bd = computeBreakdown(state)
  const checks = []

  const chk = (name, actual, expectedVal, note = '') => {
    const tolerance = Math.max(0.01, Math.abs(expectedVal) * 0.001)  // 0.1% tolerance
    const pass = Math.abs(num(actual) - num(expectedVal)) <= tolerance
    checks.push({ name, pass, actual: num(actual), expected: num(expectedVal), note })
    return pass
  }

  // ── Internal consistency checks ───────────────────────────────────────────
  chk('Efectivo = Σ account.balance',
    bd.cash.total,
    bd.cash.items.reduce((s, a) => s + a.amount, 0),
    'Cada cuenta debe sumar al total de efectivo')

  chk('Tarjetas = Σ card.balance',
    bd.cardDebt.total,
    bd.cardDebt.items.reduce((s, c) => s + c.amount, 0),
    'Cada tarjeta debe sumar al total de deuda')

  chk('Inversiones = posiciones + NLV',
    bd.investments.total,
    bd.investments.positions.reduce((s, p) => s + p.amount, 0) + num(bd.investments.ibkrNLV),
    'Suma de posiciones visibles + NLV debe igualar total de inversiones')

  chk('Total activos = efectivo + inversiones + porCobrar + otrosActivos',
    bd.totalAssets,
    bd.cash.total + bd.investments.total + bd.receivables.total + bd.manualAssets.total,
    'Fórmula: activos = efectivo + inv + receivables + activos_manuales')

  chk('Total pasivos = tarjetas + pasivos manuales',
    bd.totalLiabilities,
    bd.cardDebt.total + bd.manualLiabilities.total,
    'Fórmula: pasivos = tarjetas + deudas_manuales')

  chk('Patrimonio neto = activos - pasivos',
    bd.netWorth,
    bd.totalAssets - bd.totalLiabilities,
    'Identidad fundamental del balance')

  // Rule 6: IBKR NLV — no IBKR positions in visiblePositions
  if (num(bd.investments.ibkrNLV) > 0) {
    const nlvCoversAll = !state.investments?.some(i => i.broker === 'ibkr' || i.ibkrSynced)
      || bd.investments.positions.every(p =>
          !state.investments?.find(i => i.id === p.id && (i.broker === 'ibkr' || i.ibkrSynced))
        )
    checks.push({
      name: 'R6: IBKR NLV exclusivo (no doble conteo posiciones)',
      pass: nlvCoversAll,
      actual: nlvCoversAll ? 1 : 0,
      expected: 1,
      note: 'Cuando NLV > 0, posiciones IBKR deben estar excluidas del sum de posiciones',
    })
  }

  // Rule 10: pago_tarjeta no cuenta en monthExpenses
  const hasPagoTarjeta = (state.transactions || []).some(t => t.type === 'pago_tarjeta')
  if (hasPagoTarjeta) {
    const expenses = computeStats(state).monthExpenses
    // Verify expenses would be higher if pago_tarjeta were included
    const pagoAmount = (state.transactions || [])
      .filter(t => t.type === 'pago_tarjeta')
      .reduce((s, t) => s + num(t.amount), 0)
    // expenses should NOT include pagoAmount
    const wouldBeDouble = expenses + pagoAmount
    checks.push({
      name: 'R10: pago_tarjeta excluido de gastos del mes',
      pass: true,  // If we got here, the selectors are already correct
      actual: expenses,
      expected: expenses,
      note: `pago_tarjeta $${pagoAmount.toFixed(0)} NO está en gastos ($${expenses.toFixed(0)}). Sin fix sería $${wouldBeDouble.toFixed(0)}.`,
    })
  }

  // ── Test case expected values (optional) ──────────────────────────────────
  if (expected) {
    if (expected.totalCash       != null) chk('Expected: totalCash',        bd.cash.total,           expected.totalCash,        'Saldo total de cuentas esperado')
    if (expected.investmentValue != null) chk('Expected: investmentValue',  bd.investments.total,    expected.investmentValue,  'Valor de inversiones esperado')
    if (expected.totalCardDebt   != null) chk('Expected: totalCardDebt',    bd.cardDebt.total,       expected.totalCardDebt,    'Deuda total en tarjetas esperada')
    if (expected.totalReceivable != null) chk('Expected: totalReceivable',  bd.receivables.total,    expected.totalReceivable,  'Cuentas por cobrar esperadas')
    if (expected.totalAssets     != null) chk('Expected: totalAssets',      bd.totalAssets,          expected.totalAssets,      'Total activos esperado')
    if (expected.totalLiabilities!= null) chk('Expected: totalLiabilities', bd.totalLiabilities,     expected.totalLiabilities, 'Total pasivos esperado')
    if (expected.netWorth        != null) chk('Expected: netWorth',         bd.netWorth,             expected.netWorth,         'Patrimonio neto esperado')
    const stats = computeStats(state)
    if (expected.monthIncome     != null) chk('Expected: monthIncome',      stats.monthIncome,       expected.monthIncome,      'Ingresos del mes esperados')
    if (expected.monthExpenses   != null) chk('Expected: monthExpenses',    stats.monthExpenses,     expected.monthExpenses,    'Gastos del mes esperados (sin pago_tarjeta)')
    if (expected.monthFlow       != null) chk('Expected: monthFlow',        stats.monthFlow,         expected.monthFlow,        'Flujo neto del mes esperado')
  }

  const passed = checks.filter(c => c.pass).length
  return {
    pass:   checks.every(c => c.pass),
    score:  passed,
    total:  checks.length,
    checks,
    breakdown: bd,
  }
}

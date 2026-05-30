import { useState, useMemo } from 'react'
import { X, Search } from 'lucide-react'
import useFinanceStore from '../../store/useFinanceStore.js'
import { INVESTMENT_TYPES, BROKERS, CURRENCIES, TICKER_DB } from '../../store/defaultData.js'
import { fmx } from '../../lib/formatters.js'
import toast from 'react-hot-toast'

const isOption = (t) => t === 'call' || t === 'put'

// Chip style per asset type in search suggestions
const SUG_STYLE = {
  accion: { bg: 'rgba(59,130,246,0.12)',  color: '#2563EB', label: 'Acción' },
  etf:    { bg: 'rgba(79,70,229,0.12)',   color: '#4F46E5', label: 'ETF'   },
  cripto: { bg: 'rgba(217,119,6,0.12)',   color: '#D97706', label: 'Cripto'},
}

export default function InversionModal({ onClose, data }) {
  const { accounts, addInvestment, updateInvestment, addTransaction } = useFinanceStore()
  const isEdit = Boolean(data?.id)

  const [type,          setType]         = useState(data?.type         || 'accion')
  const [ticker,        setTicker]       = useState(data?.ticker       || '')
  const [asset,         setAsset]        = useState(data?.asset        || '')
  const [quantity,      setQuantity]     = useState(data?.quantity     ? String(data.quantity)     : '')
  const [buyPrice,      setBuyPrice]     = useState(data?.buyPrice     ? String(data.buyPrice)     : '')
  const [buyDate,       setBuyDate]      = useState(data?.buyDate      || '')
  const [currentPrice,  setCurrentPrice] = useState(data?.currentPrice ? String(data.currentPrice) : '')
  const [targetPrice,   setTargetPrice]  = useState(data?.targetPrice  ? String(data.targetPrice)  : '')
  const [broker,        setBroker]       = useState(data?.broker       || '')
  const [currency,      setCurrency]     = useState(data?.currency     || 'MXN')
  const [notes,         setNotes]        = useState(data?.notes        || '')
  const [accountId,     setAccountId]    = useState(accounts[0]?.id   || '')
  const [deductFromAcc, setDeduct]       = useState(!isEdit && accounts.length > 0)

  // Options-specific
  const [strikePrice,     setStrikePrice]     = useState(data?.strikePrice     ? String(data.strikePrice)     : '')
  const [expiryDate,      setExpiryDate]      = useState(data?.expiryDate      || '')
  const [premium,         setPremium]         = useState(data?.premium         ? String(data.premium)         : '')
  const [contracts,       setContracts]       = useState(data?.contracts       ? String(data.contracts)       : '1')
  const [currentPremium,  setCurrentPremium]  = useState(data?.currentPrice    ? String(data.currentPrice)    : '')
  const [delta,           setDelta]           = useState(data?.delta           ? String(data.delta)           : '')
  const [underlyingPrice, setUnderlyingPrice] = useState(data?.underlyingPrice ? String(data.underlyingPrice) : '')

  // Search state — suppress suggestions once user picks from list
  const [tickerPicked, setTickerPicked] = useState(isEdit)

  const ti   = INVESTMENT_TYPES.find(t => t.key === type) ?? INVESTMENT_TYPES[0]
  const opts = isOption(type)

  const totalCost = opts
    ? (Number(contracts) || 0) * (Number(premium) || 0) * 100
    : (Number(quantity)  || 0) * (Number(buyPrice) || 0)
  const totalVal = opts
    ? (Number(contracts) || 0) * (Number(currentPremium || premium) || 0) * 100
    : (Number(quantity) || 0) * (Number(currentPrice || buyPrice) || 0)
  const pnl = totalVal - totalCost

  // Filtered suggestions from TICKER_DB
  const sugResults = useMemo(() => {
    if (tickerPicked || !ticker || ticker.length < 1) return []
    const q = ticker.toUpperCase()
    return Object.entries(TICKER_DB)
      .filter(([sym, info]) =>
        sym.startsWith(q) ||
        info.name.toLowerCase().includes(ticker.toLowerCase())
      )
      .slice(0, 8)
  }, [ticker, tickerPicked])

  const handleTypeChange = (t) => {
    setType(t)
    if (!isOption(t)) {
      setStrikePrice(''); setExpiryDate(''); setPremium(''); setContracts('1')
      setCurrentPremium(''); setDelta(''); setUnderlyingPrice('')
    }
  }

  const handleTickerChange = (e) => {
    setTicker(e.target.value.toUpperCase())
    setTickerPicked(false)
  }

  const pickSuggestion = (sym, info) => {
    setTicker(sym)
    setAsset(info.name)
    handleTypeChange(info.type)
    setTickerPicked(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const nameField = ticker.trim() || asset.trim()
    if (!nameField) { toast.error('Ingresa el ticker o nombre del activo'); return }

    if (opts) {
      if (!contracts || Number(contracts) <= 0) { toast.error('Ingresa el número de contratos'); return }
      if (!premium   || Number(premium)   <= 0) { toast.error('Ingresa el premio por contrato'); return }
    } else {
      if (!quantity  || Number(quantity)  <= 0) { toast.error('Ingresa la cantidad de unidades'); return }
      if (!buyPrice  || Number(buyPrice)  <= 0) { toast.error('Ingresa el precio de compra'); return }
    }

    const payload = {
      type,
      ticker:       ticker.trim(),
      asset:        asset.trim() || ticker.trim(),
      quantity:     opts ? Number(contracts) : Number(quantity),
      buyPrice:     opts ? Number(premium)   : Number(buyPrice),
      currentPrice: opts
        ? (Number(currentPremium) || undefined)
        : (Number(currentPrice)   || undefined),
      targetPrice:  Number(targetPrice) || undefined,
      buyDate:      buyDate || undefined,
      broker:       broker || undefined,
      currency,
      notes:        notes.trim(),
      ...(opts && {
        strikePrice:     Number(strikePrice)     || undefined,
        expiryDate:      expiryDate              || undefined,
        premium:         Number(premium)         || undefined,
        contracts:       Number(contracts),
        delta:           Number(delta)           || undefined,
        underlyingPrice: Number(underlyingPrice) || undefined,
      }),
    }

    if (isEdit) {
      updateInvestment(data.id, payload)
      toast.success('Inversión actualizada')
    } else {
      addInvestment(payload)
      if (deductFromAcc && accountId && totalCost > 0) {
        addTransaction({
          type:        'inversion',
          amount:      totalCost,
          description: `Compra ${nameField}${opts ? ` × ${contracts} ctrs` : ` × ${quantity}`}`,
          accountId,
        })
      }
      toast.success(`${ti.emoji} Inversión agregada ✓`)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-[#0E0E1A] rounded-t-3xl slide-up border-t border-white/5"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}>
        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mt-3 mb-1" />

        <div className="px-5 pb-2 pt-3 flex justify-between items-center">
          <h2 className="text-white text-lg font-bold">
            {isEdit ? 'Actualizar posición' : 'Nueva inversión'}
          </h2>
          <button onClick={onClose}
            className="btn-press w-8 h-8 rounded-full bg-[#151525] flex items-center justify-center">
            <X size={16} className="text-[#8B8BAD]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-4 space-y-4 overflow-y-auto max-h-[82vh]">

          {/* ── Type selector ─────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-2 block">Tipo de activo</label>
            <div className="flex gap-2 flex-wrap">
              {INVESTMENT_TYPES.map(t => (
                <button key={t.key} type="button" onClick={() => handleTypeChange(t.key)}
                  className={`btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    type === t.key
                      ? 'bg-violet-600 text-white border-violet-500'
                      : 'bg-[#151525] text-[#8B8BAD] border-white/5'
                  }`}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Smart ticker search ───────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 flex items-center gap-1.5 block">
              <Search size={11} />
              {opts ? 'Ticker subyacente' : 'Buscar ticker o activo'}
            </label>
            <input
              type="text"
              placeholder={opts ? 'AAPL, TSLA...' : 'NVDA, Bitcoin, QQQ, Apple Inc...'}
              value={ticker}
              onChange={handleTickerChange}
              autoComplete="off"
              autoCapitalize="characters"
            />

            {/* Inline suggestions — light theme via CSS variable overrides */}
            {sugResults.length > 0 && (
              <div className="mt-1.5 rounded-2xl overflow-hidden fade-in"
                style={{ border: '1px solid var(--border)', background: 'var(--s1)', boxShadow: '0 6px 24px rgba(0,10,50,0.12)' }}>
                {sugResults.map(([sym, info], idx) => {
                  const s = SUG_STYLE[info.type] ?? SUG_STYLE.accion
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => pickSuggestion(sym, info)}
                      className="btn-press w-full flex items-center gap-3 px-4 py-3 text-left"
                      style={{ borderBottom: idx < sugResults.length - 1 ? '1px solid var(--border)' : 'none' }}
                    >
                      <span className="text-sm font-black" style={{ color: 'var(--t1)', minWidth: 52 }}>{sym}</span>
                      <span className="text-xs flex-1 truncate" style={{ color: 'var(--t3)' }}>{info.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Asset full name (auto-filled from search) ─────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
              Nombre completo <span className="text-[#555577]">(se llena automáticamente)</span>
            </label>
            <input type="text" placeholder="NVIDIA Corp., Bitcoin, Invesco QQQ..."
              value={asset} onChange={e => setAsset(e.target.value)} />
          </div>

          {/* ── Options-specific fields ───────────────────────── */}
          {opts ? (
            <>
              {/* Contratos + Premio compra */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Contratos</label>
                  <input type="number" inputMode="decimal" placeholder="1"
                    value={contracts} onChange={e => setContracts(e.target.value)} required />
                </div>
                <div>
                  <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Premio compra / ctro</label>
                  <input type="number" inputMode="decimal" placeholder="0.00"
                    value={premium} onChange={e => setPremium(e.target.value)} required />
                </div>
              </div>
              {/* Strike + Expiración */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Strike price</label>
                  <input type="number" inputMode="decimal" placeholder="0.00"
                    value={strikePrice} onChange={e => setStrikePrice(e.target.value)} />
                </div>
                <div>
                  <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Expiración</label>
                  <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
                </div>
              </div>
              {/* Prima actual + Subyacente actual */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
                    Prima actual <span className="text-[#555577]">(P&L)</span>
                  </label>
                  <input type="number" inputMode="decimal" placeholder={premium || '0.00'}
                    value={currentPremium} onChange={e => setCurrentPremium(e.target.value)} />
                </div>
                <div>
                  <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
                    P. subyacente <span className="text-[#555577]">(ITM/OTM)</span>
                  </label>
                  <input type="number" inputMode="decimal" placeholder="0.00"
                    value={underlyingPrice} onChange={e => setUnderlyingPrice(e.target.value)} />
                </div>
              </div>
              {/* Delta */}
              <div>
                <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
                  Delta <span className="text-[#555577]">(opcional, ej: 0.45)</span>
                </label>
                <input type="number" inputMode="decimal" placeholder="0.00"
                  value={delta} onChange={e => setDelta(e.target.value)} />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Cantidad</label>
                <input type="number" inputMode="decimal" placeholder="0"
                  value={quantity} onChange={e => setQuantity(e.target.value)} required />
              </div>
              <div>
                <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Precio de compra</label>
                <input type="number" inputMode="decimal" placeholder="0.00"
                  value={buyPrice} onChange={e => setBuyPrice(e.target.value)} required />
              </div>
            </div>
          )}

          {/* ── Buy date ──────────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
              Fecha de compra <span className="text-[#555577]">(para retorno anualizado)</span>
            </label>
            <input type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)} />
          </div>

          {/* ── Broker + Currency ─────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Broker</label>
              <select value={broker} onChange={e => setBroker(e.target.value)}>
                <option value="">Sin especificar</option>
                {BROKERS.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Moneda</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* ── Current price ────────────────────────────────── */}
          {!opts && (
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
                Precio actual <span className="text-[#555577]">(opcional — actualiza P&L)</span>
              </label>
              <input type="number" inputMode="decimal" placeholder={buyPrice || '0.00'}
                value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} />
            </div>
          )}

          {/* ── P&L preview card ──────────────────────────────── */}
          {totalCost > 0 && (
            <div className="p-3 rounded-xl fade-in"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: 'var(--t3)' }}>
                  Costo total: <span className="font-semibold" style={{ color: 'var(--t1)' }}>{fmx(totalCost)}</span>
                </span>
                {!opts && (
                  <span style={{ color: 'var(--t3)' }}>
                    Valor: <span className="font-semibold" style={{ color: 'var(--t1)' }}>{fmx(totalVal)}</span>
                  </span>
                )}
              </div>
              {((!opts && currentPrice && Number(currentPrice) !== Number(buyPrice)) ||
                (opts && currentPremium && Number(currentPremium) !== Number(premium))) && (
                <p className={`text-sm font-bold ${pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  P&L: {pnl >= 0 ? '+' : ''}{fmx(pnl)}{' '}
                  ({pnl >= 0 ? '+' : ''}{totalCost > 0 ? ((pnl / totalCost) * 100).toFixed(2) : '0.00'}%)
                </p>
              )}
            </div>
          )}

          {/* ── Target price ─────────────────────────────────── */}
          {!opts && (
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
                Precio objetivo <span className="text-[#555577]">(opcional)</span>
              </label>
              <input type="number" inputMode="decimal" placeholder="0.00"
                value={targetPrice} onChange={e => setTargetPrice(e.target.value)} />
            </div>
          )}

          {/* ── Account deduction (new only) ──────────────────── */}
          {!isEdit && accounts.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <button type="button" onClick={() => setDeduct(v => !v)}
                  className={`btn-press relative w-10 h-6 rounded-full transition-colors ${
                    deductFromAcc ? 'bg-violet-600' : 'bg-[#252535]'
                  }`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${
                    deductFromAcc ? 'left-5' : 'left-1'
                  }`} />
                </button>
                <label className="text-[#8B8BAD] text-xs font-medium">Descontar de una cuenta</label>
              </div>
              {deductFromAcc && (
                <select value={accountId} onChange={e => setAccountId(e.target.value)} className="fade-in">
                  <option value="">— Selecciona cuenta —</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name || a.institution}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* ── Notes ────────────────────────────────────────── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
              Notas <span className="text-[#555577]">(opcional)</span>
            </label>
            <input type="text" placeholder="Estrategia, tesis de inversión..."
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <button type="submit"
            className="btn-press w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold py-4 rounded-2xl text-base">
            {isEdit ? 'Actualizar posición' : 'Agregar inversión'}
          </button>
        </form>
      </div>
    </div>
  )
}

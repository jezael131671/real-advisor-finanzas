import { useState } from 'react'
import { X } from 'lucide-react'
import useFinanceStore from '../../store/useFinanceStore.js'
import { BAJOQUINTO_STATUSES, LEAD_SOURCES, PROSPECT_STATUSES } from '../../store/defaultData.js'
import { fmx, today } from '../../lib/formatters.js'
import toast from 'react-hot-toast'

// Statuses shown in the modal selector (new flow — no legacy)
const MODAL_STATUSES = BAJOQUINTO_STATUSES.filter(s => !['prospecto', 'liquidado'].includes(s.key))

export default function BajoquintoModal({ onClose, data }) {
  const { accounts, addBajoquinto, updateBajoquinto, recordBajoquintoPayment } = useFinanceStore()

  const isPayment = Boolean(data?._recordPayment)
  const isEdit    = Boolean(data?.id && !isPayment)

  // ── Payment mode state ────────────────────────────────────────────────────
  const [payAmount,  setPayAmount]  = useState('')
  const [payAccount, setPayAccount] = useState(accounts[0]?.id || '')
  const [payDate,    setPayDate]    = useState(today())
  const [payNote,    setPayNote]    = useState('')

  // ── Create / Edit state ───────────────────────────────────────────────────
  // Core
  const [client,    setClient]    = useState(data?.client    || '')
  const [city,      setCity]      = useState(data?.city      || '')
  const [whatsapp,  setWhatsapp]  = useState(data?.whatsapp  || '')
  const [instagram, setInstagram] = useState(data?.instagram || '')
  const [phone,     setPhone]     = useState(data?.phone     || '')
  const [leadSource,setLeadSource]= useState(data?.leadSource|| '')
  // Quote
  const [model,     setModel]     = useState(data?.model     || '')
  const [budget,    setBudget]    = useState(data?.budget     ? String(data.budget)    : '')
  const [salePrice, setSalePrice] = useState(data?.salePrice  ? String(data.salePrice) : '')
  const [cost,      setCost]      = useState(data?.cost       ? String(data.cost)      : '')
  const [deposit,   setDeposit]   = useState(data?.deposit    ? String(data.deposit)   : '')
  // Status & dates
  const [status,    setStatus]    = useState(data?.status    || 'nuevo')
  const [dueDate,   setDueDate]   = useState(data?.dueDate   || '')
  const [paymentCommitDate, setPaymentCommitDate] = useState(data?.paymentCommitDate || '')
  // Follow-up
  const [lastContact,  setLastContact]  = useState(data?.lastContact  || '')
  const [nextFollowUp, setNextFollowUp] = useState(data?.nextFollowUp || data?.followUpDate || '')
  const [followUpNote, setFollowUpNote] = useState(data?.followUpNote || '')
  // Notes
  const [notes, setNotes] = useState(data?.notes || '')
  // Production (behind toggle)
  const [showProd, setShowProd] = useState(false)
  const [provider,          setProvider]          = useState(data?.provider          || '')
  const [apartDate,         setApartDate]          = useState(data?.apartDate         || '')
  const [fabricationStart,  setFabricationStart]   = useState(data?.fabricationStart  || '')
  const [estimatedDelivery, setEstimatedDelivery]  = useState(data?.estimatedDelivery || '')
  const [shipDate,          setShipDate]           = useState(data?.shipDate          || '')
  const [trackingNumber,    setTrackingNumber]     = useState(data?.trackingNumber    || '')

  const salePriceN = Number(salePrice) || 0
  const costN      = Number(cost)      || 0
  const profit     = salePriceN - costN
  const margin     = salePriceN > 0 ? (profit / salePriceN) * 100 : 0
  const isProspect = PROSPECT_STATUSES.includes(status)

  // ── PAYMENT MODE ──────────────────────────────────────────────────────────
  if (isPayment) {
    const paidSoFar = Number(data.deposit || 0) +
      (data.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
    const pending = Math.max(0, Number(data.salePrice || 0) - paidSoFar)

    const handlePay = (e) => {
      e.preventDefault()
      if (!payAmount || Number(payAmount) <= 0) { toast.error('Ingresa el monto del abono'); return }
      if (accounts.length > 0 && !payAccount)   { toast.error('Selecciona la cuenta de destino'); return }
      recordBajoquintoPayment(data.id, payAccount || null, Number(payAmount), payDate, payNote)
      toast.success(`💰 Abono registrado: ${fmx(Number(payAmount))}`)
      onClose()
    }

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center fade-in">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-lg bg-[#0E0E1A] rounded-t-3xl slide-up border-t border-white/5"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}>
          <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mt-3 mb-1" />
          <div className="px-5 pb-2 pt-3 flex justify-between items-center">
            <div>
              <h2 className="text-white text-lg font-bold">Registrar abono</h2>
              <p className="text-xs" style={{ color: 'var(--t3)' }}>{data.client} — {data.model}</p>
            </div>
            <button onClick={onClose}
              className="btn-press w-8 h-8 rounded-full bg-[#151525] flex items-center justify-center">
              <X size={16} className="text-[#8B8BAD]" />
            </button>
          </div>

          <div className="mx-5 mb-4 p-4 rounded-2xl"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="flex justify-between">
              <div>
                <p className="text-xs" style={{ color: 'var(--t3)' }}>Cobrado</p>
                <p className="text-white font-bold">{fmx(paidSoFar)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--t3)' }}>Pendiente</p>
                <p className="text-amber-400 font-bold">{fmx(pending)}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handlePay} className="px-5 pb-4 space-y-4">
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Monto del abono (MXN)</label>
              <input type="number" inputMode="decimal" placeholder="0.00"
                value={payAmount} onChange={e => setPayAmount(e.target.value)}
                className="text-2xl font-bold" required />
            </div>
            {accounts.length > 0 && (
              <div>
                <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Cuenta de destino</label>
                <select value={payAccount} onChange={e => setPayAccount(e.target.value)} required>
                  <option value="">— Selecciona cuenta —</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name || a.institution}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Fecha</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
                Nota <span className="text-[#555577]">(opcional)</span>
              </label>
              <input type="text" placeholder="SPEI, efectivo, transferencia..."
                value={payNote} onChange={e => setPayNote(e.target.value)} />
            </div>
            <button type="submit"
              className="btn-press w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold py-4 rounded-2xl text-base">
              Registrar abono
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── CREATE / EDIT MODE ────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!client.trim()) { toast.error('Ingresa el nombre del cliente'); return }
    if (!model.trim())  { toast.error('Ingresa el modelo o descripción'); return }

    const payload = {
      client:            client.trim(),
      city:              city.trim()      || null,
      whatsapp:          whatsapp.trim()  || null,
      instagram:         instagram.trim() || null,
      phone:             phone.trim()     || null,
      leadSource:        leadSource       || null,
      model:             model.trim(),
      budget:            Number(budget)   || null,
      salePrice:         salePriceN       || null,
      cost:              costN            || null,
      profit:            salePriceN > 0 ? profit : null,
      deposit:           Number(deposit)  || 0,
      status,
      dueDate:           dueDate          || null,
      paymentCommitDate: paymentCommitDate|| null,
      lastContact:       lastContact      || null,
      nextFollowUp:      nextFollowUp     || null,
      followUpNote:      followUpNote.trim()|| null,
      notes:             notes.trim()     || null,
      // Production
      provider:          provider.trim()  || null,
      apartDate:         apartDate        || null,
      fabricationStart:  fabricationStart || null,
      estimatedDelivery: estimatedDelivery|| null,
      shipDate:          shipDate         || null,
      trackingNumber:    trackingNumber.trim() || null,
    }

    if (isEdit) {
      updateBajoquinto(data.id, payload)
      toast.success('Registro actualizado')
    } else {
      addBajoquinto(payload)
      toast.success('Cliente registrado 🎸')
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
            {isEdit ? 'Editar cliente' : 'Nuevo prospecto 🎸'}
          </h2>
          <button onClick={onClose}
            className="btn-press w-8 h-8 rounded-full bg-[#151525] flex items-center justify-center">
            <X size={16} className="text-[#8B8BAD]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-4 space-y-4 overflow-y-auto max-h-[84vh]">

          {/* ── Sección: Cliente ── */}
          <p className="text-[#8B8BAD] text-[10px] font-bold uppercase tracking-wider">Cliente</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Nombre *</label>
              <input type="text" placeholder="Nombre completo"
                value={client} onChange={e => setClient(e.target.value)} required />
            </div>
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Ciudad</label>
              <input type="text" placeholder="Monterrey, CDMX…"
                value={city} onChange={e => setCity(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">💬 WhatsApp</label>
              <input type="tel" placeholder="55 1234 5678"
                value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
            </div>
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">📸 Instagram</label>
              <input type="text" placeholder="@usuario"
                value={instagram} onChange={e => setInstagram(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Origen del lead</label>
            <select value={leadSource} onChange={e => setLeadSource(e.target.value)}>
              <option value="">— ¿Cómo nos encontró? —</option>
              {LEAD_SOURCES.map(l => (
                <option key={l.key} value={l.key}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* ── Sección: Cotización ── */}
          <p className="text-[#8B8BAD] text-[10px] font-bold uppercase tracking-wider pt-1">Cotización</p>

          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Modelo / descripción *</label>
            <input type="text" placeholder="Bajoquinto 5 cuerdas natural…"
              value={model} onChange={e => setModel(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Presupuesto cliente</label>
              <input type="number" inputMode="decimal" placeholder="0"
                value={budget} onChange={e => setBudget(e.target.value)} />
            </div>
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Precio venta (MXN)</label>
              <input type="number" inputMode="decimal" placeholder="0"
                value={salePrice} onChange={e => setSalePrice(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Costo / inversión</label>
              <input type="number" inputMode="decimal" placeholder="0"
                value={cost} onChange={e => setCost(e.target.value)} />
            </div>
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Anticipo recibido</label>
              <input type="number" inputMode="decimal" placeholder="0"
                value={deposit} onChange={e => setDeposit(e.target.value)} />
            </div>
          </div>

          {/* Utilidad inline preview */}
          {salePriceN > 0 && costN > 0 && (
            <div className="grid grid-cols-2 gap-3 fade-in">
              <div className="p-3 rounded-xl"
                style={{ background: profit >= 0 ? 'rgba(34,197,94,0.06)' : 'rgba(225,29,72,0.06)',
                         border:     profit >= 0 ? '1px solid rgba(34,197,94,0.15)' : '1px solid rgba(225,29,72,0.15)' }}>
                <p className="text-[10px]" style={{ color: 'var(--t3)' }}>Utilidad</p>
                <p className={`text-base font-black ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmx(profit)}
                </p>
              </div>
              <div className="p-3 rounded-xl"
                style={{ background: margin >= 30 ? 'rgba(34,197,94,0.06)' : 'rgba(217,119,6,0.06)',
                         border:     margin >= 30 ? '1px solid rgba(34,197,94,0.15)' : '1px solid rgba(217,119,6,0.15)' }}>
                <p className="text-[10px]" style={{ color: 'var(--t3)' }}>Margen</p>
                <p className={`text-base font-black ${margin >= 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {margin.toFixed(1)}%
                </p>
              </div>
            </div>
          )}

          {/* ── Sección: Estado ── */}
          <p className="text-[#8B8BAD] text-[10px] font-bold uppercase tracking-wider pt-1">Estado</p>

          <div className="flex flex-wrap gap-2">
            {MODAL_STATUSES.map(s => (
              <button key={s.key} type="button" onClick={() => setStatus(s.key)}
                className={`btn-press px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  status === s.key
                    ? 'bg-violet-600 text-white border-violet-500'
                    : 'bg-[#151525] text-[#8B8BAD] border-white/5'
                }`}>
                {s.label}
              </button>
            ))}
          </div>

          {/* ── Sección: Seguimiento ── */}
          <p className="text-[#8B8BAD] text-[10px] font-bold uppercase tracking-wider pt-1">Seguimiento</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Último contacto</label>
              <input type="date" value={lastContact} onChange={e => setLastContact(e.target.value)} />
            </div>
            <div>
              <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Próximo seguimiento</label>
              <input type="date" value={nextFollowUp} onChange={e => setNextFollowUp(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
              Nota del seguimiento <span className="text-[#555577]">(opcional)</span>
            </label>
            <input type="text" placeholder="Interesado, esperando respuesta de esposo…"
              value={followUpNote} onChange={e => setFollowUpNote(e.target.value)} />
          </div>

          {/* ── Sección: Fechas ── */}
          {!isProspect && (
            <>
              <p className="text-[#8B8BAD] text-[10px] font-bold uppercase tracking-wider pt-1">Fechas</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Fecha de entrega</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Compromiso de pago</label>
                  <input type="date" value={paymentCommitDate} onChange={e => setPaymentCommitDate(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* ── Notas ── */}
          <div>
            <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">
              Notas <span className="text-[#555577]">(opcional)</span>
            </label>
            <input type="text" placeholder="Especificaciones, acabados, referencias…"
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* ── Toggle producción ── */}
          <button type="button" onClick={() => setShowProd(v => !v)}
            className="btn-press w-full py-2.5 rounded-xl text-xs font-semibold"
            style={{ background: 'rgba(99,102,241,0.08)', color: '#A78BFA', border: '1px solid rgba(99,102,241,0.2)' }}>
            {showProd ? '▲ Ocultar producción y envío' : '▼ Producción, proveedor y envío'}
          </button>

          {showProd && (
            <div className="space-y-4 fade-in">
              <div>
                <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Proveedor / Luthier</label>
                <input type="text" placeholder="Nombre del proveedor…"
                  value={provider} onChange={e => setProvider(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Fecha apartado</label>
                  <input type="date" value={apartDate} onChange={e => setApartDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Inicio fabricación</label>
                  <input type="date" value={fabricationStart} onChange={e => setFabricationStart(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Entrega estimada</label>
                  <input type="date" value={estimatedDelivery} onChange={e => setEstimatedDelivery(e.target.value)} />
                </div>
                <div>
                  <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Fecha envío</label>
                  <input type="date" value={shipDate} onChange={e => setShipDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Teléfono alterno</label>
                <input type="tel" placeholder="55 1234 5678"
                  value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div>
                <label className="text-[#8B8BAD] text-xs font-medium mb-1.5 block">Número de tracking</label>
                <input type="text" placeholder="FedEx / DHL / Estafeta…"
                  value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} />
              </div>
            </div>
          )}

          <button type="submit"
            className="btn-press w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold py-4 rounded-2xl text-base">
            {isEdit ? 'Guardar cambios' : 'Registrar prospecto'}
          </button>
        </form>
      </div>
    </div>
  )
}

import { useState, useMemo } from 'react'
import { X, MessageCircle, Copy, Check, Phone } from 'lucide-react'
import {
  WA_TEMPLATES,
  getSuggestedTemplates,
  getDefaultTemplate,
  openWhatsApp,
  cleanPhone,
} from '../../lib/whatsappTemplates.js'
import { today } from '../../lib/formatters.js'
import useFinanceStore from '../../store/useFinanceStore.js'
import toast from 'react-hot-toast'

// ── WhatsApp brand colors ─────────────────────────────────────────────────────
const WA_GREEN      = '#25D366'
const WA_DARK_GREEN = '#128C7E'
const WA_BG         = 'rgba(37,211,102,0.12)'
const WA_BORDER     = 'rgba(37,211,102,0.25)'

// ── Main modal ────────────────────────────────────────────────────────────────
export default function WhatsAppModal({ onClose, bq }) {
  const { updateBajoquinto } = useFinanceStore()

  // ── Contact info ──────────────────────────────────────────────────────────
  const phone       = bq.whatsapp || bq.phone || ''
  const cleanedPhone = cleanPhone(phone)
  const hasPhone     = Boolean(cleanedPhone)

  // ── Template selection ────────────────────────────────────────────────────
  const suggested   = useMemo(() => getSuggestedTemplates(bq.status), [bq.status])
  const defaultTpl  = useMemo(() => getDefaultTemplate(bq), [bq])
  const [activeKey, setActiveKey] = useState(defaultTpl.key)

  const activeTpl = WA_TEMPLATES.find(t => t.key === activeKey) || defaultTpl
  const [message, setMessage] = useState(() => defaultTpl.build(bq))

  // ── State ─────────────────────────────────────────────────────────────────
  const [markContacted, setMarkContacted] = useState(true)
  const [copied,        setCopied]        = useState(false)
  const [sending,       setSending]       = useState(false)

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectTemplate = (tpl) => {
    setActiveKey(tpl.key)
    setMessage(tpl.build(bq))
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      toast.success('📋 Mensaje copiado')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const handleSend = () => {
    if (!message.trim()) return
    setSending(true)

    // Update lastContact if toggle is on
    if (markContacted) {
      updateBajoquinto(bq.id, { lastContact: today() })
    }

    if (hasPhone) {
      openWhatsApp(phone, message)
      toast.success(`💬 WhatsApp abierto — ${bq.client}`)
    } else {
      // No phone → copy as fallback
      navigator.clipboard?.writeText(message)
        .then(() => toast.success('📋 Copiado — agrega el número de WA del cliente'))
        .catch(() => toast.error('Sin número de WhatsApp registrado'))
    }

    setSending(false)
    onClose()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-t-3xl slide-up"
        style={{
          background: '#0D0D1A',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: 'env(safe-area-inset-bottom, 20px)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
        }}>

        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1 shrink-0"
          style={{ background: 'rgba(255,255,255,0.12)' }} />

        {/* ── Header ── */}
        <div className="px-5 pt-3 pb-3 flex items-center gap-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>

          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: WA_BG, border: `1px solid ${WA_BORDER}` }}>
            <MessageCircle size={18} style={{ color: WA_GREEN }} />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-white text-[15px] font-bold leading-tight truncate">
              {bq.client}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Phone size={10} style={{ color: hasPhone ? WA_GREEN : '#555577' }} />
              <p className="text-[11px] truncate font-medium"
                style={{ color: hasPhone ? WA_GREEN : '#555577' }}>
                {phone || 'Sin número registrado'}
              </p>
            </div>
          </div>

          <button onClick={onClose}
            className="btn-press w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <X size={15} style={{ color: '#8B8BAD' }} />
          </button>
        </div>

        {/* ── Scrollable content ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* ── Template chips (scrollable row) ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5"
              style={{ color: '#555577' }}>
              Plantilla
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
              {WA_TEMPLATES.map(tpl => {
                const isActive    = activeKey === tpl.key
                const isSuggested = suggested.some(s => s.key === tpl.key)
                return (
                  <button key={tpl.key}
                    onClick={() => handleSelectTemplate(tpl)}
                    className="btn-press shrink-0 flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl snap-start"
                    style={{
                      minWidth: 72,
                      background:   isActive ? WA_BG : 'rgba(255,255,255,0.04)',
                      border:       `1px solid ${isActive ? WA_BORDER : 'rgba(255,255,255,0.07)'}`,
                      transition:   'all 0.15s',
                    }}>
                    <span className="text-xl leading-none">{tpl.emoji}</span>
                    <span className="text-[9px] font-bold leading-tight text-center"
                      style={{ color: isActive ? WA_GREEN : '#8B8BAD', maxWidth: 64 }}>
                      {tpl.label}
                    </span>
                    {isSuggested && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-tight"
                        style={{ background: 'rgba(37,211,102,0.15)', color: WA_GREEN }}>
                        ✦ sugerida
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Template description ── */}
          {activeTpl && (
            <div className="rounded-xl px-3 py-2"
              style={{ background: 'rgba(37,211,102,0.05)', border: `1px solid ${WA_BORDER}` }}>
              <p className="text-[11px] font-medium" style={{ color: '#6ECF7D' }}>
                {activeTpl.emoji}&nbsp; {activeTpl.description}
              </p>
            </div>
          )}

          {/* ── Message editor ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#555577' }}>
                Mensaje
              </p>
              <button onClick={handleCopy}
                className="btn-press flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold"
                style={{
                  background: copied ? 'rgba(37,211,102,0.12)' : 'rgba(255,255,255,0.06)',
                  color:      copied ? WA_GREEN : '#8B8BAD',
                  border:     `1px solid ${copied ? WA_BORDER : 'rgba(255,255,255,0.07)'}`,
                  transition: 'all 0.2s',
                }}>
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <textarea
              rows={9}
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full rounded-2xl px-4 py-3 text-sm resize-none"
              style={{
                background:   'rgba(255,255,255,0.03)',
                border:       '1px solid rgba(255,255,255,0.07)',
                color:        '#E0E0F0',
                lineHeight:   '1.65',
                fontFamily:   'inherit',
                outline:      'none',
              }}
              placeholder="Escribe o edita el mensaje..."
            />
            <p className="text-[10px] mt-1 text-right" style={{ color: '#444466' }}>
              *negrita*, _cursiva_ — formato WhatsApp
            </p>
          </div>

          {/* ── Mark as contacted toggle ── */}
          <button
            onClick={() => setMarkContacted(v => !v)}
            className="btn-press w-full flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
              background: markContacted ? 'rgba(37,211,102,0.08)' : 'rgba(255,255,255,0.04)',
              border:     `1px solid ${markContacted ? WA_BORDER : 'rgba(255,255,255,0.07)'}`,
            }}>
            {/* Toggle switch */}
            <div className="relative w-10 h-6 rounded-full shrink-0 transition-all duration-200"
              style={{ background: markContacted ? WA_GREEN : 'rgba(255,255,255,0.12)' }}>
              <div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
                style={{ left: markContacted ? 22 : 4 }} />
            </div>
            <span className="text-[12px] font-semibold text-left"
              style={{ color: markContacted ? '#B0E8BE' : '#8B8BAD' }}>
              Registrar contacto hoy ({new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })})
            </span>
          </button>

          {/* ── CTA buttons ── */}
          <div className="space-y-2">
            {hasPhone ? (
              <button
                onClick={handleSend}
                disabled={sending || !message.trim()}
                className="btn-press w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-bold"
                style={{
                  background: `linear-gradient(135deg, ${WA_GREEN}, ${WA_DARK_GREEN})`,
                  color: '#fff',
                  opacity: (!message.trim() || sending) ? 0.6 : 1,
                }}>
                <MessageCircle size={18} />
                {sending ? 'Abriendo…' : 'Abrir WhatsApp'}
              </button>
            ) : (
              <>
                <button
                  onClick={() => { handleCopy(); if (markContacted) updateBajoquinto(bq.id, { lastContact: today() }); onClose() }}
                  disabled={!message.trim()}
                  className="btn-press w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-bold"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: '#E0E0F0',
                    border: '1px solid rgba(255,255,255,0.10)',
                    opacity: !message.trim() ? 0.6 : 1,
                  }}>
                  <Copy size={18} />
                  Copiar mensaje
                </button>
                <p className="text-center text-[11px]" style={{ color: '#555577' }}>
                  Agrega el número de WhatsApp del cliente para abrir directamente
                </p>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

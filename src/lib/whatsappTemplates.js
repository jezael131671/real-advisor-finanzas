import { fmx } from './formatters.js'

const num = (n) => Number(n) || 0

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Saldo pendiente de cobrar */
export function pendingBalance(bq) {
  const paid = num(bq.deposit) + (bq.payments || []).reduce((s, p) => s + num(p.amount), 0)
  return Math.max(0, num(bq.salePrice) - paid)
}

/** Primer nombre del cliente */
function firstName(fullName) {
  if (!fullName) return 'amigo/a'
  return fullName.trim().split(/\s+/)[0]
}

/**
 * Normaliza un número de teléfono a formato internacional para wa.me
 * Asume México (+52) si son 10 dígitos
 */
export function cleanPhone(raw) {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return '52' + digits                        // 55 1234 5678 → 5255…
  if (digits.length === 12 && digits.startsWith('52')) return digits    // ya tiene +52
  if (digits.length === 13 && digits.startsWith('521')) return digits   // +521…
  if (digits.length >= 10) return digits                                 // otro país, usar as-is
  return null
}

/**
 * Abre WhatsApp en nueva pestaña.
 * Devuelve true si había número, false si no.
 */
export function openWhatsApp(phone, text) {
  const cleaned = cleanPhone(phone)
  if (!cleaned) return false
  const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

// ── Definición de plantillas ──────────────────────────────────────────────────

export const WA_TEMPLATES = [
  // ── 1 · Seguimiento prospecto nuevo ──────────────────────────────────────
  {
    key:         'prospecto_nuevo',
    label:       'Prospecto nuevo',
    emoji:       '👋',
    description: 'Primer contacto después de que mostró interés',
    suggestedFor: ['nuevo', 'contactado', 'prospecto'],
    build: (bq) => {
      const nombre = firstName(bq.client)
      const modelo = bq.model || 'nuestros bajoquintos'
      return `¡Hola ${nombre}! 👋

Te escribe *Los Primos Bajoquintos*. Vi que te interesó *${modelo}* y quería presentarme personalmente.

Hacemos bajoquintos artesanales de alta calidad — cada instrumento es único y se fabrica a tu medida 🎸

¿Tienes alguna pregunta sobre especificaciones, acabados o precio? Con gusto te ayudo a encontrar el instrumento perfecto.

¡Quedamos al pendiente! 🙌`
    },
  },

  // ── 2 · Seguimiento después de visto ─────────────────────────────────────
  {
    key:         'despues_de_visto',
    label:       'Después de visto',
    emoji:       '👀',
    description: 'Cuando vio la cotización y no respondió',
    suggestedFor: ['cotizado', 'seguimiento'],
    build: (bq) => {
      const nombre = firstName(bq.client)
      const modelo = bq.model || 'el instrumento'
      const precioParte = bq.salePrice ? ` por *${fmx(bq.salePrice)}*` : ''
      return `¡Hola ${nombre}! 😊

Por aquí *Los Primos Bajoquintos*. La semana pasada te compartí la cotización del *${modelo}*${precioParte}. ¿Pudiste revisarla?

Si tienes dudas sobre el acabado, las cuerdas o quieres ajustar algo del diseño, con gusto lo platicamos 🎸

¿Cómo lo ves?`
    },
  },

  // ── 3 · Solicitud de anticipo ─────────────────────────────────────────────
  {
    key:         'solicitud_anticipo',
    label:       'Solicitar anticipo',
    emoji:       '💰',
    description: 'Pedir anticipo para apartar y arrancar producción',
    suggestedFor: ['cotizado', 'apartado', 'nuevo'],
    build: (bq) => {
      const nombre = firstName(bq.client)
      const modelo = bq.model || 'tu bajoquinto'
      const depositoN = num(bq.deposit)
      const precioN   = num(bq.salePrice)
      const montoAnticipo = depositoN > 0
        ? `*${fmx(depositoN)}*`
        : precioN > 0
          ? `*${fmx(precioN * 0.5)}* (50% del total)`
          : 'el anticipo acordado'
      return `¡Hola ${nombre}! 🎸

Todo listo para arrancar con tu *${modelo}*. Para apartar el instrumento y comenzar la fabricación necesitamos el anticipo de ${montoAnticipo}.

¿Cómo te queda esta semana para hacer el depósito? Puedes transferir a nuestros datos de pago y nos mandas el comprobante 📲

Nos confirmas y arrancamos de inmediato 💪 ¡Gracias por confiar en nosotros!`
    },
  },

  // ── 4 · Solicitud de liquidación ─────────────────────────────────────────
  {
    key:         'solicitud_liquidacion',
    label:       'Solicitar liquidación',
    emoji:       '🎉',
    description: 'Pedir saldo final cuando el pedido está terminado',
    suggestedFor: ['terminado', 'enviado'],
    build: (bq) => {
      const nombre  = firstName(bq.client)
      const modelo  = bq.model || 'tu instrumento'
      const pending = pendingBalance(bq)
      const monto   = pending > 0 ? `*${fmx(pending)}*` : 'el saldo restante'
      return `¡Hola ${nombre}! 🎉

¡Excelentes noticias! Tu *${modelo}* ya está listo y quedó espectacular ✨🎸

Para proceder con la entrega necesitamos el saldo de ${monto}. ¿Cuándo puedes hacer el depósito?

Una vez confirmado el pago coordinamos la entrega o el envío de inmediato 📦

¡Ya merito lo tienes! 🔥`
    },
  },

  // ── 5 · Cobro pendiente ───────────────────────────────────────────────────
  {
    key:         'cobro_pendiente',
    label:       'Cobro pendiente',
    emoji:       '📋',
    description: 'Recordatorio amistoso de saldo pendiente',
    suggestedFor: ['apartado', 'en_fabricacion', 'terminado', 'enviado', 'entregado'],
    build: (bq) => {
      const nombre  = firstName(bq.client)
      const modelo  = bq.model || 'tu instrumento'
      const pending = pendingBalance(bq)
      const monto   = pending > 0 ? `*${fmx(pending)}*` : 'el saldo pendiente'
      return `Hola ${nombre} 👋

Te escribe *Los Primos Bajoquintos*. Tenemos pendiente un saldo de ${monto} correspondiente a tu *${modelo}*.

¿Cómo vamos con el pago? Si necesitas hacer un abono parcial o ajustar las fechas, con toda confianza nos dices y lo coordinamos 🙏

¡Quedamos atentos!`
    },
  },

  // ── 6 · Solicitud de testimonio ───────────────────────────────────────────
  {
    key:         'solicitud_testimonio',
    label:       'Pedir testimonio',
    emoji:       '⭐',
    description: 'Solicitar reseña o foto/video después de la entrega',
    suggestedFor: ['entregado', 'liquidado'],
    build: (bq) => {
      const nombre = firstName(bq.client)
      const modelo = bq.model || 'tu bajoquinto'
      return `¡Hola ${nombre}! 😊

Esperamos que estés disfrutando muchísimo tu *${modelo}* 🎸

Nos encantaría saber cómo te ha parecido — si estás contento/a, ¿nos podrías compartir alguna de estas cosas?

⭐ Tu opinión sobre la calidad y el servicio
🎥 Una foto o video tocando el instrumento
💬 Un breve testimonio que podamos usar en redes

Tu apoyo nos ayuda enormemente a llegar a más músicos como tú. ¡Muchas gracias por confiar en *Los Primos Bajoquintos*! 🙌`
    },
  },

  // ── 7 · Seguimiento postventa ─────────────────────────────────────────────
  {
    key:         'postventa',
    label:       'Postventa',
    emoji:       '🎸',
    description: 'Revisión de satisfacción semanas después de la venta',
    suggestedFor: ['entregado', 'liquidado'],
    build: (bq) => {
      const nombre = firstName(bq.client)
      const modelo = bq.model || 'tu instrumento'
      return `¡Hola ${nombre}! 👋

Por aquí *Los Primos Bajoquintos*. ¿Cómo va todo con tu *${modelo}*? ¿Le has sacado buen provecho? 🎶

Si tienes algún detalle, pregunta o comentario sobre el instrumento, con toda confianza nos dices y lo resolvemos sin problema 🛠️

Y si conoces a alguien más interesado en un bajoquinto de calidad, ¡con gusto lo atendemos! Tenemos referidos especiales para clientes como tú 😊🎸`
    },
  },
]

/**
 * Retorna las plantillas sugeridas para un status dado.
 * Si no hay coincidencia exacta, devuelve todas.
 */
export function getSuggestedTemplates(status) {
  const matched = WA_TEMPLATES.filter(t => t.suggestedFor.includes(status))
  return matched.length > 0 ? matched : WA_TEMPLATES
}

/**
 * Retorna la plantilla más apropiada para un cliente (la primera sugerida).
 */
export function getDefaultTemplate(bq) {
  const suggested = getSuggestedTemplates(bq.status)
  // Si tiene saldo pendiente y no es prospecto, priorizar cobro
  const pending = pendingBalance(bq)
  const closedStatuses = ['entregado', 'liquidado', 'perdido']
  if (pending > 0 && closedStatuses.includes(bq.status)) {
    const cobro = WA_TEMPLATES.find(t => t.key === 'cobro_pendiente')
    if (cobro) return cobro
  }
  return suggested[0] || WA_TEMPLATES[0]
}

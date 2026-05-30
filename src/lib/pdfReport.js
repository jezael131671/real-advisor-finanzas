/**
 * pdfReport.js
 * Genera un reporte ejecutivo en HTML listo para imprimir / guardar como PDF.
 * Zero dependencias externas — usa la API nativa de impresión del navegador.
 */
import { fmx, fmtMonth } from './formatters.js'
import { format }        from 'date-fns'
import { es }            from 'date-fns/locale'

const num = (n) => Number(n) || 0

// ── Utils ─────────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function statRow(label, value, color, sub) {
  return `
    <div class="stat-row">
      <span class="stat-label">${esc(label)}</span>
      <div style="text-align:right">
        <span class="stat-value"${color ? ` style="color:${esc(color)}"` : ''}>${esc(value)}</span>
        ${sub ? `<p class="stat-sub">${esc(sub)}</p>` : ''}
      </div>
    </div>`
}

function pctBar(pct, color) {
  const w = Math.min(100, Math.max(0, pct))
  return `<div style="height:5px;background:#e5e7eb;border-radius:3px;overflow:hidden;margin:3px 0 2px">
    <div style="height:5px;width:${w}%;background:${esc(color)};border-radius:3px;transition:width 0s"></div>
  </div>`
}

function recStyle(priority) {
  if (priority === 'critico')    return { bg: '#fef2f2', border: '#fca5a5', dot: '#dc2626', label: 'CRÍTICO'    }
  if (priority === 'importante') return { bg: '#fff7ed', border: '#fed7aa', dot: '#ea580c', label: 'IMPORTANTE' }
  return                                { bg: '#f5f3ff', border: '#c4b5fd', dot: '#7c3aed', label: 'SUGERIDO'   }
}

// ── Section builders ──────────────────────────────────────────────────────────

function buildCardsSection(cards, stats) {
  const today    = new Date()
  const todayDay = today.getDate()

  const rows = cards.length > 0
    ? cards.map(c => {
        const bal  = num(c.balance)
        const lim  = num(c.limit)
        const util = lim > 0 ? ((bal / lim) * 100) : -1
        const utilStr   = util >= 0 ? util.toFixed(0) + '%' : '—'
        const utilColor = util < 0 ? '#6b7280' : util > 50 ? '#dc2626' : util > 30 ? '#ea580c' : '#16a34a'

        const due = num(c.dueDay)
        let daysLabel = '—'
        if (due > 0) {
          const dueDate = due > todayDay
            ? new Date(today.getFullYear(), today.getMonth(), due)
            : new Date(today.getFullYear(), today.getMonth() + 1, due)
          const days = Math.ceil((dueDate - today) / 86_400_000)
          daysLabel = days <= 0 ? '¡Hoy!' : days === 1 ? 'Mañana' : `${days} días`
        }

        return `<tr>
          <td>${esc(c.bankName || c.cardName || c.alias || '—')}</td>
          <td style="text-align:right;color:#dc2626;font-weight:700">${esc(fmx(bal))}</td>
          <td style="text-align:right">${lim > 0 ? esc(fmx(lim)) : '—'}</td>
          <td style="text-align:right;color:${esc(utilColor)};font-weight:700">${esc(utilStr)}</td>
          <td style="text-align:right">${esc(daysLabel)}</td>
        </tr>`
      }).join('')
    : `<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:14px">Sin tarjetas registradas</td></tr>`

  const footer = cards.length > 0
    ? `<div style="display:flex;justify-content:space-between;padding:8px 0 0;margin-top:6px;border-top:1px solid #f3f4f6">
        <span style="font-size:10px;color:#6b7280;font-weight:500">Deuda total tarjetas</span>
        <span style="font-size:14px;font-weight:800;color:#dc2626">${esc(fmx(stats.totalCardDebt))}</span>
       </div>`
    : ''

  return `<div class="section">
    <div class="section-title">
      💳 Tarjetas de Crédito
      <span class="badge" style="background:#fce7f3;color:#db2777">
        ${cards.length} tarjeta${cards.length !== 1 ? 's' : ''}
      </span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Tarjeta</th>
          <th style="text-align:right">Saldo</th>
          <th style="text-align:right">Límite</th>
          <th style="text-align:right">Utiliz.</th>
          <th style="text-align:right">Pago en</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${footer}
  </div>`
}

function buildMetasSection(metaList) {
  const items = metaList.length > 0
    ? metaList.slice(0, 8).map(m => {
        const pct  = Math.min(100, m.pct)
        const clr  = m.isDone ? '#16a34a' : pct >= 60 ? '#6366f1' : pct >= 30 ? '#f59e0b' : '#ef4444'
        const eta  = m.estimatedDate
          ? (m.estimatedDate instanceof Date
              ? m.estimatedDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
              : m.estimatedDate)
          : ''
        const remainStr = m.unit === 'ventas'
          ? `${m.remaining} ventas`
          : esc(fmx(m.remaining))

        return `<div style="margin-bottom:11px;padding-bottom:11px;border-bottom:1px solid #f3f4f6">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
            <span style="font-size:13px;font-weight:600;color:#111827">${esc(m.emoji || '🎯')} ${esc(m.name)}</span>
            <span style="font-size:12px;font-weight:800;color:${esc(clr)}">${m.isDone ? '✓ Completada' : pct.toFixed(0) + '%'}</span>
          </div>
          ${pctBar(pct, clr)}
          <p style="font-size:10px;color:#9ca3af;margin-top:2px">
            ${m.isDone
              ? `${esc(fmx(m.target))} — meta alcanzada`
              : `${esc(fmx(m.current))} de ${esc(fmx(m.target))} · Faltan ${remainStr}${eta ? ' · ETA ' + eta : ''}`
            }
          </p>
        </div>`
      }).join('')
    : '<p style="color:#9ca3af;font-size:13px;padding:8px 0">Sin metas registradas</p>'

  const done  = metaList.filter(m => m.isDone).length
  return `<div class="section">
    <div class="section-title">
      🎯 Metas Financieras
      <span class="badge" style="background:#f3e8ff;color:#7c3aed">${done}/${metaList.length} completadas</span>
    </div>
    ${items}
  </div>`
}

function buildCrmSection(bajoquintos, stats, bqMetrics) {
  const pending = bajoquintos
    .map(b => {
      const paid = num(b.deposit) + (b.payments || []).reduce((s, p) => s + num(p.amount), 0)
      return { ...b, pendingAmt: Math.max(0, num(b.salePrice) - paid) }
    })
    .filter(b => b.pendingAmt > 0)
    .sort((a, b) => b.pendingAmt - a.pendingAmt)
    .slice(0, 5)

  const topRows = pending.length > 0
    ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #f3f4f6">
        <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;margin-bottom:6px">Top pendientes por cobrar</p>
        ${pending.map(b => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #f9fafb">
            <div>
              <span style="font-size:11px;color:#374151;font-weight:600">${esc(b.client || '—')}</span>
              ${b.model ? `<span style="font-size:9px;color:#9ca3af;margin-left:4px">${esc(b.model)}</span>` : ''}
            </div>
            <span style="font-size:12px;font-weight:700;color:#d97706">${esc(fmx(b.pendingAmt))}</span>
          </div>`).join('')}
      </div>`
    : ''

  return `<div class="section">
    <div class="section-title">
      🎸 Los Primos Bajoquintos
      <span class="badge" style="background:#fef3c7;color:#d97706">${bajoquintos.length} pedidos</span>
    </div>
    ${statRow('Ventas totales',       fmx(stats.bqStats.totalSales))}
    ${statRow('Utilidad estimada',    fmx(bqMetrics.totalUtility),   bqMetrics.totalUtility >= 0 ? '#16a34a' : '#dc2626')}
    ${statRow('Cobrado',              fmx(stats.bqStats.totalCollected), '#16a34a')}
    ${statRow('Pendiente por cobrar', fmx(stats.bqStats.totalPending), stats.bqStats.totalPending > 0 ? '#d97706' : '#111827',
        stats.bqStats.pendingCount > 0 ? `${stats.bqStats.pendingCount} cliente${stats.bqStats.pendingCount !== 1 ? 's' : ''}` : '')}
    ${statRow('Clientes activos',     String(bqMetrics.activeCount))}
    ${statRow('Seguims. vencidos',    String(bqMetrics.overdueFollowupsCount),
        bqMetrics.overdueFollowupsCount > 0 ? '#dc2626' : '#16a34a')}
    ${topRows}
  </div>`
}

function buildInvSection(invMetrics) {
  if (!invMetrics) {
    return `<div class="section">
      <div class="section-title">📈 Inversiones <span class="badge" style="background:#dbeafe;color:#2563eb">Sin posiciones</span></div>
      <p style="color:#9ca3af;font-size:13px;text-align:center;padding:16px 0">Sin posiciones abiertas</p>
    </div>`
  }

  return `<div class="section">
    <div class="section-title">
      📈 Inversiones
      <span class="badge" style="background:#dbeafe;color:#2563eb">${esc(fmx(invMetrics.totalVal))}</span>
    </div>
    ${statRow('Valor del portafolio', fmx(invMetrics.totalVal))}
    ${statRow('Capital invertido',   fmx(invMetrics.totalCost))}
    ${statRow('P&L total',
      (invMetrics.totalGain >= 0 ? '+' : '') + fmx(invMetrics.totalGain),
      invMetrics.totalGain >= 0 ? '#16a34a' : '#dc2626',
      (invMetrics.totalReturn >= 0 ? '+' : '') + invMetrics.totalReturn.toFixed(1) + '% retorno')}
    ${statRow('Posiciones abiertas', String(invMetrics.count))}
    ${invMetrics.best
      ? statRow('Mejor posición', esc(invMetrics.best.ticker), '#16a34a',
          (invMetrics.best.pct >= 0 ? '+' : '') + invMetrics.best.pct.toFixed(1) + '%')
      : ''}
    ${invMetrics.worst && invMetrics.worst.id !== invMetrics.best?.id
      ? statRow('Peor posición', esc(invMetrics.worst.ticker),
          invMetrics.worst.pct < 0 ? '#dc2626' : '#16a34a',
          (invMetrics.worst.pct >= 0 ? '+' : '') + invMetrics.worst.pct.toFixed(1) + '%')
      : ''}
  </div>`
}

function buildPlannerSection(plannerData, criticalCount) {
  const priorities = (plannerData?.priorities || [])
    .filter(p => p.priority === 'critico' || p.priority === 'importante')
    .slice(0, 5)

  const items = priorities.length > 0
    ? priorities.map(p => {
        const st = recStyle(p.priority)
        return `<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid #f3f4f6">
          <span style="font-size:16px;line-height:1;margin-top:1px">${p.icon}</span>
          <div style="flex:1;min-width:0">
            <p style="font-size:12px;font-weight:600;color:#111827;margin:0">${esc(p.title)}</p>
            <p style="font-size:10px;color:#6b7280;margin:2px 0 0">${esc(p.desc)}</p>
          </div>
          ${p.amount > 0
            ? `<span style="font-size:11px;font-weight:700;color:${esc(st.dot)};white-space:nowrap;margin-left:auto">${esc(fmx(p.amount))}</span>`
            : ''}
        </div>`
      }).join('')
    : '<p style="color:#16a34a;font-size:12px;padding:4px 0">✅ Sin acciones urgentes</p>'

  const weekPay = (plannerData?.weekPayments || []).length
  const weekCol = (plannerData?.weekCollections || []).length
  const total   = (plannerData?.priorities || []).length

  return `<div class="section">
    <div class="section-title">
      ⚡ Acciones Clave
      <span class="badge" style="background:${criticalCount > 0 ? '#fee2e2' : '#e0e7ff'};color:${criticalCount > 0 ? '#dc2626' : '#4f46e5'}">
        ${total} pendiente${total !== 1 ? 's' : ''}
      </span>
    </div>
    ${items}
    ${weekPay > 0
      ? `<div class="stat-row" style="margin-top:8px">
          <span class="stat-label">Pagos tarjetas (próx. 7d)</span>
          <span class="stat-value" style="color:#dc2626">${weekPay} tarjeta${weekPay !== 1 ? 's' : ''}</span>
         </div>`
      : ''}
    ${weekCol > 0
      ? `<div class="stat-row">
          <span class="stat-label">Cobros próximos</span>
          <span class="stat-value" style="color:#d97706">${weekCol} cliente${weekCol !== 1 ? 's' : ''}</span>
         </div>`
      : ''}
  </div>`
}

function buildRecsSection(recs) {
  const items = recs.length > 0
    ? recs.map(r => {
        const st = recStyle(r.priority)
        return `<div style="background:${esc(st.bg)};border:1px solid ${esc(st.border)};border-radius:10px;padding:10px 12px;margin-bottom:8px">
          <div style="display:flex;align-items:flex-start;gap:10px">
            <span style="font-size:20px;line-height:1;margin-top:1px">${r.icon}</span>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;flex-wrap:wrap">
                <span style="font-size:12px;font-weight:700;color:#111827">${esc(r.title)}</span>
                <span style="font-size:9px;font-weight:700;color:${esc(st.dot)};background:${esc(st.dot)}22;padding:2px 7px;border-radius:99px">${esc(st.label)}</span>
              </div>
              <p style="font-size:11px;color:#6b7280;margin:0;line-height:1.5">${esc(r.desc)}</p>
            </div>
          </div>
        </div>`
      }).join('')
    : `<div style="text-align:center;padding:20px;color:#16a34a">
        <div style="font-size:32px;margin-bottom:8px">🎉</div>
        <p style="font-size:14px;font-weight:700;color:#111827">¡Finanzas en orden!</p>
        <p style="font-size:12px;color:#6b7280;margin-top:4px">No hay acciones urgentes este mes. ¡Sigue así!</p>
      </div>`

  return `<div class="section">
    <div class="section-title">
      🧠 Recomendaciones Automáticas
      <span class="badge" style="background:#f3e8ff;color:#7c3aed">${recs.length} acción${recs.length !== 1 ? 'es' : ''}</span>
    </div>
    ${items}
  </div>`
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: #f3f4f6; color: #111827; font-size: 13px; line-height: 1.5;
  }
  .page { max-width: 820px; margin: 0 auto; padding: 20px; }

  /* Action bar — screen only */
  .action-bar {
    display: flex; gap: 10px; margin-bottom: 20px;
  }
  .btn {
    flex: 1; padding: 13px 18px; border-radius: 10px; font-size: 14px;
    font-weight: 700; cursor: pointer; border: none; text-align: center;
    transition: opacity 0.15s;
  }
  .btn:hover { opacity: 0.88; }
  .btn-primary { background: #4f46e5; color: white; }
  .btn-secondary { background: #ffffff; color: #374151; border: 1px solid #d1d5db; }

  /* Header */
  .report-header {
    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
    color: white; border-radius: 16px; padding: 22px 26px; margin-bottom: 14px;
  }
  .report-title { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
  .report-subtitle { font-size: 12px; opacity: 0.7; margin-top: 3px; }
  .risk-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(255,255,255,0.15); border-radius: 99px;
    padding: 4px 11px; font-size: 11px; font-weight: 700; margin-top: 9px;
  }

  /* Section card */
  .section {
    background: white; border: 1px solid #e5e7eb; border-radius: 14px;
    padding: 16px 18px; margin-bottom: 12px;
  }
  .section-title {
    font-size: 13px; font-weight: 800; color: #111827;
    margin-bottom: 12px; display: flex; align-items: center; gap: 6px;
  }
  .badge {
    font-size: 9px; font-weight: 700; padding: 3px 8px;
    border-radius: 99px; margin-left: auto;
  }

  /* Stat rows */
  .stat-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 7px 0; border-bottom: 1px solid #f3f4f6;
  }
  .stat-row:last-child { border-bottom: none; }
  .stat-label { font-size: 11px; color: #6b7280; font-weight: 500; }
  .stat-value { font-size: 13px; font-weight: 700; color: #111827; }
  .stat-sub { font-size: 9px; color: #9ca3af; margin-top: 1px; }

  /* Net worth hero */
  .nw-hero {
    background: linear-gradient(135deg,#f0fdf4,#dcfce7);
    border: 1px solid #86efac; border-radius: 10px; padding: 14px 16px; margin-bottom: 12px;
  }
  .nw-hero.neg { background: linear-gradient(135deg,#fef2f2,#fee2e2); border-color: #fca5a5; }
  .nw-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; }
  .nw-value { font-size: 30px; font-weight: 900; margin-top: 3px; }
  .nw-change { font-size: 11px; font-weight: 600; margin-top: 4px; }

  /* 2-col grid */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 0; }
  .grid-2 .section { margin-bottom: 0; }

  /* Table */
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th {
    background: #f9fafb; color: #6b7280; font-size: 9px; text-transform: uppercase;
    letter-spacing: 0.06em; padding: 7px 8px; text-align: left; border-bottom: 2px solid #e5e7eb;
  }
  td { padding: 8px 8px; border-bottom: 1px solid #f3f4f6; color: #374151; }
  tr:last-child td { border-bottom: none; }

  /* Footer */
  .report-footer {
    text-align: center; font-size: 10px; color: #9ca3af;
    padding: 12px 0 4px; border-top: 1px solid #e5e7eb; margin-top: 4px;
  }

  /* ── PRINT ── */
  @media print {
    body { background: white; }
    .action-bar { display: none !important; }
    .page { padding: 0; max-width: 100%; }
    .section { break-inside: avoid; box-shadow: none; border: 1px solid #e5e7eb; }
    .grid-2 { break-inside: avoid; margin-bottom: 12px; }
    .report-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .nw-hero { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  @page { size: A4; margin: 12mm 13mm 14mm 13mm; }
`

// ── Main builder ──────────────────────────────────────────────────────────────

/**
 * Genera el HTML completo del reporte ejecutivo.
 *
 * @param {Object} data
 * @param {Object}  data.stats        - de computeStats()
 * @param {Array}   data.cards        - lista de tarjetas
 * @param {Array}   data.bajoquintos  - lista de clientes CRM
 * @param {Array}   data.metaList     - de computeMetaInsights()
 * @param {Object|null} data.invMetrics  - métricas de inversiones (puede ser null)
 * @param {Object}  data.bqMetrics    - métricas CRM calculadas
 * @param {Array}   data.recs         - recomendaciones automáticas
 * @param {Object}  data.risk         - { label, color }
 * @param {Object|null} data.nwChange - { delta, fromLabel } o null
 * @param {Object}  data.plannerData  - de computePlannerData()
 */
export function buildReportHTML({
  stats, cards, bajoquintos, metaList,
  invMetrics, bqMetrics, recs, risk,
  nwChange, plannerData,
}) {
  const now           = format(new Date(), "d 'de' MMMM yyyy", { locale: es })
  const month         = fmtMonth()
  const criticalCount = (recs || []).filter(r => r.priority === 'critico').length

  // ── Patrimonio hero ────────────────────────────────────────────────────────
  const nwHero = `
    <div class="nw-hero${stats.netWorth < 0 ? ' neg' : ''}">
      <div class="nw-label">Patrimonio Neto</div>
      <div class="nw-value" style="color:${stats.netWorth >= 0 ? '#16a34a' : '#dc2626'}">
        ${esc(fmx(stats.netWorth))}
      </div>
      ${nwChange
        ? `<div class="nw-change" style="color:${nwChange.delta >= 0 ? '#16a34a' : '#dc2626'}">
            ${nwChange.delta >= 0 ? '▲' : '▼'} ${esc(fmx(Math.abs(nwChange.delta)))} vs ${esc(nwChange.fromLabel)}
           </div>`
        : ''}
    </div>`

  // ── Patrimonio section ────────────────────────────────────────────────────
  const patrimonioSection = `
    <div class="section">
      <div class="section-title">
        💼 Resumen Financiero
        <span class="badge" style="background:${stats.netWorth >= 0 ? '#dcfce7' : '#fee2e2'};color:${stats.netWorth >= 0 ? '#16a34a' : '#dc2626'}">
          ${stats.netWorth >= 0 ? '+' : ''}${esc(fmx(stats.netWorth))}
        </span>
      </div>
      ${nwHero}
      ${statRow('Ingresos del mes',    fmx(stats.monthIncome),                   '#16a34a')}
      ${statRow('Gastos del mes',      fmx(stats.monthExpenses),                 '#dc2626')}
      ${statRow('Flujo neto',          (stats.monthFlow >= 0 ? '+' : '') + fmx(stats.monthFlow),
          stats.monthFlow >= 0 ? '#16a34a' : '#dc2626')}
      ${statRow('Efectivo disponible', fmx(stats.totalCash))}
      ${statRow('Deuda total',         fmx(stats.totalCardDebt),
          stats.totalCardDebt > 0 ? '#dc2626' : '#16a34a')}
      ${statRow('Activos totales',     fmx(stats.totalAssets))}
      ${statRow('Utilización crédito',
          stats.creditUtil.toFixed(0) + '%',
          stats.creditUtil > 50 ? '#dc2626' : stats.creditUtil > 30 ? '#ea580c' : '#16a34a',
          stats.creditUtil > 30 ? 'Objetivo: < 30%' : 'En rango saludable')}
    </div>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Reporte Ejecutivo · ${esc(month)}</title>
  <style>${CSS}</style>
</head>
<body>
<div class="page">

  <!-- ── Action bar (pantalla únicamente) ── -->
  <div class="action-bar">
    <button class="btn btn-primary" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
    <button class="btn btn-secondary" onclick="window.close()">✕ Cerrar</button>
  </div>

  <!-- ── ENCABEZADO ── -->
  <div class="report-header">
    <div class="report-title">🎸 Real Advisor</div>
    <div class="report-subtitle">Reporte Ejecutivo Mensual · ${esc(month)}</div>
    <div class="risk-badge" style="color:${esc(risk.color)}">
      <span style="width:7px;height:7px;border-radius:50%;background:${esc(risk.color)};display:inline-block;flex-shrink:0"></span>
      Riesgo ${esc(risk.label)}
    </div>
    <div style="font-size:10px;opacity:0.45;margin-top:7px">Generado el ${esc(now)}</div>
  </div>

  <!-- ── SECCIÓN 1 + 2: Patrimonio e Inversiones (2 columnas) ── -->
  <div class="grid-2" style="margin-bottom:12px">
    ${patrimonioSection}
    ${buildInvSection(invMetrics)}
  </div>

  <!-- ── SECCIÓN 3: Tarjetas ── -->
  ${buildCardsSection(cards, stats)}

  <!-- ── SECCIÓN 4: Metas ── -->
  ${buildMetasSection(metaList)}

  <!-- ── SECCIÓN 5 + 6: CRM y Planner (2 columnas) ── -->
  <div class="grid-2" style="margin-bottom:12px">
    ${buildCrmSection(bajoquintos, stats, bqMetrics)}
    ${buildPlannerSection(plannerData, criticalCount)}
  </div>

  <!-- ── SECCIÓN 7: Recomendaciones ── -->
  ${buildRecsSection(recs)}

  <!-- ── PIE DE PÁGINA ── -->
  <div class="report-footer">
    Real Advisor &nbsp;·&nbsp; Reporte Ejecutivo Mensual &nbsp;·&nbsp; ${esc(month)} &nbsp;·&nbsp; ${esc(now)}
  </div>

</div>
</body>
</html>`
}

/**
 * Abre el reporte en una ventana nueva lista para imprimir.
 * Retorna true si se abrió correctamente, false si el navegador bloqueó el popup.
 */
export function openPrintReport(data) {
  const html = buildReportHTML(data)
  const win  = window.open('', '_blank', 'width=880,height=720,scrollbars=yes,resizable=yes')
  if (!win) return false
  win.document.open()
  win.document.write(html)
  win.document.close()
  // Focus para que el usuario lo vea de inmediato
  win.focus()
  return true
}

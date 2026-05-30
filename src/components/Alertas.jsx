import { useMemo } from 'react'
import useFinanceStore from '../store/useFinanceStore.js'
import { computeAlerts } from '../store/selectors.js'

const STYLE = {
  danger:  {
    border: '1px solid rgba(225,29,72,0.20)',
    bg:     'rgba(225,29,72,0.06)',
    title:  'text-rose-600',
    btn:    'rgba(225,29,72,0.08)',
    btnBorder: 'rgba(225,29,72,0.15)',
  },
  warning: {
    border: '1px solid rgba(217,119,6,0.20)',
    bg:     'rgba(217,119,6,0.06)',
    title:  'text-amber-600',
    btn:    'rgba(217,119,6,0.08)',
    btnBorder: 'rgba(217,119,6,0.15)',
  },
  info: {
    border: '1px solid rgba(37,99,235,0.15)',
    bg:     'rgba(37,99,235,0.05)',
    title:  'text-blue-600',
    btn:    'rgba(37,99,235,0.08)',
    btnBorder: 'rgba(37,99,235,0.15)',
  },
}

export default function Alertas({ openModal }) {
  const state  = useFinanceStore()
  const alerts = useMemo(() => computeAlerts(state), [state])
  const count  = alerts.length

  return (
    <div className="mb-nav">
      <div className="px-5 pt-14 pt-safe mb-5">
        <h1 className="text-2xl font-black mb-1" style={{ color: 'var(--t1)' }}>Alertas</h1>
        <p className="text-sm" style={{ color: 'var(--t2)' }}>
          {count === 0
            ? '¡Todo en orden!'
            : `${count} alerta${count !== 1 ? 's' : ''} activa${count !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="px-5 space-y-3">
        {count === 0 ? (
          <div className="card text-center py-14">
            <p className="text-5xl mb-4">✅</p>
            <p className="font-bold mb-1" style={{ color: 'var(--t1)' }}>Sin alertas activas</p>
            <p className="text-sm" style={{ color: 'var(--t2)' }}>
              Tus finanzas están en buen estado
            </p>
          </div>
        ) : (
          alerts.map(alert => {
            const s = STYLE[alert.type] ?? STYLE.info
            return (
              <div key={alert.id}
                className="rounded-2xl p-4 fade-up"
                style={{ background: s.bg, border: s.border }}>
                <div className="flex gap-3 items-start">
                  <span className="text-2xl shrink-0 mt-0.5">{alert.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${s.title}`}>{alert.title}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--t2)' }}>
                      {alert.message}
                    </p>
                  </div>
                </div>
                {alert.cardId && (
                  <button
                    onClick={() => openModal('payment', { id: alert.cardId })}
                    className="btn-press mt-3 w-full py-2 rounded-xl text-xs font-semibold"
                    style={{
                      background: s.btn,
                      border: `1px solid ${s.btnBorder}`,
                      color: 'var(--t1)',
                    }}
                  >
                    Pagar ahora →
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Tips */}
      {count === 0 && (
        <div className="px-5 mt-6 space-y-3">
          {[
            { emoji: '💡', title: 'Mantén utilización < 30%', desc: 'Usar menos del 30% de tu crédito mejora tu historial crediticio.' },
            { emoji: '📅', title: 'Paga antes del corte', desc: 'Pagar antes del corte reduce el saldo reportado al buró.' },
            { emoji: '🎯', title: 'Fondo de emergencia', desc: 'Apunta a tener 3-6 meses de gastos en una cuenta de ahorro.' },
          ].map(tip => (
            <div key={tip.title} className="card flex gap-3 items-start">
              <span className="text-xl shrink-0">{tip.emoji}</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>{tip.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--t2)' }}>{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Distribution Donut Chart ──────────────────────────────────────────────────
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { fmx } from '../../lib/formatters.js'

function TooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background:   'var(--s1)',
      border:       '1px solid var(--border)',
      borderRadius: 10,
      padding:      '7px 12px',
      boxShadow:    '0 4px 18px rgba(0,0,0,0.14)',
    }}>
      <p style={{ color: d.color, fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{d.name}</p>
      <p style={{ fontWeight: 800, fontSize: 13, color: 'var(--t1)', lineHeight: 1 }}>{fmx(d.value)}</p>
      <p style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{d.pct.toFixed(1)}%</p>
    </div>
  )
}

export default function DistributionChart({ data }) {
  if (!data?.length) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

      {/* Donut */}
      <div style={{ flexShrink: 0 }}>
        <PieChart width={130} height={130}>
          <Pie
            data={data}
            cx={63}
            cy={63}
            innerRadius={38}
            outerRadius={58}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
            startAngle={90}
            endAngle={-270}
            isAnimationActive
            animationDuration={600}
          >
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip content={<TooltipContent />} />
        </PieChart>
      </div>

      {/* Legend */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', whiteSpace: 'nowrap' }}>
                {d.name}
              </span>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)' }}>
                {d.pct.toFixed(0)}%
              </span>
              <br />
              <span style={{ fontSize: 9, color: 'var(--t3)' }}>{fmx(d.value)}</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}

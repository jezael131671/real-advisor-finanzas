// ── Portfolio Chart — lightweight-charts (TradingView) ───────────────────────
// Zoom: scroll wheel / pinch.  Pan: drag / touch-drag.
// Tooltip HUD shows: date, value, % change from period start.
import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts'
import { Loader2 } from 'lucide-react'
import { fmx } from '../../lib/formatters.js'

// ── Tick label formatter (bottom axis) ────────────────────────────────────────
function buildTickFormatter(period) {
  const MO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return (t) => {
    const d = new Date(t * 1000)
    if (period === '1D') {
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    }
    if (period === '1W' || period === '1M' || period === '3M') {
      return `${d.getDate()} ${MO[d.getMonth()]}`
    }
    return `${MO[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`
  }
}

// ── Tooltip date formatter ────────────────────────────────────────────────────
function fmtDate(t, period) {
  const d = new Date(t * 1000)
  if (period === '1D') {
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  const opts = { day: 'numeric', month: 'short' }
  if (period === '1Y' || period === 'ALL' || period === '6M' || period === 'YTD') {
    opts.year = '2-digit'
  }
  if (period === '1W') opts.weekday = 'short'
  return d.toLocaleDateString('es-MX', opts)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PortfolioChart({ data, loading = false, period = '1M', positive = true }) {
  const containerRef = useRef(null)
  const chartRef     = useRef(null)
  const seriesRef    = useRef(null)
  const dataRef      = useRef(data)        // avoid stale closure in crosshair handler
  const periodRef    = useRef(period)      // same
  const [tooltip, setTooltip] = useState(null) // {time, value, pct}

  // Keep refs in sync
  useEffect(() => { dataRef.current   = data   }, [data])
  useEffect(() => { periodRef.current = period }, [period])

  // ── Create chart once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: 155,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor:  'rgba(255,255,255,0.30)',
        fontSize:   9,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color:                'rgba(165,180,252,0.55)',
          width:                1,
          style:                0,  // solid
          labelBackgroundColor: '#4F46E5',
          labelVisible:         false,
        },
        horzLine: { visible: false, labelVisible: false },
      },
      rightPriceScale: { visible: false },
      leftPriceScale:  { visible: false },
      timeScale: {
        borderVisible:         false,
        rightOffset:           4,
        barSpacing:            6,
        fixLeftEdge:           true,
        fixRightEdge:          true,
        lockVisibleTimeRangeOnResize: true,
        tickMarkFormatter:     buildTickFormatter(period),
      },
      handleScroll: {
        mouseWheel:       true,
        pressedMouseMove: true,
        horzTouchDrag:    true,
        vertTouchDrag:    false,
      },
      handleScale: {
        axisPressedMouseMove: false,
        mouseWheel:           true,
        pinch:                true,
      },
    })

    const color  = positive ? '#6366F1' : '#F43F5E'
    const topClr = positive ? 'rgba(99,102,241,0.38)' : 'rgba(244,63,94,0.38)'

    const series = chart.addAreaSeries({
      lineColor:                  color,
      topColor:                   topClr,
      bottomColor:                'rgba(0,0,0,0)',
      lineWidth:                  2.5,
      crosshairMarkerVisible:     true,
      crosshairMarkerRadius:      4,
      crosshairMarkerBorderColor: 'rgba(255,255,255,0.90)',
      crosshairMarkerBorderWidth: 2,
      priceLineVisible:           false,
      lastValueVisible:           false,
    })

    chartRef.current  = chart
    seriesRef.current = series

    // ── Crosshair → tooltip ────────────────────────────────────────────────
    chart.subscribeCrosshairMove(param => {
      if (!param.point || !param.time || !dataRef.current?.length) {
        setTooltip(null); return
      }
      const d = param.seriesData.get(series)
      if (!d) { setTooltip(null); return }
      const val   = d.value
      const first = dataRef.current[0].value
      const pct   = first > 0 ? ((val - first) / first) * 100 : 0
      setTooltip({ time: param.time, value: val, pct })
    })

    // ── ResizeObserver ────────────────────────────────────────────────────
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w > 0 && chartRef.current) chartRef.current.applyOptions({ width: w })
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current  = null
      seriesRef.current = null
    }
  }, [])  // create once — colors updated below

  // ── Update colors when positive changes ───────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current) return
    const color  = positive ? '#6366F1' : '#F43F5E'
    const topClr = positive ? 'rgba(99,102,241,0.38)' : 'rgba(244,63,94,0.38)'
    seriesRef.current.applyOptions({ lineColor: color, topColor: topClr })
  }, [positive])

  // ── Update tick formatter when period changes ─────────────────────────────
  useEffect(() => {
    chartRef.current?.applyOptions({
      timeScale: { tickMarkFormatter: buildTickFormatter(period) },
    })
  }, [period])

  // ── Set data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current) return
    if (!data?.length) { seriesRef.current.setData([]); return }

    // Zoom y-axis to data range instead of starting from 0
    // This makes small portfolio fluctuations visible as a proper chart
    const vals = data.map(d => d.value)
    const minV = Math.min(...vals)
    const maxV = Math.max(...vals)
    const pad  = (maxV - minV) || maxV * 0.005   // fallback 0.5% if perfectly flat

    seriesRef.current.applyOptions({
      autoscaleInfoProvider: () => ({
        priceRange: {
          minValue: minV - pad * 0.15,
          maxValue: maxV + pad * 0.35,
        },
      }),
    })

    seriesRef.current.setData(data)
    chartRef.current?.timeScale().fitContent()
    setTooltip(null)
  }, [data])

  // ── Render ─────────────────────────────────────────────────────────────────
  const isEmpty = !loading && (!data || data.length < 2)

  return (
    <div style={{ position: 'relative', width: '100%', height: 155 }}>

      {/* Chart canvas host */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Loading spinner */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(13,8,33,0.55)',
          borderRadius: 8,
        }}>
          <Loader2 size={22} color="rgba(165,180,252,0.70)" className="animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', fontWeight: 600 }}>
            Sin datos para este período
          </span>
        </div>
      )}

      {/* Tooltip HUD — appears on crosshair hover */}
      {!loading && tooltip && (
        <div style={{
          position:      'absolute',
          top:           6,
          left:          '50%',
          transform:     'translateX(-50%)',
          background:    'rgba(20,12,50,0.96)',
          border:        '1px solid rgba(99,102,241,0.35)',
          borderRadius:  10,
          padding:       '5px 13px',
          pointerEvents: 'none',
          display:       'flex',
          gap:           12,
          alignItems:    'center',
          whiteSpace:    'nowrap',
          boxShadow:     '0 4px 16px rgba(0,0,0,0.30)',
          zIndex:        10,
        }}>
          <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: 10, fontWeight: 500 }}>
            {fmtDate(tooltip.time, period)}
          </span>
          <span style={{ color: '#A5B4FC', fontSize: 14, fontWeight: 800 }}>
            {fmx(tooltip.value)}
          </span>
          <span style={{
            color:      tooltip.pct >= 0 ? '#34d399' : '#f87171',
            fontSize:   11,
            fontWeight: 700,
          }}>
            {tooltip.pct >= 0 ? '+' : ''}{tooltip.pct.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  )
}

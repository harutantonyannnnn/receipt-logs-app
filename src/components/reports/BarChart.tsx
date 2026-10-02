import { useState } from 'react'

export interface Bar {
  key: string
  tick: string // подпись под осью
  label: string // подпись в подсказке
  value: number
}

interface Props {
  data: Bar[]
  unit: string
  color: string
  height?: number
  format: (n: number) => string
}

function niceMax(v: number) {
  if (v <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * exp
}

// Простая столбчатая диаграмма одного ряда: ось Y с 4 делениями, подсказка при наведении
export function BarChart({ data, unit, color, height = 220, format }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const every = Math.max(1, Math.ceil(data.length / 12))
  const h = hover !== null ? data[hover] : null

  return (
    <div className="bar-chart" onMouseLeave={() => setHover(null)}>
      <div className="bc-y" style={{ height }}>
        {ticks.map((t) => (
          <span key={t} style={{ bottom: `${(t / max) * 100}%` }}>{format(t)}</span>
        ))}
      </div>
      <div className="bc-main">
        <div className="bc-plot" style={{ height }}>
          {ticks.map((t) => (
            <div key={t} className={`bc-grid${t === 0 ? ' base' : ''}`} style={{ bottom: `${(t / max) * 100}%` }} />
          ))}
          <div className="bc-bars">
            {data.map((d, i) => (
              <div
                key={d.key}
                className={`bc-col${hover === i ? ' hover' : ''}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                tabIndex={0}
                aria-label={`${d.label}: ${format(d.value)} ${unit}`}
              >
                {d.value > 0 && (
                  <div className="bc-bar" style={{ height: `${(d.value / max) * 100}%`, background: color }} />
                )}
              </div>
            ))}
          </div>
          {h && hover !== null && (
            <div
              className="bc-tip"
              style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
            >
              <div className="bc-tip-label">{h.label}</div>
              <div className="bc-tip-value">
                <span className="swatch" style={{ background: color }} />
                {format(h.value)} {unit}
              </div>
            </div>
          )}
        </div>
        <div className="bc-x">
          {data.map((d, i) => (
            <span key={d.key} className="bc-tick">{i % every === 0 ? d.tick : ''}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

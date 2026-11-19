export function GroupedBars({
  labels,
  series,
  amplia = false,
}: {
  labels: string[]
  series: { name: string; color: string; values: number[] }[]
  amplia?: boolean
}) {
  const width = 640
  const height = amplia ? 420 : 240
  const pad = amplia ? { l: 40, r: 12, t: 16, b: 78 } : { l: 36, r: 8, t: 12, b: 42 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const groupW = labels.length ? innerW / labels.length : innerW
  const barW = Math.min(16, groupW / (series.length + 1))
  const summary = labels.map((label, index) => {
    const values = series.map((item) => `${item.name} ${item.values[index] ?? 0}%`).join(', ')
    return `${label}: ${values}`
  }).join('. ')

  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Utilización. ${summary}`}>
        {[0, 50, 100].map((tick) => {
          const y = pad.t + innerH - (tick / 100) * innerH
          return (
            <g key={tick}>
              <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="#E2E8F0" />
              <text x={pad.l - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#64748B">{tick}</text>
            </g>
          )
        })}
        {labels.map((label, index) => {
          const x = pad.l + groupW * index
          return (
            <g key={label}>
              {series.map((item, seriesIndex) => {
                const value = item.values[index] ?? 0
                const h = (value / 100) * innerH
                const bx = x + groupW / 2 - (series.length * barW) / 2 + seriesIndex * barW
                const by = pad.t + innerH - h
                return (
                  <rect key={item.name} x={bx} y={by} width={barW - 2} height={h} rx="2" fill={item.color}>
                    <title>{`${label}, ${item.name}: ${value}%`}</title>
                  </rect>
                )
              })}
              <text
                x={x + groupW / 2}
                y={amplia ? height - 36 : height - 16}
                textAnchor={amplia ? 'end' : 'middle'}
                fontSize={amplia ? 13 : 11}
                fill="#334155"
                transform={amplia ? `rotate(-32 ${x + groupW / 2} ${height - 36})` : undefined}
              >{label}</text>
            </g>
          )
        })}
      </svg>
      <div className="legend">
        {series.map((item) => (
          <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>
        ))}
      </div>
    </div>
  )
}

export function MeterList({ items }: { items: { label: string; value: number; hint?: string }[] }) {
  const max = Math.max(1, ...items.map((item) => item.value))
  if (!items.length) return <p className="empty">Sin datos en este periodo.</p>
  return (
    <ul className="meters">
      {items.map((item) => (
        <li key={item.label}>
          <div className="meter-label">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
          <div className="meter-track" aria-hidden>
            <span style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          {item.hint ? <small className="hint">{item.hint}</small> : null}
        </li>
      ))}
    </ul>
  )
}

'use client'

import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

type Range = '7d' | '30d' | 'all'

type DataPoint = { date: string; label: string; count: number }

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function buildSeries(dates: string[], range: Range): DataPoint[] {
  const countMap: Record<string, number> = {}
  for (const d of dates) {
    const day = d.slice(0, 10)
    countMap[day] = (countMap[day] ?? 0) + 1
  }

  const now  = new Date()
  const today = toDateStr(now)

  let start: Date
  if (range === '7d') {
    start = new Date(now.getTime() - 6 * 86400000)
  } else if (range === '30d') {
    start = new Date(now.getTime() - 29 * 86400000)
  } else {
    // all time — from earliest signup
    const earliest = dates.length ? dates.slice().sort()[0].slice(0, 10) : today
    start = new Date(earliest)
  }

  const series: DataPoint[] = []
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)

  while (toDateStr(cursor) <= today) {
    const day = toDateStr(cursor)
    const label = cursor.toLocaleDateString('en-GB', {
      day:   'numeric',
      month: 'short',
      ...(range === 'all' && dates.length > 60 ? { month: 'short', year: '2-digit' } : {}),
    })
    series.push({ date: day, label, count: countMap[day] ?? 0 })
    cursor.setDate(cursor.getDate() + 1)
  }

  return series
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  const count = payload[0]?.value ?? 0
  return (
    <div className="bg-white border border-border rounded-xl px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-navy mb-0.5">{label}</p>
      <p className="text-body-grey">{count} signup{count !== 1 ? 's' : ''}</p>
    </div>
  )
}

function RangeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active ? 'bg-navy text-warm-white border-navy' : 'bg-white text-navy border-border hover:border-navy'
      }`}
    >
      {children}
    </button>
  )
}

export default function SignupsChart({ dates, total }: { dates: string[]; total: number }) {
  const [range, setRange] = useState<Range>('30d')

  const series = useMemo(() => buildSeries(dates, range), [dates, range])
  const rangeTotal = useMemo(() => series.reduce((s, d) => s + d.count, 0), [series])

  // Thin out x-axis labels when there are many points
  const tickInterval = series.length > 60 ? Math.floor(series.length / 20) : series.length > 14 ? 3 : 0

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Signups Over Time</h1>
          <p className="text-sm text-body-grey mt-1">{total} total members</p>
        </div>
        <div className="flex gap-1.5">
          <RangeBtn active={range === '7d'}  onClick={() => setRange('7d')}>Last 7 days</RangeBtn>
          <RangeBtn active={range === '30d'} onClick={() => setRange('30d')}>Last 30 days</RangeBtn>
          <RangeBtn active={range === 'all'} onClick={() => setRange('all')}>All time</RangeBtn>
        </div>
      </div>

      <div className="bg-white border border-border rounded-2xl p-5 mb-4">
        <p className="text-xs text-body-grey mb-4">
          {rangeTotal} signup{rangeTotal !== 1 ? 's' : ''} in selected period
        </p>
        {series.length === 0 ? (
          <p className="text-sm text-body-grey py-8 text-center">No signup data.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="#E5E1DB" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#6B7280' }}
                interval={tickInterval}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#6B7280' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#0F1B3C"
                strokeWidth={2}
                dot={series.length <= 30 ? { r: 3, fill: '#0F1B3C', strokeWidth: 0 } : false}
                activeDot={{ r: 4, fill: '#C8F53C', stroke: '#0F1B3C', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Daily breakdown table for short ranges */}
      {range !== 'all' && (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-body-grey uppercase tracking-wide">Date</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-body-grey uppercase tracking-wide">Signups</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...series].reverse().map(row => (
                  <tr key={row.date} className={row.count > 0 ? 'bg-white' : ''}>
                    <td className="px-4 py-2 text-body-grey">{row.label}</td>
                    <td className="px-4 py-2 text-right font-medium text-navy">
                      {row.count > 0 ? row.count : <span className="text-body-grey font-normal">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

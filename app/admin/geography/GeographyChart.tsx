'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

export type LocationRow = {
  location: string
  total: number
  newThisMonth: number
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const total = payload[0]?.value ?? 0
  const newCount = payload[1]?.value ?? 0
  return (
    <div className="bg-white border border-border rounded-xl px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-navy mb-1">{label}</p>
      <p className="text-body-grey">{total} member{total !== 1 ? 's' : ''} total</p>
      {newCount > 0 && <p className="text-navy font-medium">{newCount} new this month</p>}
    </div>
  )
}

export default function GeographyChart({ data }: { data: LocationRow[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-body-grey py-8 text-center">No location data yet.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 48)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
        barSize={14}
        barGap={2}
      >
        <CartesianGrid horizontal={false} stroke="#E5E1DB" />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="location"
          width={110}
          tick={{ fontSize: 12, fill: '#0F1B3C' }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F0EDE8' }} />
        <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]}>
          {data.map((row) => (
            <Cell key={row.location} fill="#0F1B3C" />
          ))}
        </Bar>
        <Bar dataKey="newThisMonth" name="New this month" radius={[0, 4, 4, 0]}>
          {data.map((row) => (
            <Cell key={row.location} fill="#C8F53C" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

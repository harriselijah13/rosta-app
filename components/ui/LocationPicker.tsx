'use client'

import { useState } from 'react'

const UAE_CITIES = ['Dubai', 'Sharjah', 'Abu Dhabi', 'Ras Al Khaimah'] as const
const UK_CITIES  = ['London', 'Manchester', 'Liverpool', 'Bristol', 'Birmingham', 'Newcastle'] as const

type Country = 'UAE' | 'UK' | 'Other' | ''
type Loc     = { country: Country; city: string; customCity: string; customCountry: string }

function parse(value: string): Loc {
  const v = value.trim()
  if (!v) return { country: '', city: '', customCity: '', customCountry: '' }

  if (v.endsWith(', UAE')) {
    const city = v.slice(0, -5)
    if ((UAE_CITIES as readonly string[]).includes(city))
      return { country: 'UAE', city, customCity: '', customCountry: '' }
  }
  if (v.endsWith(', UK')) {
    const city = v.slice(0, -4)
    if ((UK_CITIES as readonly string[]).includes(city))
      return { country: 'UK', city, customCity: '', customCountry: '' }
  }

  // Fall through to Other — split on last comma
  const last = v.lastIndexOf(',')
  if (last !== -1)
    return { country: 'Other', city: '', customCity: v.slice(0, last).trim(), customCountry: v.slice(last + 1).trim() }

  return { country: 'Other', city: '', customCity: v, customCountry: '' }
}

function format(loc: Loc): string {
  if (loc.country === 'UAE' && loc.city) return `${loc.city}, UAE`
  if (loc.country === 'UK'  && loc.city) return `${loc.city}, UK`
  if (loc.country === 'Other') {
    return [loc.customCity.trim(), loc.customCountry.trim()].filter(Boolean).join(', ')
  }
  return ''
}

interface Props {
  value: string
  onChange: (value: string) => void
  label?: string
}

export default function LocationPicker({ value, onChange, label = 'Where I operate' }: Props) {
  const [loc, setLoc] = useState<Loc>(() => parse(value))

  function setCountry(country: Country) {
    const next: Loc = { country, city: '', customCity: '', customCountry: '' }
    setLoc(next)
    onChange(format(next))
  }

  function patch(partial: Partial<Loc>) {
    setLoc(prev => {
      const next = { ...prev, ...partial }
      onChange(format(next))
      return next
    })
  }

  const pill = (active: boolean) =>
    `px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
      active
        ? 'bg-navy text-warm-white border-navy'
        : 'bg-white text-navy border-border hover:border-navy'
    }`

  const selectCls = 'w-full px-4 py-3 bg-white border border-border rounded-xl text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors'
  const inputCls  = 'w-full px-4 py-3 bg-white border border-border rounded-xl text-sm text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors'

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-navy">{label}</label>

      {/* Country selection */}
      <div className="flex gap-2 flex-wrap">
        {(['UAE', 'UK', 'Other'] as const).map(c => (
          <button key={c} type="button" onClick={() => setCountry(c)} className={pill(loc.country === c)}>
            {c}
          </button>
        ))}
      </div>

      {/* UAE city dropdown */}
      {loc.country === 'UAE' && (
        <select value={loc.city} onChange={e => patch({ city: e.target.value })} className={selectCls}>
          <option value="">Select a city</option>
          {UAE_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {/* UK city dropdown */}
      {loc.country === 'UK' && (
        <select value={loc.city} onChange={e => patch({ city: e.target.value })} className={selectCls}>
          <option value="">Select a city</option>
          {UK_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {/* Other: country first, then city */}
      {loc.country === 'Other' && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Country"
            value={loc.customCountry}
            onChange={e => patch({ customCountry: e.target.value })}
            className={inputCls}
          />
          <input
            type="text"
            placeholder="City or State"
            value={loc.customCity}
            onChange={e => patch({ customCity: e.target.value })}
            className={inputCls}
          />
        </div>
      )}
    </div>
  )
}

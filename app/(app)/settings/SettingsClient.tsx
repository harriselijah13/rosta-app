'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import { OPEN_TO_OPTIONS, PROFILE_MODES } from '@/lib/constants'

const USERNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

type Props = {
  userId: string
  profile: {
    username?: string | null
    first_name?: string | null
    last_name?: string | null
    avatar_url?: string | null
    what_i_do?: string | null
    building_now?: string | null
    who_i_want_to_meet?: string | null
    where_i_operate?: string | null
    fun_fact?: string | null
    profile_mode?: string | null
  }
  signals: {
    open_to: string[]
    working_on: string | null
    need_right_now: string | null
  } | null
}

export default function SettingsClient({ userId, profile, signals }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Avatar
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url ?? '')

  // Profile fields
  const [username, setUsername] = useState(profile.username ?? '')
  const [firstName, setFirstName] = useState(profile.first_name ?? '')
  const [lastName, setLastName] = useState(profile.last_name ?? '')
  const [whatIDo, setWhatIDo] = useState(profile.what_i_do ?? '')
  const [buildingNow, setBuildingNow] = useState(profile.building_now ?? '')
  const [whoIWantToMeet, setWhoIWantToMeet] = useState(profile.who_i_want_to_meet ?? '')
  const [whereIOperate, setWhereIOperate] = useState(profile.where_i_operate ?? '')
  const [funFact, setFunFact] = useState(profile.fun_fact ?? '')
  const [profileMode, setProfileMode] = useState(profile.profile_mode ?? '')

  // Signals
  const [openTo, setOpenTo] = useState<string[]>(signals?.open_to ?? [])
  const [workingOn, setWorkingOn] = useState(signals?.working_on ?? '')
  const [needRightNow, setNeedRightNow] = useState(signals?.need_right_now ?? '')

  // Open Door is stored as 'open_door' in open_to
  const openDoor = openTo.includes('open_door')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function toggleOpenTo(value: string) {
    setOpenTo(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    )
  }

  function toggleOpenDoor() {
    setOpenTo(prev =>
      prev.includes('open_door')
        ? prev.filter(v => v !== 'open_door')
        : [...prev, 'open_door']
    )
  }

  async function uploadAvatar(): Promise<string> {
    if (!avatarFile) return profile.avatar_url ?? ''
    const ext = avatarFile.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, avatarFile, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!buildingNow.trim()) {
      setError('"Building now" is required.')
      return
    }
    const trimmedUsername = username.trim().toLowerCase()
    if (trimmedUsername && !USERNAME_RE.test(trimmedUsername)) {
      setError('Username can only contain lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen.')
      return
    }
    if (trimmedUsername.length > 30) {
      setError('Username must be 30 characters or fewer.')
      return
    }
    setSaving(true)
    setSaved(false)
    setError('')

    try {
      const avatarUrl = await uploadAvatar()

      const { error: pe } = await supabase
        .from('profiles')
        .update({
          username:             trimmedUsername || null,
          first_name:           firstName.trim() || null,
          last_name:            lastName.trim() || null,
          avatar_url:           avatarUrl || null,
          what_i_do:            whatIDo.trim() || null,
          building_now:         buildingNow.trim(),
          who_i_want_to_meet:   whoIWantToMeet.trim() || null,
          where_i_operate:      whereIOperate.trim() || null,
          fun_fact:             funFact.trim() || null,
          profile_mode:         profileMode || null,
        })
        .eq('id', userId)
      if (pe) {
        if (pe.code === '23505') throw new Error('That username is already taken.')
        throw pe
      }

      const { error: se } = await supabase
        .from('signals')
        .upsert(
          {
            user_id:        userId,
            open_to:        openTo,
            working_on:     workingOn.trim() || null,
            need_right_now: needRightNow.trim() || null,
          },
          { onConflict: 'user_id' }
        )
      if (se) throw se

      setSaved(true)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-4xl font-bold text-navy mb-8">Settings</h1>

      {/* ── Profile section ── */}
      <section className="bg-white border border-border rounded-2xl p-6 mb-4">
        <h2 className="font-display text-xl font-bold text-navy mb-6">Your profile</h2>

        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative w-16 h-16 rounded-full border-2 border-dashed border-border hover:border-navy transition-colors overflow-hidden flex items-center justify-center bg-surface group"
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-body-grey group-hover:text-navy transition-colors text-center leading-tight px-1">
                Photo
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-sm font-medium text-navy hover:underline"
            >
              {avatarPreview ? 'Change photo' : 'Upload photo'}
            </button>
            {avatarPreview && (
              <button
                type="button"
                onClick={() => { setAvatarFile(null); setAvatarPreview('') }}
                className="block text-sm text-body-grey hover:text-navy transition-colors mt-0.5"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Username */}
        <div className="mb-4">
          <label htmlFor="username" className="block text-sm font-medium text-navy mb-1.5">
            Username
          </label>
          <div className="flex items-center rounded-xl border border-border bg-white overflow-hidden focus-within:ring-2 focus-within:ring-navy/20 focus-within:border-navy transition-colors">
            <span className="pl-4 pr-1 text-body-grey text-sm select-none">onrosta.com/profile/</span>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase())}
              placeholder="your-name"
              maxLength={30}
              className="flex-1 py-3 pr-4 bg-transparent text-navy placeholder-body-grey focus:outline-none text-sm"
            />
          </div>
          <p className="mt-1 text-xs text-body-grey">
            Lowercase letters, numbers, and hyphens only — max 30 characters.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <Input
            label="First name"
            id="first-name"
            type="text"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            autoComplete="given-name"
          />
          <Input
            label="Last name"
            id="last-name"
            type="text"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            autoComplete="family-name"
          />
        </div>

        <div className="flex flex-col gap-4">
          <Input
            label="What I do"
            id="what-i-do"
            type="text"
            placeholder="Product designer at early-stage startups"
            value={whatIDo}
            onChange={e => setWhatIDo(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="building-now" className="text-sm font-medium text-navy">
              Building now <span className="text-red-400">*</span>
            </label>
            <input
              id="building-now"
              type="text"
              placeholder="A marketplace for creative freelancers"
              value={buildingNow}
              onChange={e => setBuildingNow(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
            />
          </div>
          <Input
            label="Who I want to meet"
            id="who-i-want-to-meet"
            type="text"
            value={whoIWantToMeet}
            onChange={e => setWhoIWantToMeet(e.target.value)}
          />
          <Input
            label="Where I operate"
            id="where-i-operate"
            type="text"
            value={whereIOperate}
            onChange={e => setWhereIOperate(e.target.value)}
          />
          <Input
            label={"One thing people don't know about me"}
            id="fun-fact"
            type="text"
            value={funFact}
            onChange={e => setFunFact(e.target.value)}
          />
        </div>

        {/* Profile mode */}
        <div className="mt-6">
          <p className="text-sm font-medium text-navy mb-3">Profile mode</p>
          <div className="grid grid-cols-2 gap-2">
            {PROFILE_MODES.map(mode => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setProfileMode(mode.value)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  profileMode === mode.value
                    ? 'border-navy bg-navy text-warm-white'
                    : 'border-border bg-white text-navy hover:border-navy'
                }`}
              >
                <p className="font-display font-bold text-base">{mode.label}</p>
                <p className={`text-xs mt-0.5 leading-snug ${profileMode === mode.value ? 'text-warm-white/70' : 'text-body-grey'}`}>
                  {mode.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Signals section ── */}
      <section className="bg-white border border-border rounded-2xl p-6 mb-4">
        <h2 className="font-display text-xl font-bold text-navy mb-1">Signals</h2>
        <p className="text-sm text-body-grey mb-6">
          Updating signals resets your Active ROSTA indicator.
        </p>

        <div className="flex flex-col gap-5">
          <div>
            <p className="text-sm font-medium text-navy mb-2">Open to</p>
            <div className="flex flex-wrap gap-2">
              {OPEN_TO_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleOpenTo(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    openTo.includes(opt.value)
                      ? 'bg-navy text-warm-white border-navy'
                      : 'bg-white text-navy border-border hover:border-navy'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Textarea
            label="Working on"
            id="working-on"
            placeholder={"Right now I'm focused on..."}
            value={workingOn}
            onChange={e => setWorkingOn(e.target.value)}
            rows={3}
          />
          <Textarea
            label="Need right now"
            id="need-right-now"
            placeholder="An intro to..."
            value={needRightNow}
            onChange={e => setNeedRightNow(e.target.value)}
            rows={3}
          />
        </div>
      </section>

      {/* ── Open Door section ── */}
      <section className="bg-white border border-border rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-navy mb-1">Open Door</h2>
            <p className="text-sm text-body-grey">
              Signal that you welcome unfiltered approaches from anyone in the network.
              Your profile will show an Open Door indicator.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={openDoor}
            onClick={toggleOpenDoor}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-navy/20 ${
              openDoor ? 'bg-navy' : 'bg-border'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                openDoor ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        {openDoor && (
          <p className="mt-3 text-sm font-medium text-navy">
            Open Door is on — your profile shows the indicator
          </p>
        )}
      </section>

      {/* Feedback + submit */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl mb-4">{error}</p>
      )}
      {saved && (
        <p className="text-sm text-green-700 bg-green-50 px-4 py-3 rounded-xl mb-4">
          Changes saved.
        </p>
      )}

      <Button type="submit" loading={saving} size="lg" className="w-full">
        Save changes
      </Button>
    </form>
  )
}

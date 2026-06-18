'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import LocationPicker from '@/components/ui/LocationPicker'

type Step = 1 | 2 | 3 | 4

type FormData = {
  firstName: string
  lastName: string
  username: string
  avatarFile: File | null
  avatarPreview: string
  avatarUrl: string
  whatIDo: string
  buildingNow: string
  whoIWantToMeet: string
  whereIOperate: string
  funFact: string
  openTo: string[]
  workingOn: string
  needRightNow: string
  profileMode: string
}

const OPEN_TO_OPTIONS = [
  { value: 'investment',   label: 'Investment' },
  { value: 'collaboration',label: 'Collaboration' },
  { value: 'clients',      label: 'Clients' },
  { value: 'mentorship',   label: 'Mentorship' },
  { value: 'hiring',       label: 'Hiring' },
  { value: 'being_hired',  label: 'Being hired' },
  { value: 'coffee',       label: 'Coffee' },
]

const PROFILE_MODES = [
  { value: 'founder',   label: 'Founder',   description: "I'm building something new" },
  { value: 'creative',  label: 'Creative',  description: 'I make things that move people' },
  { value: 'operator',  label: 'Operator',  description: 'I make organisations run well' },
  { value: 'explorer',  label: 'Explorer',  description: "I'm figuring out what's next" },
]

const USERNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

interface Props {
  userId: string
  initialFirstName: string
  initialLastName: string
}

export default function OnboardingFlow({ userId, initialFirstName, initialLastName }: Props) {
  const [showWelcome, setShowWelcome] = useState(initialFirstName === '')
  const [step, setStep]     = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [form, setForm]     = useState<FormData>({
    firstName:      initialFirstName,
    lastName:       initialLastName,
    username:       '',
    avatarFile:     null,
    avatarPreview:  '',
    avatarUrl:      '',
    whatIDo:        '',
    buildingNow:    '',
    whoIWantToMeet: '',
    whereIOperate:  '',
    funFact:        '',
    openTo:         ['open_door'],
    workingOn:      '',
    needRightNow:   '',
    profileMode:    '',
  })
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const fileRef = useRef<HTMLInputElement>(null)
  const router  = useRouter()
  const supabase = createClient()

  function update(patch: Partial<FormData>) {
    setForm(prev => ({ ...prev, ...patch }))
    setError('')
  }

  // Debounced username availability check
  useEffect(() => {
    const raw = form.username.trim()
    if (!raw) { setUsernameStatus('idle'); return }
    if (raw.length > 30 || !USERNAME_RE.test(raw)) { setUsernameStatus('invalid'); return }
    setUsernameStatus('checking')
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', raw)
        .neq('id', userId)
        .maybeSingle()
      setUsernameStatus(data ? 'taken' : 'available')
    }, 600)
    return () => clearTimeout(timer)
  }, [form.username]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    update({ avatarFile: file, avatarPreview: URL.createObjectURL(file) })
  }

  function toggleOpenTo(value: string) {
    setForm(prev => ({
      ...prev,
      openTo: prev.openTo.includes(value)
        ? prev.openTo.filter(v => v !== value)
        : [...prev.openTo, value],
    }))
  }

  async function uploadAvatar(): Promise<string> {
    if (!form.avatarFile) return form.avatarUrl
    const ext  = form.avatarFile.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, form.avatarFile, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  async function saveStep1() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First and last name are required.')
      return
    }
    const trimmedUsername = form.username.trim().toLowerCase()
    if (trimmedUsername) {
      if (!USERNAME_RE.test(trimmedUsername)) {
        setError('Username can only contain lowercase letters, numbers, and hyphens.')
        return
      }
      if (usernameStatus === 'taken')    { setError('That username is already taken.'); return }
      if (usernameStatus === 'checking') { setError('Still checking username — please wait a moment.'); return }
    }
    setLoading(true)
    setError('')
    try {
      let avatarUrl = form.avatarUrl
      if (form.avatarFile) {
        avatarUrl = await uploadAvatar()
        update({ avatarUrl })
      }
      const { error } = await supabase.from('profiles').update({
        first_name: form.firstName.trim(),
        last_name:  form.lastName.trim(),
        avatar_url: avatarUrl || null,
        username:   trimmedUsername || null,
      }).eq('id', userId)
      if (error) {
        if (error.code === '23505') { setError('That username is already taken.'); return }
        throw error
      }
      setStep(2)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function saveStep2() {
    if (!form.buildingNow.trim()) {
      setError('"Building now" is required and cannot be skipped.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.from('profiles').update({
        what_i_do:          form.whatIDo.trim()        || null,
        building_now:       form.buildingNow.trim(),
        who_i_want_to_meet: form.whoIWantToMeet.trim() || null,
        where_i_operate:    form.whereIOperate.trim()  || null,
        fun_fact:           form.funFact.trim()         || null,
      }).eq('id', userId)
      if (error) throw error
      setStep(3)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function saveStep3() {
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.from('signals').upsert(
        {
          user_id:        userId,
          open_to:        form.openTo,
          working_on:     form.workingOn.trim()     || null,
          need_right_now: form.needRightNow.trim()  || null,
        },
        { onConflict: 'user_id' }
      )
      if (error) throw error
      setStep(4)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function saveStep4() {
    if (!form.profileMode) {
      setError('Please select a profile mode to continue.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.from('profiles').update({
        profile_mode:         form.profileMode,
        onboarding_completed: true,
      }).eq('id', userId)
      if (error) throw error
      fetch('/api/invite/redeem', { method: 'POST' }).catch(() => {})
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  // ── Welcome screen ──────────────────────────────────────────────────────────

  if (showWelcome) {
    return (
      <div className="min-h-screen bg-navy flex flex-col">
        <nav className="px-8 py-5">
          <span className="font-display text-2xl font-bold text-warm-white">
            ROSTA<span className="text-lime">.</span>
          </span>
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center relative">
          {/* Ambient background dots — subtle life on the navy canvas */}
          <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none select-none">
            <div className="absolute top-[14%] left-[11%]  w-1.5 h-1.5 rounded-full bg-white/[0.07]" />
            <div className="absolute top-[22%] right-[16%] w-1   h-1   rounded-full bg-white/[0.05]" />
            <div className="absolute top-[55%] left-[7%]   w-1   h-1   rounded-full bg-white/[0.07]" />
            <div className="absolute top-[40%] right-[9%]  w-1.5 h-1.5 rounded-full bg-white/[0.05]" />
            <div className="absolute bottom-[28%] left-[18%] w-1  h-1   rounded-full bg-white/[0.06]" />
            <div className="absolute bottom-[18%] right-[14%] w-1 h-1   rounded-full bg-white/[0.07]" />
          </div>

          <h1 className="font-display text-5xl sm:text-6xl font-bold text-warm-white mb-5 max-w-lg leading-tight relative z-10">
            You&apos;re in.
          </h1>
          <p className="text-warm-white/70 text-base sm:text-lg max-w-sm mb-10 leading-relaxed relative z-10">
            A professional network built around real introductions, real conversations, and real outcomes.
          </p>
          <button
            onClick={() => setShowWelcome(false)}
            className="px-8 py-3.5 bg-lime text-navy rounded-full font-semibold text-sm hover:bg-lime/90 transition-colors relative z-10"
          >
            Set up your profile
          </button>
          <p className="text-warm-white/50 text-sm mt-4 relative z-10">
            Takes about 2 minutes.
          </p>
        </div>
      </div>
    )
  }

  // ── 4-step wizard ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-warm-white flex flex-col">
      {/* Header */}
      <nav className="px-8 py-5 flex items-center justify-between border-b border-border">
        <span className="font-display text-2xl font-bold text-navy">
          ROSTA<span className="text-lime">.</span>
        </span>
        <span className="text-sm text-body-grey">Step {step} of 4</span>
      </nav>

      {/* Progress */}
      <div className="h-0.5 bg-border">
        <div
          className="h-full bg-navy transition-all duration-500 ease-out"
          style={{ width: `${(step / 4) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">

          {/* ── Step 1: Identity ── */}
          {step === 1 && (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-navy text-xs font-medium tracking-widest uppercase mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
                  Step 1
                </p>
                <h1 className="font-display text-4xl font-bold text-navy">Who are you?</h1>
                <p className="text-body-grey mt-2">
                  This is how other members will find and recognise you.
                </p>
              </div>

              {/* Avatar upload */}
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="relative w-24 h-24 rounded-full border-2 border-dashed border-border bg-surface hover:border-navy transition-colors flex items-center justify-center overflow-hidden group"
                >
                  {form.avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-body-grey text-xs text-center px-2 group-hover:text-navy transition-colors leading-tight">
                      Upload<br />photo
                    </span>
                  )}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                {form.avatarPreview && (
                  <button
                    type="button"
                    onClick={() => update({ avatarFile: null, avatarPreview: '' })}
                    className="text-xs text-body-grey hover:text-navy transition-colors"
                  >
                    Remove photo
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First name"
                  id="first-name"
                  type="text"
                  placeholder="Alex"
                  value={form.firstName}
                  onChange={e => update({ firstName: e.target.value })}
                  autoComplete="given-name"
                />
                <Input
                  label="Last name"
                  id="last-name"
                  type="text"
                  placeholder="Morgan"
                  value={form.lastName}
                  onChange={e => update({ lastName: e.target.value })}
                  autoComplete="family-name"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">
                  Username{' '}
                  <span className="text-body-grey font-normal">(optional)</span>
                </label>
                <div className="flex items-center rounded-xl border border-border bg-white overflow-hidden focus-within:ring-2 focus-within:ring-navy/20 focus-within:border-navy transition-colors">
                  <span className="pl-4 pr-1 text-body-grey text-sm select-none shrink-0">
                    onrosta.com/profile/
                  </span>
                  <input
                    type="text"
                    value={form.username}
                    onChange={e => update({ username: e.target.value.toLowerCase() })}
                    placeholder="your-name"
                    maxLength={30}
                    className="flex-1 py-3 pr-4 bg-transparent text-navy placeholder-body-grey focus:outline-none text-sm min-w-0"
                  />
                </div>
                {form.username && (
                  <p className={`mt-1 text-xs ${
                    usernameStatus === 'available' ? 'text-green-700' :
                    usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'text-red-500' :
                    'text-body-grey'
                  }`}>
                    {usernameStatus === 'checking'  && 'Checking…'}
                    {usernameStatus === 'available' && '✓ Available'}
                    {usernameStatus === 'taken'     && 'Already taken'}
                    {usernameStatus === 'invalid'   && 'Lowercase letters, numbers, and hyphens only'}
                  </p>
                )}
                <p className="mt-1 text-xs text-body-grey">
                  You can set or change this later in Settings.
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
              )}

              <Button onClick={saveStep1} loading={loading} size="lg" className="w-full">
                Continue
              </Button>
            </div>
          )}

          {/* ── Step 2: Profile ── */}
          {step === 2 && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-navy text-xs font-medium tracking-widest uppercase mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
                  Step 2
                </p>
                <h1 className="font-display text-4xl font-bold text-navy">Your profile</h1>
                <p className="text-body-grey mt-2">
                  ROSTA profiles are present-tense. What you&apos;re building now matters more than your job title.
                </p>
              </div>

              <Input
                label="What I do"
                id="what-i-do"
                type="text"
                placeholder="Product designer at early-stage startups"
                value={form.whatIDo}
                onChange={e => update({ whatIDo: e.target.value })}
              />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="building-now" className="text-sm font-medium text-navy">
                  Building now <span className="text-red-400 ml-0.5">*</span>
                </label>
                <input
                  id="building-now"
                  type="text"
                  placeholder="A marketplace for creative freelancers"
                  value={form.buildingNow}
                  onChange={e => update({ buildingNow: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-white border border-border rounded-xl text-navy placeholder-body-grey focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-colors"
                />
              </div>

              <Input
                label="Who I want to meet"
                id="who-i-want-to-meet"
                type="text"
                placeholder="Technical co-founders, angel investors"
                value={form.whoIWantToMeet}
                onChange={e => update({ whoIWantToMeet: e.target.value })}
              />
              <LocationPicker
                value={form.whereIOperate}
                onChange={v => update({ whereIOperate: v })}
              />
              <Input
                label="One thing people don't know about me"
                id="fun-fact"
                type="text"
                placeholder="I ran a record label before going into tech"
                value={form.funFact}
                onChange={e => update({ funFact: e.target.value })}
              />

              {error && (
                <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setStep(1)} size="lg" className="flex-1">Back</Button>
                <Button onClick={saveStep2} loading={loading} size="lg" className="flex-1">Continue</Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Signals ── */}
          {step === 3 && (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-navy text-xs font-medium tracking-widest uppercase mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
                  Step 3
                </p>
                <h1 className="font-display text-4xl font-bold text-navy">Your signals</h1>
                <p className="text-body-grey mt-2">
                  Signals are how ROSTA matches you with the right people. The more specific you are, the better your matches.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-navy">Open to</p>
                <div className="flex flex-wrap gap-2">
                  {OPEN_TO_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleOpenTo(opt.value)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                        form.openTo.includes(opt.value)
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
                placeholder="Right now I'm deep in product-market fit research for..."
                value={form.workingOn}
                onChange={e => update({ workingOn: e.target.value })}
                rows={3}
              />
              <Textarea
                label="Need right now"
                id="need-right-now"
                placeholder="An intro to SaaS founders who've gone through Series A..."
                value={form.needRightNow}
                onChange={e => update({ needRightNow: e.target.value })}
                rows={3}
              />

              {error && (
                <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} size="lg" className="flex-1">Back</Button>
                <Button onClick={saveStep3} loading={loading} size="lg" className="flex-1">Continue</Button>
              </div>
            </div>
          )}

          {/* ── Step 4: Profile Mode ── */}
          {step === 4 && (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-navy text-xs font-medium tracking-widest uppercase mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
                  Step 4
                </p>
                <h1 className="font-display text-4xl font-bold text-navy">Your mode</h1>
                <p className="text-body-grey mt-2">
                  Your profile mode helps members understand how to approach you.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {PROFILE_MODES.map(mode => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => update({ profileMode: mode.value })}
                    className={`p-5 rounded-2xl border text-left transition-all ${
                      form.profileMode === mode.value
                        ? 'border-navy bg-navy text-warm-white'
                        : 'border-border bg-white text-navy hover:border-navy'
                    }`}
                  >
                    <p className="font-display text-xl font-bold mb-1">{mode.label}</p>
                    <p className={`text-sm leading-snug ${
                      form.profileMode === mode.value ? 'text-warm-white/70' : 'text-body-grey'
                    }`}>
                      {mode.description}
                    </p>
                  </button>
                ))}
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(3)} size="lg" className="flex-1">Back</Button>
                <Button onClick={saveStep4} loading={loading} size="lg" className="flex-1">Complete profile</Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

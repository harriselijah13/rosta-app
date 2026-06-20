export type Signal = {
  open_to: string[]
  working_on: string | null
  need_right_now: string | null
  updated_at: string
}

export type Profile = {
  id: string
  username: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  what_i_do: string | null
  building_now: string | null
  who_i_want_to_meet: string | null
  where_i_operate: string | null
  fun_fact: string | null
  // @deprecated profile_mode is no longer used in the UI as of 2026-06-20. Column retained for historical data.
  profile_mode: string | null
  onboarding_completed: boolean
  founding_member: boolean
  is_verified: boolean
  verification_status: string
  updated_at: string
  signals: Signal[]
}

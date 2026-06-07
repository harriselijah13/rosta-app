-- Business card scanner
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/gukouwplaofdydbetfoz/sql/new

create table if not exists scanned_cards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text,
  email        text,
  company      text,
  role         text,
  phone        text,
  met_at       text,
  action_taken text not null default 'pending'
                    check (action_taken in ('pending', 'connected', 'invited')),
  scanned_at   timestamptz not null default now()
);

create index if not exists scanned_cards_user_scanned_idx
  on scanned_cards(user_id, scanned_at desc);

alter table scanned_cards enable row level security;

create policy "Users manage their own scanned cards"
  on scanned_cards for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

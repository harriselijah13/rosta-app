-- Open Tables: opt-ins, rooms, members
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gukouwplaofdydbetfoz/sql/new

-- ─── open_table_optins ───────────────────────────────────────────────────────
-- Monthly opt-in ledger. One row = opted in for that period.
-- Absence = not opted in. Period-scoped so no cleanup needed.

create table if not exists open_table_optins (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references profiles(id) on delete cascade,
  period     varchar(7)  not null,  -- 'YYYY-MM'
  created_at timestamptz not null default now(),
  unique (user_id, period)
);

create index if not exists open_table_optins_period_idx on open_table_optins (period);

alter table open_table_optins enable row level security;

create policy "Users can read own optins"
  on open_table_optins for select
  using (auth.uid() = user_id);

create policy "Users can insert own optins"
  on open_table_optins for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own optins"
  on open_table_optins for delete
  using (auth.uid() = user_id);


-- ─── open_table_rooms ────────────────────────────────────────────────────────
-- One row per matched group. Hard-deleted by daily cron after expires_at.

create table if not exists open_table_rooms (
  id         uuid        primary key default gen_random_uuid(),
  period     varchar(7)  not null,
  prompt     text        not null default 'What are you working on right now that you could use outside perspective on?',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists open_table_rooms_period_idx     on open_table_rooms (period);
create index if not exists open_table_rooms_expires_at_idx on open_table_rooms (expires_at);

alter table open_table_rooms enable row level security;

create policy "Members can read their rooms"
  on open_table_rooms for select
  using (
    exists (
      select 1 from open_table_members
      where open_table_members.room_id = open_table_rooms.id
        and open_table_members.user_id = auth.uid()
    )
  );


-- ─── open_table_members ──────────────────────────────────────────────────────
-- Junction: which users are in which room.
-- last_read_at powers unread indicators.

create table if not exists open_table_members (
  id           uuid        primary key default gen_random_uuid(),
  room_id      uuid        not null references open_table_rooms(id) on delete cascade,
  user_id      uuid        not null references profiles(id) on delete cascade,
  last_read_at timestamptz,
  joined_at    timestamptz not null default now(),
  unique (room_id, user_id)
);

create index if not exists open_table_members_room_id_idx on open_table_members (room_id);
create index if not exists open_table_members_user_id_idx on open_table_members (user_id);

alter table open_table_members enable row level security;

create policy "Members can read co-members of their rooms"
  on open_table_members for select
  using (
    exists (
      select 1 from open_table_members as self
      where self.room_id = open_table_members.room_id
        and self.user_id = auth.uid()
    )
  );

create policy "Members can update own last_read_at"
  on open_table_members for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ─── open_table_messages ─────────────────────────────────────────────────────
-- Group thread messages. Cascade-deleted when the room is deleted.

create table if not exists open_table_messages (
  id         uuid        primary key default gen_random_uuid(),
  room_id    uuid        not null references open_table_rooms(id) on delete cascade,
  sender_id  uuid        not null references profiles(id) on delete cascade,
  content    text        not null,
  created_at timestamptz not null default now()
);

create index if not exists open_table_messages_room_id_idx on open_table_messages (room_id, created_at);

alter table open_table_messages enable row level security;

create policy "Members can read messages in their rooms"
  on open_table_messages for select
  using (
    exists (
      select 1 from open_table_members
      where open_table_members.room_id = open_table_messages.room_id
        and open_table_members.user_id = auth.uid()
    )
  );

create policy "Members can send messages in their rooms"
  on open_table_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from open_table_members
      where open_table_members.room_id = open_table_messages.room_id
        and open_table_members.user_id = auth.uid()
    )
  );

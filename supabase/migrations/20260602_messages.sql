-- Week 4: Messaging
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/gukouwplaofdydbetfoz/sql/new

-- 1. conversations (one per connection pair)
create table if not exists conversations (
  id               uuid primary key default gen_random_uuid(),
  user_a           uuid not null references auth.users(id),
  user_b           uuid not null references auth.users(id),
  last_message_at  timestamptz,
  nudge_sent_at    timestamptz,
  created_at       timestamptz not null default now(),
  constraint conversations_canonical check (user_a < user_b),
  constraint conversations_unique unique (user_a, user_b)
);

-- 2. messages
create table if not exists messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations(id) on delete cascade,
  sender_id        uuid not null references auth.users(id),
  body             text not null check (char_length(body) between 1 and 2000),
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on messages(conversation_id, created_at desc);

-- 3. last_active_at on profiles (for 24h email suppression)
alter table profiles
  add column if not exists last_active_at timestamptz;

-- 4. RLS: conversations
alter table conversations enable row level security;

create policy "conversation members can read"
  on conversations for select
  using (auth.uid() = user_a or auth.uid() = user_b);

-- server-side inserts use service role key — no insert policy needed for authenticated users

-- 5. RLS: messages
alter table messages enable row level security;

create policy "conversation members can read messages"
  on messages for select
  using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

create policy "sender can insert"
  on messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

create policy "recipient can mark read"
  on messages for update
  using (
    sender_id != auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  )
  with check (true);

-- 6. Realtime — enable for messages table
alter publication supabase_realtime add table messages;

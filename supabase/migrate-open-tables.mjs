const TOKEN = 'REDACTED'
const REF = 'gukouwplaofdydbetfoz'

async function sql(label, query) {
  process.stdout.write(`  ${label}... `)
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text}`)
  console.log('done')
  return JSON.parse(text)
}

async function policyExists(table, name) {
  const rows = await sql(
    `check policy "${name}"`,
    `select 1 from pg_policies where tablename = '${table}' and policyname = '${name}'`
  )
  return Array.isArray(rows) && rows.length > 0
}

async function run() {
  // ── open_table_optins ──────────────────────────────────────────────────────
  await sql('create open_table_optins', `
    create table if not exists open_table_optins (
      id         uuid        primary key default gen_random_uuid(),
      user_id    uuid        not null references profiles(id) on delete cascade,
      period     varchar(7)  not null,
      created_at timestamptz not null default now(),
      unique (user_id, period)
    )
  `)

  await sql('index open_table_optins(period)', `
    create index if not exists open_table_optins_period_idx on open_table_optins (period)
  `)

  await sql('enable RLS open_table_optins', `
    alter table open_table_optins enable row level security
  `)

  if (!await policyExists('open_table_optins', 'Users can read own optins')) {
    await sql('optins read policy', `
      create policy "Users can read own optins"
        on open_table_optins for select
        using (auth.uid() = user_id)
    `)
  }

  if (!await policyExists('open_table_optins', 'Users can insert own optins')) {
    await sql('optins insert policy', `
      create policy "Users can insert own optins"
        on open_table_optins for insert
        with check (auth.uid() = user_id)
    `)
  }

  if (!await policyExists('open_table_optins', 'Users can delete own optins')) {
    await sql('optins delete policy', `
      create policy "Users can delete own optins"
        on open_table_optins for delete
        using (auth.uid() = user_id)
    `)
  }

  // ── open_table_rooms ───────────────────────────────────────────────────────
  await sql('create open_table_rooms', `
    create table if not exists open_table_rooms (
      id         uuid        primary key default gen_random_uuid(),
      period     varchar(7)  not null,
      prompt     text        not null default 'What are you working on right now that you could use outside perspective on?',
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `)

  await sql('index open_table_rooms(period)', `
    create index if not exists open_table_rooms_period_idx on open_table_rooms (period)
  `)

  await sql('index open_table_rooms(expires_at)', `
    create index if not exists open_table_rooms_expires_at_idx on open_table_rooms (expires_at)
  `)

  await sql('enable RLS open_table_rooms', `
    alter table open_table_rooms enable row level security
  `)

  // ── open_table_members ─────────────────────────────────────────────────────
  // Must exist before the rooms SELECT policy (which references it)
  await sql('create open_table_members', `
    create table if not exists open_table_members (
      id           uuid        primary key default gen_random_uuid(),
      room_id      uuid        not null references open_table_rooms(id) on delete cascade,
      user_id      uuid        not null references profiles(id) on delete cascade,
      last_read_at timestamptz,
      joined_at    timestamptz not null default now(),
      unique (room_id, user_id)
    )
  `)

  await sql('index open_table_members(room_id)', `
    create index if not exists open_table_members_room_id_idx on open_table_members (room_id)
  `)

  await sql('index open_table_members(user_id)', `
    create index if not exists open_table_members_user_id_idx on open_table_members (user_id)
  `)

  await sql('enable RLS open_table_members', `
    alter table open_table_members enable row level security
  `)

  // Now add the rooms SELECT policy (depends on members table existing)
  if (!await policyExists('open_table_rooms', 'Members can read their rooms')) {
    await sql('rooms read policy', `
      create policy "Members can read their rooms"
        on open_table_rooms for select
        using (
          exists (
            select 1 from open_table_members
            where open_table_members.room_id = open_table_rooms.id
              and open_table_members.user_id = auth.uid()
          )
        )
    `)
  }

  if (!await policyExists('open_table_members', 'Members can read co-members of their rooms')) {
    await sql('members read policy', `
      create policy "Members can read co-members of their rooms"
        on open_table_members for select
        using (
          exists (
            select 1 from open_table_members as self
            where self.room_id = open_table_members.room_id
              and self.user_id = auth.uid()
          )
        )
    `)
  }

  if (!await policyExists('open_table_members', 'Members can update own last_read_at')) {
    await sql('members update policy', `
      create policy "Members can update own last_read_at"
        on open_table_members for update
        using  (auth.uid() = user_id)
        with check (auth.uid() = user_id)
    `)
  }

  // ── open_table_messages ────────────────────────────────────────────────────
  await sql('create open_table_messages', `
    create table if not exists open_table_messages (
      id         uuid        primary key default gen_random_uuid(),
      room_id    uuid        not null references open_table_rooms(id) on delete cascade,
      sender_id  uuid        not null references profiles(id) on delete cascade,
      content    text        not null,
      created_at timestamptz not null default now()
    )
  `)

  await sql('index open_table_messages(room_id, created_at)', `
    create index if not exists open_table_messages_room_id_idx
      on open_table_messages (room_id, created_at)
  `)

  await sql('enable RLS open_table_messages', `
    alter table open_table_messages enable row level security
  `)

  if (!await policyExists('open_table_messages', 'Members can read messages in their rooms')) {
    await sql('messages read policy', `
      create policy "Members can read messages in their rooms"
        on open_table_messages for select
        using (
          exists (
            select 1 from open_table_members
            where open_table_members.room_id = open_table_messages.room_id
              and open_table_members.user_id = auth.uid()
          )
        )
    `)
  }

  if (!await policyExists('open_table_messages', 'Members can send messages in their rooms')) {
    await sql('messages insert policy', `
      create policy "Members can send messages in their rooms"
        on open_table_messages for insert
        with check (
          auth.uid() = sender_id
          and exists (
            select 1 from open_table_members
            where open_table_members.room_id = open_table_messages.room_id
              and open_table_members.user_id = auth.uid()
          )
        )
    `)
  }

  await sql('add open_table_messages to realtime', `
    alter publication supabase_realtime add table open_table_messages
  `)

  console.log('\nMigration complete.')
}

run().catch(e => { console.error('\nFAILED:', e.message); process.exit(1) })

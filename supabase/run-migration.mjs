const TOKEN = 'sbp_711cf3823a62a0e7cca63388d6b4a71d92bec4f0'
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
  await sql('create conversations table', `
    create table if not exists conversations (
      id               uuid primary key default gen_random_uuid(),
      user_a           uuid not null references auth.users(id),
      user_b           uuid not null references auth.users(id),
      last_message_at  timestamptz,
      nudge_sent_at    timestamptz,
      created_at       timestamptz not null default now(),
      constraint conversations_canonical check (user_a < user_b),
      constraint conversations_unique unique (user_a, user_b)
    )
  `)

  // Drop and recreate messages — previous version had wrong column name (connection_id)
  await sql('drop old messages table', `drop table if exists messages cascade`)

  await sql('create messages table', `
    create table messages (
      id               uuid primary key default gen_random_uuid(),
      conversation_id  uuid not null references conversations(id) on delete cascade,
      sender_id        uuid not null references auth.users(id),
      body             text not null check (char_length(body) between 1 and 2000),
      read_at          timestamptz,
      created_at       timestamptz not null default now()
    )
  `)

  await sql('create messages index', `
    create index messages_conversation_created_idx
      on messages(conversation_id, created_at desc)
  `)

  await sql('add last_active_at to profiles', `
    alter table profiles add column if not exists last_active_at timestamptz
  `)

  await sql('enable RLS on conversations', `alter table conversations enable row level security`)
  await sql('enable RLS on messages', `alter table messages enable row level security`)

  const p1 = await policyExists('conversations', 'conversation members can read')
  if (!p1) {
    await sql('conversations read policy', `
      create policy "conversation members can read"
        on conversations for select
        using (auth.uid() = user_a or auth.uid() = user_b)
    `)
  }

  const p2 = await policyExists('messages', 'conversation members can read messages')
  if (!p2) {
    await sql('messages read policy', `
      create policy "conversation members can read messages"
        on messages for select
        using (
          exists (
            select 1 from conversations c
            where c.id = messages.conversation_id
              and (c.user_a = auth.uid() or c.user_b = auth.uid())
          )
        )
    `)
  }

  const p3 = await policyExists('messages', 'sender can insert')
  if (!p3) {
    await sql('messages insert policy', `
      create policy "sender can insert"
        on messages for insert
        with check (
          sender_id = auth.uid()
          and exists (
            select 1 from conversations c
            where c.id = conversation_id
              and (c.user_a = auth.uid() or c.user_b = auth.uid())
          )
        )
    `)
  }

  const p4 = await policyExists('messages', 'recipient can mark read')
  if (!p4) {
    await sql('messages update policy', `
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
        with check (true)
    `)
  }

  await sql('add messages to realtime publication', `
    alter publication supabase_realtime add table messages
  `)

  console.log('\nMigration complete.')
}

run().catch(e => { console.error('\nFAILED:', e.message); process.exit(1) })

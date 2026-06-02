const TOKEN = 'sbp_711cf3823a62a0e7cca63388d6b4a71d92bec4f0'
const REF = 'gukouwplaofdydbetfoz'

async function sql(label, query) {
  process.stdout.write(`  ${label}... `)
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t}`)
  console.log('done')
}

async function policyExists(table, name) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `select 1 from pg_policies where tablename='${table}' and policyname='${name}'` }),
  })
  const rows = await r.json()
  return Array.isArray(rows) && rows.length > 0
}

async function run() {
  await sql('create outcomes table', `
    create table if not exists outcomes (
      id              uuid primary key default gen_random_uuid(),
      conversation_id uuid not null references conversations(id) on delete cascade,
      marked_by       uuid not null references auth.users(id),
      created_at      timestamptz not null default now(),
      constraint outcomes_one_per_conversation unique (conversation_id)
    )
  `)

  await sql('enable RLS on outcomes', `alter table outcomes enable row level security`)

  if (!await policyExists('outcomes', 'conversation members can read')) {
    await sql('outcomes read policy', `
      create policy "conversation members can read"
        on outcomes for select
        using (
          exists (
            select 1 from conversations c
            where c.id = outcomes.conversation_id
              and (c.user_a = auth.uid() or c.user_b = auth.uid())
          )
        )
    `)
  } else {
    console.log('  outcomes read policy... exists')
  }

  if (!await policyExists('outcomes', 'conversation member can mark')) {
    await sql('outcomes insert policy', `
      create policy "conversation member can mark"
        on outcomes for insert
        with check (
          marked_by = auth.uid()
          and exists (
            select 1 from conversations c
            where c.id = conversation_id
              and (c.user_a = auth.uid() or c.user_b = auth.uid())
          )
        )
    `)
  } else {
    console.log('  outcomes insert policy... exists')
  }

  await sql('invite_codes: add used_by + used_at', `
    alter table invite_codes
      add column if not exists used_by uuid references auth.users(id),
      add column if not exists used_at timestamptz
  `)

  await sql('profiles: add founding_member', `
    alter table profiles
      add column if not exists founding_member boolean not null default false
  `)

  await sql('intro_requests: add thank_you_at', `
    alter table intro_requests
      add column if not exists thank_you_at timestamptz
  `)

  console.log('\nAll Week 5 migrations complete.')
}

run().catch(e => { console.error('\nFAILED:', e.message); process.exit(1) })

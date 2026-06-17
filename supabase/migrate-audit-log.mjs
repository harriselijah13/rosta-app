const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const REF   = 'gukouwplaofdydbetfoz'

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

async function run() {
  await sql('create admin_audit_log', `
    create table if not exists admin_audit_log (
      id             uuid        primary key default gen_random_uuid(),
      admin_user_id  uuid        not null references auth.users(id),
      action         text        not null,
      target_user_id uuid        references auth.users(id),
      details        jsonb,
      created_at     timestamptz not null default now()
    )
  `)

  await sql('index on admin_user_id + created_at', `
    create index if not exists admin_audit_log_admin_created_idx
      on admin_audit_log(admin_user_id, created_at desc)
  `)

  await sql('index on action + created_at', `
    create index if not exists admin_audit_log_action_created_idx
      on admin_audit_log(action, created_at desc)
  `)

  await sql('enable RLS', `
    alter table admin_audit_log enable row level security
  `)

  console.log('\nMigration complete.')
}

run().catch(e => { console.error('\nFAILED:', e.message); process.exit(1) })

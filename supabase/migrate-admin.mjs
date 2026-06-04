const TOKEN = 'sbp_711cf3823a62a0e7cca63388d6b4a71d92bec4f0'
const REF   = 'gukouwplaofdydbetfoz'
const ADMIN_EMAIL = 'harriselijah8@googlemail.com'

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
  // 1. is_admin column on profiles
  await sql('add profiles.is_admin', `
    alter table profiles
      add column if not exists is_admin boolean not null default false
  `)

  // 2. label column on invite_codes
  await sql('add invite_codes.label', `
    alter table invite_codes
      add column if not exists label text
  `)

  // 3. cron_runs table
  await sql('create cron_runs', `
    create table if not exists cron_runs (
      cron_name   text        primary key,
      last_ran_at timestamptz not null default now(),
      status      text        not null check (status in ('ok', 'error')),
      detail      text
    )
  `)
  await sql('enable RLS cron_runs', `alter table cron_runs enable row level security`)

  // 4. admin_email_logs table
  await sql('create admin_email_logs', `
    create table if not exists admin_email_logs (
      id              uuid        primary key default gen_random_uuid(),
      sent_at         timestamptz not null default now(),
      sent_by         uuid        not null references profiles(id),
      scope           text        not null,
      subject         text        not null,
      recipient_count integer     not null default 1,
      recipient_email text
    )
  `)
  await sql('index admin_email_logs(sent_at)', `
    create index if not exists admin_email_logs_sent_at_idx
      on admin_email_logs (sent_at desc)
  `)
  await sql('enable RLS admin_email_logs', `alter table admin_email_logs enable row level security`)

  // 5. Set is_admin = true for the owner account
  const rows = await sql(`set is_admin for ${ADMIN_EMAIL}`, `
    update profiles
    set is_admin = true
    where id = (
      select id from auth.users where email = '${ADMIN_EMAIL}'
    )
    returning id
  `)
  if (!rows?.length) {
    console.warn('  WARNING: no profile row updated — check email matches auth.users')
  } else {
    console.log(`  → is_admin set for profile ${rows[0].id}`)
  }

  console.log('\nMigration complete.')
}

run().catch(e => { console.error('\nFAILED:', e.message); process.exit(1) })

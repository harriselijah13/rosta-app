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

async function policyExists(table, name) {
  const rows = await sql(`check policy "${name}"`,
    `select 1 from pg_policies where tablename = '${table}' and policyname = '${name}'`)
  return Array.isArray(rows) && rows.length > 0
}

async function run() {
  // ── profiles additions ────────────────────────────────────────────────────
  await sql('add profiles.is_verified', `
    alter table profiles
      add column if not exists is_verified boolean not null default false
  `)
  await sql('add profiles.verification_status', `
    alter table profiles
      add column if not exists verification_status text not null default 'none'
  `)
  // Add check constraint only if it doesn't already exist
  await sql('add verification_status check', `
    do $$ begin
      if not exists (
        select 1 from pg_constraint
        where conname = 'profiles_verification_status_check'
      ) then
        alter table profiles add constraint profiles_verification_status_check
          check (verification_status in ('none','pending','approved','rejected'));
      end if;
    end $$
  `)

  // ── verification_requests ─────────────────────────────────────────────────
  await sql('create verification_requests', `
    create table if not exists verification_requests (
      id                       uuid        primary key default gen_random_uuid(),
      user_id                  uuid        not null references profiles(id) on delete cascade,
      status                   text        not null default 'pending',
      statement                text        not null,
      submitted_at             timestamptz not null default now(),
      reviewed_at              timestamptz,
      reviewed_by              uuid        references profiles(id),
      rejection_reason         text,
      price_id_used            text,
      stripe_payment_intent_id text,
      stripe_payment_status    text        not null default 'unpaid',
      constraint verification_requests_status_check
        check (status in ('pending','approved','rejected')),
      constraint verification_requests_payment_status_check
        check (stripe_payment_status in ('unpaid','paid'))
    )
  `)
  await sql('partial unique index (one pending per user)', `
    create unique index if not exists verification_requests_one_pending_per_user
      on verification_requests (user_id)
      where status = 'pending'
  `)
  await sql('index verification_requests(user_id)', `
    create index if not exists verification_requests_user_id_idx
      on verification_requests (user_id)
  `)
  await sql('index verification_requests(status)', `
    create index if not exists verification_requests_status_idx
      on verification_requests (status)
  `)
  await sql('enable RLS verification_requests', `
    alter table verification_requests enable row level security
  `)
  if (!await policyExists('verification_requests', 'Users can read own verification requests')) {
    await sql('read policy', `
      create policy "Users can read own verification requests"
        on verification_requests for select
        using (auth.uid() = user_id)
    `)
  }
  if (!await policyExists('verification_requests', 'Users can submit verification requests')) {
    await sql('insert policy', `
      create policy "Users can submit verification requests"
        on verification_requests for insert
        with check (auth.uid() = user_id)
    `)
  }

  // ── verification_pricing ──────────────────────────────────────────────────
  await sql('create verification_pricing', `
    create table if not exists verification_pricing (
      id              uuid           primary key default gen_random_uuid(),
      tier            text           not null unique,
      price_aed       decimal(10,2)  not null default 0,
      stripe_price_id text           not null,
      is_active       boolean        not null default true,
      constraint verification_pricing_tier_check
        check (tier in ('standard','founding','connector'))
    )
  `)
  await sql('enable RLS verification_pricing', `
    alter table verification_pricing enable row level security
  `)
  if (!await policyExists('verification_pricing', 'Authenticated users can read pricing')) {
    await sql('pricing read policy', `
      create policy "Authenticated users can read pricing"
        on verification_pricing for select
        using (auth.role() = 'authenticated')
    `)
  }
  await sql('seed verification_pricing', `
    insert into verification_pricing (tier, price_aed, stripe_price_id) values
      ('standard',  0, 'price_1TehSZEGQyufDzjDus9kl72R'),
      ('founding',  0, 'price_1TehSZEGQyufDzjD1FCnF4G9'),
      ('connector', 0, 'price_1TehSZEGQyufDzjDNgdU8a1z')
    on conflict (tier) do nothing
  `)

  console.log('\nMigration complete.')
}

run().catch(e => { console.error('\nFAILED:', e.message); process.exit(1) })

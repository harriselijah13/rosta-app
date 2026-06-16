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
  await sql('add profiles.onboarding_reminder_sent', `
    alter table profiles
      add column if not exists onboarding_reminder_sent boolean not null default false
  `)
  console.log('\nMigration complete.')
}

run().catch(e => { console.error('\nFAILED:', e.message); process.exit(1) })

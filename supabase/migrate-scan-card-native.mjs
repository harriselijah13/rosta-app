const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
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

async function run() {
  await sql('add location column',  `ALTER TABLE scanned_cards ADD COLUMN IF NOT EXISTS location text`)
  await sql('add date_met column',  `ALTER TABLE scanned_cards ADD COLUMN IF NOT EXISTS date_met date`)
  await sql('add notes column',     `ALTER TABLE scanned_cards ADD COLUMN IF NOT EXISTS notes    text`)

  console.log('\nMigration complete.')
}

run().catch(e => { console.error('\nFAILED:', e.message); process.exit(1) })

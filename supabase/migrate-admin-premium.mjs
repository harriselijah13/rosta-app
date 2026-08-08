const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const REF   = 'gukouwplaofdydbetfoz'

async function sql(label, query) {
  process.stdout.write(`  ${label}... `)
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query }),
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text}`)
  console.log('done')
  return JSON.parse(text)
}

async function run() {
  await sql('add premium_source column', `
    ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS premium_source     TEXT        CHECK (premium_source IN ('paid', 'admin_granted')),
      ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ
  `)

  await sql('schedule expire-admin-premium cron', `
    SELECT cron.schedule(
      'expire-admin-premium',
      '5 0 * * *',
      $$
        UPDATE profiles
        SET
          is_premium         = false,
          premium_source     = null,
          premium_expires_at = null
        WHERE premium_source     = 'admin_granted'
          AND premium_expires_at IS NOT NULL
          AND premium_expires_at < NOW()
          AND is_premium         = true
      $$
    )
  `)

  console.log('\nMigration complete.')
}

run().catch(e => { console.error('\nFAILED:', e.message); process.exit(1) })

const TOKEN = 'REDACTED'
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
  // Create the trigger function
  await sql('create trigger function auto_complete_onboarding()', `
    CREATE OR REPLACE FUNCTION auto_complete_onboarding()
    RETURNS TRIGGER AS $$
    BEGIN
      IF  NEW.first_name   IS NOT NULL AND trim(NEW.first_name)   <> ''
      AND NEW.last_name    IS NOT NULL AND trim(NEW.last_name)    <> ''
      AND NEW.building_now IS NOT NULL AND trim(NEW.building_now) <> ''
      AND NEW.profile_mode IS NOT NULL AND trim(NEW.profile_mode) <> ''
      THEN
        NEW.onboarding_completed := true;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `)

  // Drop old trigger if it exists, then create fresh
  await sql('drop trigger if exists trg_auto_complete_onboarding', `
    DROP TRIGGER IF EXISTS trg_auto_complete_onboarding ON profiles
  `)

  await sql('create trigger trg_auto_complete_onboarding', `
    CREATE TRIGGER trg_auto_complete_onboarding
      BEFORE UPDATE ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION auto_complete_onboarding()
  `)

  // Verify the trigger exists
  const triggers = await sql('verify trigger exists', `
    SELECT trigger_name, event_manipulation, action_timing
    FROM information_schema.triggers
    WHERE event_object_table = 'profiles'
    AND trigger_name = 'trg_auto_complete_onboarding'
  `)

  if (triggers.length > 0) {
    console.log(`\n  Trigger confirmed: ${triggers[0].trigger_name} (${triggers[0].action_timing} ${triggers[0].event_manipulation})`)
  } else {
    console.error('\n  WARNING: trigger not found after creation')
  }

  console.log('\nMigration complete.')
}

run().catch(e => { console.error('\nFAILED:', e.message); process.exit(1) })

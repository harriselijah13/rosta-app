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
  // ── badges catalog ────────────────────────────────────────────────────────
  await sql('create badges table', `
    CREATE TABLE IF NOT EXISTS badges (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug        TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      description TEXT NOT NULL,
      visual_type TEXT NOT NULL,
      tier        TEXT NOT NULL CHECK (tier IN ('status', 'activity', 'milestone'))
    )
  `)

  await sql('enable RLS badges', `ALTER TABLE badges ENABLE ROW LEVEL SECURITY`)

  await sql('badges read policy', `
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'badges' AND policyname = 'Anyone can read badges'
      ) THEN
        CREATE POLICY "Anyone can read badges" ON badges FOR SELECT USING (true);
      END IF;
    END $$
  `)

  // ── member_badges ─────────────────────────────────────────────────────────
  await sql('create member_badges table', `
    CREATE TABLE IF NOT EXISTS member_badges (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      badge_slug TEXT NOT NULL REFERENCES badges(slug) ON DELETE CASCADE,
      earned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, badge_slug)
    )
  `)

  await sql('index member_badges(user_id)', `
    CREATE INDEX IF NOT EXISTS member_badges_user_id_idx ON member_badges(user_id)
  `)

  await sql('enable RLS member_badges', `ALTER TABLE member_badges ENABLE ROW LEVEL SECURITY`)

  await sql('member_badges read policy', `
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'member_badges' AND policyname = 'Authenticated users can read member badges'
      ) THEN
        CREATE POLICY "Authenticated users can read member badges"
          ON member_badges FOR SELECT USING (auth.role() = 'authenticated');
      END IF;
    END $$
  `)

  // ── profiles additions ────────────────────────────────────────────────────
  await sql('add profiles.signal_score_last_awarded', `
    ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS signal_score_last_awarded DATE
  `)

  await sql('add profiles.open_door_days', `
    ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS open_door_days INT NOT NULL DEFAULT 0
  `)

  await sql('add profiles.signal_streak', `
    ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS signal_streak INT NOT NULL DEFAULT 0
  `)

  await sql('add profiles.signal_streak_last_week', `
    ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS signal_streak_last_week DATE
  `)

  // ── verify ────────────────────────────────────────────────────────────────
  const tables = await sql('verify tables exist', `
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('badges', 'member_badges')
    ORDER BY table_name
  `)
  console.log('  Tables:', tables.map(t => t.table_name).join(', '))

  const cols = await sql('verify profile columns', `
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name IN ('signal_score_last_awarded', 'open_door_days', 'signal_streak', 'signal_streak_last_week')
    ORDER BY column_name
  `)
  console.log('  New profile columns:', cols.map(c => c.column_name).join(', '))

  console.log('\nMigration complete.')
}

run().catch(e => { console.error('\nFAILED:', e.message); process.exit(1) })

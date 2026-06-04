import { createAdminClient } from './supabase/admin'

export async function recordCronRun(
  cronName: string,
  status: 'ok' | 'error',
  detail?: string,
): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('cron_runs').upsert(
      { cron_name: cronName, last_ran_at: new Date().toISOString(), status, detail: detail ?? null },
      { onConflict: 'cron_name' },
    )
  } catch {
    // Recording failure should never crash the cron itself
    console.error('[cron-recorder] failed to record run for', cronName)
  }
}

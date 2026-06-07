-- Add report_sent flag to invite_codes (used by event-reports cron)
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/gukouwplaofdydbetfoz/sql/new

alter table invite_codes
  add column if not exists report_sent boolean not null default false;

create table if not exists notifications (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references profiles(id) on delete cascade,
  type        text        not null check (type in (
                'reaction_can_help',
                'reaction_know_someone',
                'post_forwarded'
              )),
  payload     jsonb       not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_notifications_user_unread
  on notifications(user_id, created_at desc)
  where read_at is null;

create index idx_notifications_user_all
  on notifications(user_id, created_at desc);

alter table notifications enable row level security;

create policy "Users read own notifications"
  on notifications for select
  using (auth.uid() = user_id);

create policy "Users update own notifications"
  on notifications for update
  using (auth.uid() = user_id);

-- No insert policy for authenticated users — inserts happen via service role only

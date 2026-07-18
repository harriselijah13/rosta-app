-- Allow authenticated users to delete their own notification rows.
-- Without this policy, the native client (anon key, RLS enabled) cannot delete
-- notifications — Supabase silently returns no error but leaves the row in place,
-- causing deleted notifications to reappear on the next screen load.
CREATE POLICY "users_delete_own_notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

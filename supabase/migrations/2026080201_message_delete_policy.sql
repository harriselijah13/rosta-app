-- Allow message senders to delete their own messages.
-- Native app uses anon key + user JWT and needs this RLS policy.
-- "Delete for me" in the UI maps to a physical delete; since ROSTA
-- conversations are 1:1, removing a message removes it for both parties.

CREATE POLICY "sender can delete own messages"
  ON messages FOR DELETE
  USING (sender_id = auth.uid());

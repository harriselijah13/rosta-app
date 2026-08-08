-- Allow the viewed user to delete (dismiss) individual profile view rows.
-- Mirrors profile_views_select_own: only the subject of the view can act on it.
-- Hard delete is correct here — a dismissed viewer can view again in future
-- and the new row will re-appear, which is the intended product behaviour.
-- (A persistent dismiss table like matchmaker_dismissals would suppress future
-- views, which is NOT what we want.)

CREATE POLICY "profile_views_delete_own"
  ON profile_views FOR DELETE
  USING (viewed_id = auth.uid());

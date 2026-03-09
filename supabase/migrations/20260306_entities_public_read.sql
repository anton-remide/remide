-- Fix: Allow anonymous users to read entities (blur paywall is frontend-only)
-- Previously only authenticated users could read entities, causing 0 count on landing page
CREATE POLICY "entities_select_public"
  ON entities FOR SELECT USING (true);

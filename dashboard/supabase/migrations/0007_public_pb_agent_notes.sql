-- OPTIONAL MIGRATION (public page). Grants the anon role read access.
-- Skip this file, and 0006, 0007, 0012 to 0015, if you do not want a
-- public page. See 0006_public_summary_view.sql for what gets exposed.
--
-- Coach notes for /public — one current note per agent, rotated weekly by
-- Holy/Coach. Single source of truth for "Notes from the crew" section.
--
-- Privacy: only the note text itself is exposed. No internal IDs, no
-- author metadata, no historical audit trail (just current).

CREATE TABLE IF NOT EXISTS public.agent_notes (
  agent_key  text PRIMARY KEY CHECK (agent_key IN ('coach', 'nutri', 'doc', 'mind')),
  note       text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_notes_anon_read ON public.agent_notes;
CREATE POLICY agent_notes_anon_read
  ON public.agent_notes
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Anon-readable view (matches existing public_pb_* convention).
CREATE OR REPLACE VIEW public.public_pb_agent_notes AS
SELECT agent_key, note, updated_at
FROM public.agent_notes;

GRANT SELECT ON public.public_pb_agent_notes TO anon, authenticated;

-- Seed initial week (idempotent — re-running upserts).
INSERT INTO public.agent_notes (agent_key, note) VALUES
  ('coach', 'Volume held this week — base is doing its job. Quality block opens once we clear the next cutback.'),
  ('nutri', 'Iron is steady, ferritin trending the right way. Keep red lentils + sardines twice a week.'),
  ('doc',   'HRV pattern is healthy. No flags this week. Bloods due in three weeks.'),
  ('mind',  'Pre-session focus quality was up. The mental warm-up is becoming routine.')
ON CONFLICT (agent_key) DO UPDATE
  SET note = EXCLUDED.note, updated_at = now();

BEGIN;

ALTER TABLE legacy_tree_members
  ADD COLUMN IF NOT EXISTS line_partner_type TEXT,
  ADD COLUMN IF NOT EXISTS line_partner_id TEXT;
ALTER TABLE family_placeholders
  ADD COLUMN IF NOT EXISTS line_partner_type TEXT,
  ADD COLUMN IF NOT EXISTS line_partner_id TEXT;
ALTER TABLE future_moment_makers
  ADD COLUMN IF NOT EXISTS line_partner_type TEXT,
  ADD COLUMN IF NOT EXISTS line_partner_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legacy_tree_members_line_partner_check' AND conrelid = 'legacy_tree_members'::regclass) THEN
    ALTER TABLE legacy_tree_members ADD CONSTRAINT legacy_tree_members_line_partner_check
      CHECK ((line_partner_type IS NULL AND line_partner_id IS NULL) OR
             (line_partner_type IS NOT NULL AND line_partner_type IN ('member', 'placeholder', 'future') AND line_partner_id IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'family_placeholders_line_partner_check' AND conrelid = 'family_placeholders'::regclass) THEN
    ALTER TABLE family_placeholders ADD CONSTRAINT family_placeholders_line_partner_check
      CHECK ((line_partner_type IS NULL AND line_partner_id IS NULL) OR
             (line_partner_type IS NOT NULL AND line_partner_type IN ('member', 'placeholder', 'future') AND line_partner_id IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'future_moment_makers_line_partner_check' AND conrelid = 'future_moment_makers'::regclass) THEN
    ALTER TABLE future_moment_makers ADD CONSTRAINT future_moment_makers_line_partner_check
      CHECK ((line_partner_type IS NULL AND line_partner_id IS NULL) OR
             (line_partner_type IS NOT NULL AND line_partner_type IN ('member', 'placeholder', 'future') AND line_partner_id IS NOT NULL));
  END IF;
END $$;

INSERT INTO schema_migrations (version)
VALUES ('025_tree_family_lines')
ON CONFLICT (version) DO NOTHING;

COMMIT;

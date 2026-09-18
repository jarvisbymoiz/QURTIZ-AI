-- Display-only corrections; original delivery fields remain immutable.
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS internal_edits jsonb NOT NULL DEFAULT '{}'::jsonb;

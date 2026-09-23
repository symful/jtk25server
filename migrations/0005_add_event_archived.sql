-- Add is_archived to events for tugas archiving feature
ALTER TABLE events ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;

-- Index for filtering archived vs non-archived events
CREATE INDEX IF NOT EXISTS idx_events_archived ON events(is_archived);

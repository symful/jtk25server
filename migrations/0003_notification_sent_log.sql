-- Notification dedup: track sent notifications to avoid duplicates
-- Key format is caller's choice, e.g. {type}:{classCode}:{dateISO}:{slotStart}

CREATE TABLE IF NOT EXISTS notification_sent_log (
  key TEXT PRIMARY KEY,
  sent_at INTEGER NOT NULL
);

-- Index on sent_at for efficient pruning of rows older than 24h
CREATE INDEX IF NOT EXISTS idx_notification_sent_log_sent_at ON notification_sent_log (sent_at);

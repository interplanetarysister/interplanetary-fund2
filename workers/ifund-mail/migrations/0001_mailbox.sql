-- Private company mailbox metadata; MIME originals are stored in R2.
CREATE TABLE IF NOT EXISTS mailbox_messages (
  id TEXT PRIMARY KEY NOT NULL,
  recipient TEXT NOT NULL,
  sender TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview TEXT NOT NULL,
  body_text TEXT NOT NULL,
  received_at TEXT NOT NULL,
  raw_key TEXT NOT NULL,
  raw_size INTEGER NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_mailbox_received_at
  ON mailbox_messages (received_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_mailbox_recipient_received_at
  ON mailbox_messages (recipient, received_at DESC);

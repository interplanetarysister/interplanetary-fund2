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
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1))
);
CREATE INDEX IF NOT EXISTS mailbox_messages_date
  ON mailbox_messages (received_at DESC);
CREATE INDEX IF NOT EXISTS mailbox_messages_recipient
  ON mailbox_messages (recipient, received_at DESC);

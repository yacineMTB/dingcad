-- Add email verification fields to users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMPTZ;

-- Existing users are considered verified (grandfathered in)
UPDATE users SET email_verified = true WHERE email_verified = false;

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token) WHERE verification_token IS NOT NULL;

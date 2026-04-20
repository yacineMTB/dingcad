-- Add password reset token support
ALTER TABLE users ADD COLUMN reset_token UUID DEFAULT NULL;
ALTER TABLE users ADD COLUMN reset_token_expires TIMESTAMPTZ DEFAULT NULL;

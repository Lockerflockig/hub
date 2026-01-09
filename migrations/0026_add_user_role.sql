-- Add role field to users table
-- Possible values: 'admin', 'user' (default)
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

-- Create index for role-based queries
CREATE INDEX idx_users_role ON users(role);

-- Make the first user (if exists) an admin
UPDATE users SET role = 'admin' WHERE id = (SELECT MIN(id) FROM users);

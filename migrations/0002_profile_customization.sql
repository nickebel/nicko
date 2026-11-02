-- Nicko Community: add Instagram-style profile fields.
ALTER TABLE users ADD COLUMN banner_url TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN website_url TEXT NOT NULL DEFAULT '';

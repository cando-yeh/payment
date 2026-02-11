-- Add description column to claims table
ALTER TABLE claims ADD COLUMN IF NOT EXISTS description text;

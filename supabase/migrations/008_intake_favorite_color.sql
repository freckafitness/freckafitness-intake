-- Add favourite color field to intakes
ALTER TABLE intakes ADD COLUMN IF NOT EXISTS favorite_color text;

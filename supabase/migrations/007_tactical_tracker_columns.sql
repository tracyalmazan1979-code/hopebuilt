-- Add tactical tracker columns to tactical_items table
-- Mirrors Vanessa's F&C Weekly Tactical Doc tracker

ALTER TABLE tactical_items
  ADD COLUMN IF NOT EXISTS next_steps           text,
  ADD COLUMN IF NOT EXISTS layne_approval       text,  -- TX Chief/Treasury approval (Layne Fisher)
  ADD COLUMN IF NOT EXISTS trevor_approval      text,  -- IPS Leadership approval (Trevor Brooks)
  ADD COLUMN IF NOT EXISTS legal_review_reqd    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS finance_committee    text;  -- FC committee outcome / date sent

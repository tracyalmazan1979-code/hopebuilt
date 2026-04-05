-- Add missing tracker columns to documents table
-- Mirrors the F&C Weekly Doc Review Tracker spreadsheet

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS budget_amendment_reqd boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS date_sent_via_adobe   date,
  ADD COLUMN IF NOT EXISTS date_approved_sent_out date,
  ADD COLUMN IF NOT EXISTS wet_signature_notary  text,
  ADD COLUMN IF NOT EXISTS bod_item_type         text,
  ADD COLUMN IF NOT EXISTS fc_date               date;

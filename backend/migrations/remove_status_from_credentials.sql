-- Migration: Remove status column from credentials table
-- Date: 2024
-- Description: Removes status column from credentials table since status is now calculated dynamically
--              in the v_credentials view based on expiry_date comparison with current date.
--              This ensures status is always accurate and up-to-date without manual updates.

-- Remove the status column if it exists
ALTER TABLE credentials 
DROP COLUMN IF EXISTS status;

-- Add a comment to document why status is not stored
COMMENT ON TABLE credentials IS 'Stores credential data. Status is calculated dynamically in v_credentials view based on expiry_date.';

-- Note: The v_credentials view should calculate status as:
-- CASE
--     WHEN expiry_date = 'Does not expire' THEN 'Active'
--     WHEN expiry_date IS NULL THEN 'Active'
--     WHEN CAST(expiry_date AS DATE) >= CURRENT_DATE THEN 'Active'
--     ELSE 'Expired'
-- END AS status


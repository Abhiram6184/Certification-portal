-- Migration: Add credential_link column to credentials table
-- Date: 2024
-- Description: Adds credential_link column to store the detail page URL for each credential.
--              This is the link to the individual credential detail page where expiry date is scraped from.
--              NULL for manually added or bulk uploaded credentials.

-- Add the credential_link column (nullable, as existing records and manually added credentials won't have this)
ALTER TABLE credentials 
ADD COLUMN IF NOT EXISTS credential_link TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN credentials.credential_link IS 'URL of the individual credential detail page (e.g., https://credentials.databricks.com/credential/12345/). This is the page where expiry date is scraped from. NULL for manually added or bulk uploaded credentials.';

-- Optional: Create an index if you plan to query by credential_link frequently
-- CREATE INDEX IF NOT EXISTS idx_credentials_credential_link ON credentials(credential_link) WHERE credential_link IS NOT NULL;


-- Migration: Add profile_url column to employeedetails table
-- Date: 2024
-- Description: Adds profile_url column to track the Databricks credential wallet URL for each employee.
--              This avoids data redundancy since all credentials for an employee come from the same profile URL.

-- Add the profile_url column to employeedetails (nullable, as existing records won't have this)
ALTER TABLE employeedetails 
ADD COLUMN IF NOT EXISTS profile_url TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN employeedetails.profile_url IS 'URL of the Databricks credential wallet profile page for this employee (e.g., https://credential.net/profile/username/). NULL if credentials were manually added or bulk uploaded.';

-- Optional: Create an index if you plan to query by profile_url frequently
-- CREATE INDEX IF NOT EXISTS idx_employeedetails_profile_url ON employeedetails(profile_url) WHERE profile_url IS NOT NULL;


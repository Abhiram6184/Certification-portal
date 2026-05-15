-- Migration: Update v_credentials view to include credential_link
-- Date: 2024
-- Description: Ensures the v_credentials view includes the credential_link column
--              from the credentials table so it's available in API responses.

-- Drop and recreate the view to include credential_link
-- Note: Adjust the schema name as needed (${LAKEBASE_SCHEMA})
DROP VIEW IF EXISTS v_credentials;

CREATE VIEW v_credentials AS
SELECT 
    credential_id,
    username,
    emp_code,
    full_name,
    credential_title,
    issued_on,
    expiry_date,
    credential_link,  -- Include credential_link from credentials table
    CASE
        WHEN expiry_date = 'Does not expire' THEN 'Active'
        WHEN expiry_date IS NULL THEN 'Active'
        WHEN CAST(expiry_date AS DATE) >= CURRENT_DATE THEN 'Active'
        ELSE 'Expired'
    END AS status
FROM credentials;

COMMENT ON VIEW v_credentials IS 'Dynamic view of credentials with calculated status. Includes credential_link for scraped credentials (NULL for manually uploaded PDFs/images).';


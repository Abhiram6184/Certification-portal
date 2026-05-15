# Credential Link Implementation Guide

## Overview
This migration adds a `credential_link` column to the `credentials` table to store the detail page URL for each credential. This is the link to the individual credential detail page where the expiry date is scraped from.

## Why Add Credential Link?

✅ **Benefits:**
- **Direct access**: Employees can click to view their credential details
- **Verification**: Easy to verify credential details by visiting the link
- **Audit trail**: Track where each credential data came from
- **Re-scraping**: Can re-scrape specific credentials using stored links

## Database Changes Required

### Step 1: Run the Migration Script

Execute the SQL migration script:

```sql
ALTER TABLE credentials 
ADD COLUMN IF NOT EXISTS credential_link TEXT;

COMMENT ON COLUMN credentials.credential_link IS 'URL of the individual credential detail page (e.g., https://credentials.databricks.com/credential/12345/). This is the page where expiry date is scraped from. NULL for manually added or bulk uploaded credentials.';
```

**File location**: `backend-scraper/migrations/add_credential_link_to_credentials.sql`

### Step 2: Update the View (Optional but Recommended)

If you have a `v_credentials` view, update it to include `credential_link`:

```sql
CREATE OR REPLACE VIEW v_credentials AS
SELECT 
    credential_id,
    username,
    emp_code,
    full_name,
    credential_title,
    issued_on,
    expiry_date,
    credential_link,  -- Add this line
    CASE
        WHEN expiry_date = 'Does not expire' THEN 'Active'
        WHEN expiry_date IS NULL THEN 'Active'
        WHEN CAST(expiry_date AS DATE) >= CURRENT_DATE THEN 'Active'
        ELSE 'Expired'
    END AS status
FROM credentials;
```

## Code Changes Made

### ✅ Updated Files:

1. **`backend-scraper/scraper.js`**
   - `insertOrUpdateCredentials()` now saves `credential_link` (detailUrl) to database
   - Both INSERT and UPDATE queries include `credential_link`
   - Enhanced logging to show credential link

2. **`backend-scraper/server.js`**
   - `/api/add-certificate` endpoint updated to include `credential_link` (set to NULL for manually added certificates)

3. **`backend-scraper/bulkupload.js`**
   - Bulk upload endpoint updated to include `credential_link` (set to NULL for bulk uploaded credentials)

## How It Works

### Scraping Flow:
1. Scraper extracts credential tile information
2. Constructs detail URL: `https://credentials.databricks.com/credential/{credential_id}/`
3. Visits detail page to extract expiry date
4. Saves both `expiry_date` and `credential_link` to database

### Manual Upload Flow:
1. User uploads certificate file or provides PDF URL
2. Certificate is extracted and saved
3. `credential_link` is set to `NULL` (not from scraping)

### Bulk Upload Flow:
1. Admin uploads CSV with credentials
2. Credentials are inserted
3. `credential_link` is set to `NULL` (not from scraping)

## Query Examples

### Get all credentials with their detail links:
```sql
SELECT credential_title, credential_link, expiry_date
FROM credentials
WHERE emp_code = 'EMP001';
```

### Find credentials that were scraped (have links):
```sql
SELECT credential_title, credential_link
FROM credentials
WHERE credential_link IS NOT NULL;
```

### Find credentials without links (manually added):
```sql
SELECT credential_title
FROM credentials
WHERE credential_link IS NULL;
```

### Get credential details with link from view:
```sql
SELECT 
    credential_title,
    credential_link,
    expiry_date,
    status
FROM v_credentials
WHERE emp_code = 'EMP001';
```

## Testing

After running the migration:

1. **Test Scraping**: 
   - Scrape credentials from a Databricks URL
   - Verify `credential_link` is saved correctly for each credential
   - Check that links are valid URLs

2. **Test Manual Upload**:
   - Upload a certificate manually
   - Verify `credential_link` is NULL

3. **Test Bulk Upload**:
   - Upload credentials via CSV
   - Verify `credential_link` is NULL

4. **Verify Links**:
   - Check that stored links are accessible
   - Verify links point to correct credential detail pages

## Data Structure

### Example Credential Link Format:
- **Pattern**: `https://credentials.databricks.com/credential/{credential_id}/`
- **Example**: `https://credentials.databricks.com/credential/abc123def456/`

### Column Details:
- **Type**: `TEXT` (nullable)
- **Source**: Extracted during scraping from tile href attribute
- **Format**: Full URL to credential detail page
- **NULL values**: For manually added or bulk uploaded credentials

## Notes

- The `credential_link` column is **nullable** to support existing records and non-scraped credentials
- Each scraped credential gets its own unique detail link
- Links are stored exactly as constructed from the base URL + href
- Useful for direct access to credential verification pages
- Can be used for re-scraping specific credentials if needed


# Profile URL Implementation Guide

## Overview
This migration adds a `profile_url` column to the `employeedetails` table to track the Databricks credential wallet URL for each employee. This is more efficient than storing it in the `credentials` table since all credentials for an employee come from the same profile URL.

## Why Store in EmployeeDetails Instead of Credentials?

✅ **Recommended: Store in employeedetails table**
- **No data redundancy**: Each employee has one profile URL, not one per credential
- **Normalized design**: Follows database normalization principles
- **Efficient storage**: Saves space (one URL per employee vs one per credential)
- **Easier updates**: Update once per employee, not per credential
- **Better queries**: Join once to get profile URL for all employee's credentials

❌ **Not recommended: Store in credentials table**
- Would duplicate the same URL for every credential
- Wastes storage space
- More complex updates (need to update all credentials)
- Violates normalization principles

## Database Changes Required

### Step 1: Run the Migration Script

Execute the SQL migration script:

```sql
-- Run this in your PostgreSQL/Lakebase database
ALTER TABLE employeedetails 
ADD COLUMN IF NOT EXISTS profile_url TEXT;

COMMENT ON COLUMN employeedetails.profile_url IS 'URL of the Databricks credential wallet profile page for this employee (e.g., https://credential.net/profile/username/). NULL if credentials were manually added or bulk uploaded.';
```

**File location**: `backend-scraper/migrations/add_profile_url_to_credentials.sql`

## Code Changes Made

### ✅ Updated Files:

1. **`backend-scraper/scraper.js`**
   - `scrapeCredentials()` returns `profileUrl` in the result
   - `insertOrUpdateCredentials()` now updates `employeedetails.profile_url` when scraping
   - Removed `profile_url` from credentials INSERT/UPDATE queries

2. **`backend-scraper/server.js`**
   - `/api/email-login` now fetches and returns `profile_url` from employeedetails
   - `/api/register-employee` includes `profile_url` (set to NULL) in INSERT
   - `/api/admin/employees` includes `profile_url` in SELECT query
   - `/api/add-certificate` no longer includes `profile_url` (removed from credentials)

3. **`backend-scraper/bulkupload.js`**
   - Bulk upload no longer includes `profile_url` (removed from credentials)

## How It Works

### Scraping Flow:
1. User provides Databricks profile URL: `https://credential.net/profile/username/`
2. Scraper extracts credentials from that URL
3. **Profile URL is saved to `employeedetails.profile_url`** (one update per employee)
4. Credentials are saved to `credentials` table (without profile_url)
5. All credentials for that employee are linked via `emp_code`

### Manual Upload Flow:
1. User uploads certificate file or provides PDF URL
2. Certificate is extracted and saved
3. `employeedetails.profile_url` remains unchanged (NULL or existing value)

### Bulk Upload Flow:
1. Admin uploads CSV with credentials
2. Credentials are inserted
3. `employeedetails.profile_url` remains unchanged (NULL or existing value)

## Query Examples

### Get employee with their profile URL:
```sql
SELECT emp_code, employee_name, profile_url
FROM employeedetails
WHERE emp_code = 'EMP001';
```

### Get all employees who have scraped credentials:
```sql
SELECT emp_code, employee_name, profile_url
FROM employeedetails
WHERE profile_url IS NOT NULL;
```

### Get employee credentials with profile URL:
```sql
SELECT 
    e.emp_code,
    e.employee_name,
    e.profile_url,
    c.credential_title,
    c.issued_on
FROM employeedetails e
LEFT JOIN credentials c ON e.emp_code = c.emp_code
WHERE e.emp_code = 'EMP001';
```

### Count employees by source type:
```sql
SELECT 
    CASE 
        WHEN profile_url IS NULL THEN 'Manual/Bulk Upload'
        ELSE 'Scraped'
    END AS source_type,
    COUNT(*) as employee_count
FROM employeedetails
GROUP BY source_type;
```

### Find all credentials for employees with a specific profile URL pattern:
```sql
SELECT 
    e.employee_name,
    e.profile_url,
    c.credential_title
FROM employeedetails e
JOIN credentials c ON e.emp_code = c.emp_code
WHERE e.profile_url LIKE '%credential.net/profile%';
```

## Testing

After running the migration:

1. **Test Scraping**: 
   - Scrape credentials from a Databricks URL
   - Verify `employeedetails.profile_url` is updated for that employee
   - Verify credentials are saved without profile_url

2. **Test Manual Upload**:
   - Upload a certificate manually
   - Verify `employeedetails.profile_url` is unchanged

3. **Test Bulk Upload**:
   - Upload credentials via CSV
   - Verify `employeedetails.profile_url` is unchanged

4. **Test Login**:
   - Login with email
   - Verify `profile_url` is returned in user profile

## Rollback (If Needed)

If you need to remove this feature:

```sql
ALTER TABLE employeedetails DROP COLUMN IF EXISTS profile_url;
```

Then revert the code changes in:
- `backend-scraper/scraper.js`
- `backend-scraper/server.js`
- `backend-scraper/bulkupload.js`

## Benefits

- ✅ **No data redundancy**: One URL per employee, not per credential
- ✅ **Normalized design**: Follows database best practices
- ✅ **Efficient storage**: Saves significant space for employees with many credentials
- ✅ **Easy updates**: Update profile URL once per employee
- ✅ **Better performance**: Fewer columns in credentials table
- ✅ **Clear relationship**: Profile URL is a property of the employee, not individual credentials

## Notes

- The `profile_url` column is **nullable** to support existing records and non-scraped credentials
- When scraping, the profile URL is updated in `employeedetails` for the employee
- All credentials for an employee share the same profile URL (stored once)
- Useful for tracking which employees have scraped credentials vs manually added ones
- Can be used to re-scrape credentials by looking up the profile URL

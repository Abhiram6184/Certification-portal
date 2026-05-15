# Status Column Removal from Credentials Table

## Overview
The `status` column has been removed from the `credentials` table. Status is now calculated **dynamically** in the `v_credentials` view based on `expiry_date` comparison with the current date.

## Why Remove Status Column?

✅ **Benefits:**
- **Always accurate**: Status is calculated in real-time, never stale
- **No manual updates**: No need to update status when scraping or adding credentials
- **Single source of truth**: Expiry date determines status automatically
- **Simpler code**: Less logic to maintain in application code

❌ **Problems with storing status:**
- Can become stale if not updated regularly
- Requires manual updates during scraping/insertion
- Risk of inconsistency between expiry_date and status

## Database Changes

### Step 1: Run the Migration Script

Execute the SQL migration script to remove the status column:

```sql
ALTER TABLE credentials 
DROP COLUMN IF EXISTS status;
```

**File location**: `backend-scraper/migrations/remove_status_from_credentials.sql`

### Step 2: Verify the View

Ensure your `v_credentials` view calculates status dynamically:

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
    CASE
        WHEN expiry_date = 'Does not expire' THEN 'Active'
        WHEN expiry_date IS NULL THEN 'Active'
        WHEN CAST(expiry_date AS DATE) >= CURRENT_DATE THEN 'Active'
        ELSE 'Expired'
    END AS status
FROM credentials;
```

## Code Verification

### ✅ Already Correct - No Changes Needed

The following files **already do NOT insert or update status**:

1. **`backend-scraper/scraper.js`**
   - `insertOrUpdateCredentials()` - Only inserts/updates: credential_id, expiry_date, full_name, issued_on, username
   - Comment confirms: "Status is no longer calculated here"
   - Status is fetched from `v_credentials` view after insertion

2. **`backend-scraper/server.js`**
   - `/api/add-certificate` - Only inserts/updates: credential_id, username, emp_code, full_name, credential_title, issued_on, expiry_date
   - Status is fetched from `v_credentials` view after insertion

3. **`backend-scraper/bulkupload.js`**
   - Bulk upload - Only inserts/updates: credential_id, emp_code, full_name, credential_title, issued_on, expiry_date
   - Status is calculated in view

## How Status is Calculated

Status is determined by comparing `expiry_date` with the current date:

1. **Active**: 
   - `expiry_date = 'Does not expire'`
   - `expiry_date IS NULL`
   - `expiry_date >= CURRENT_DATE` (not expired yet)

2. **Expired**: 
   - `expiry_date < CURRENT_DATE` (past the expiry date)

## Status Calculation Logic

```sql
CASE
    WHEN expiry_date = 'Does not expire' THEN 'Active'
    WHEN expiry_date IS NULL THEN 'Active'
    WHEN CAST(expiry_date AS DATE) >= CURRENT_DATE THEN 'Active'
    ELSE 'Expired'
END AS status
```

## Query Examples

### Get credentials with dynamic status:
```sql
SELECT 
    credential_title,
    expiry_date,
    status  -- Calculated dynamically
FROM v_credentials
WHERE emp_code = 'EMP001';
```

### Find all expired credentials:
```sql
SELECT *
FROM v_credentials
WHERE status = 'Expired';
```

### Find all active credentials:
```sql
SELECT *
FROM v_credentials
WHERE status = 'Active';
```

## Testing

After running the migration:

1. **Verify status column is removed:**
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'credentials' AND column_name = 'status';
   -- Should return 0 rows
   ```

2. **Verify view calculates status correctly:**
   ```sql
   SELECT credential_title, expiry_date, status
   FROM v_credentials
   WHERE emp_code = 'TEST_EMP';
   -- Status should be 'Active' or 'Expired' based on expiry_date
   ```

3. **Test scraping:**
   - Scrape credentials
   - Verify status is returned from view (not from table)
   - Check that status matches expiry_date logic

## Rollback (If Needed)

If you need to add status column back:

```sql
ALTER TABLE credentials 
ADD COLUMN status VARCHAR(20);

-- Update existing records (one-time)
UPDATE credentials
SET status = CASE
    WHEN expiry_date = 'Does not expire' THEN 'Active'
    WHEN expiry_date IS NULL THEN 'Active'
    WHEN CAST(expiry_date AS DATE) >= CURRENT_DATE THEN 'Active'
    ELSE 'Expired'
END;
```

**Note**: Rollback is not recommended as dynamic calculation is more reliable.

## Notes

- ✅ Status is **never** inserted or updated in application code
- ✅ Status is **always** calculated from `expiry_date` in the view
- ✅ Status is **always** up-to-date (no stale data)
- ✅ No code changes needed - already implemented correctly


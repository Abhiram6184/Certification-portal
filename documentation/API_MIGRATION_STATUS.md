# API Migration Status: Databricks SQL → PostgreSQL/Lakebase

## Overview
This document tracks all API endpoints and their current database usage. APIs are being migrated from Databricks SQL Warehouse to PostgreSQL (Lakebase) one by one.

---

## ✅ **APIs Already Migrated to PostgreSQL/Lakebase**

### 1. **POST `/api/email-login`**
- **File**: `server.js` (Line 127-191)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - SELECT from `employeedetails` table
  - SELECT from `v_credentials` view
- **Status**: ✅ Migrated
- **Notes**: Uses `getPgClientFromPool()`, parameterized queries with `$1`

### 2. **POST `/api/register-employee`**
- **File**: `server.js` (Line 200-251)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - SELECT (check duplicates)
  - INSERT into `employeedetails`
- **Status**: ✅ Migrated
- **Notes**: Uses `getPgClientFromPool()`, parameterized queries

### 3. **GET `/api/leaderboard`**
- **File**: `server.js` (Line 260-315)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - SELECT with JOIN, COUNT, DENSE_RANK
  - FROM `employeedetails` and `v_credentials`
- **Status**: ✅ Migrated
- **Notes**: Uses `getPgClientFromPool()`, complex aggregation query

### 4. **GET `/api/leaderboard/by-issuer`**
- **File**: `server.js` (Line 324-369)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - SELECT with CASE, COUNT, DENSE_RANK
  - FROM `v_credentials`
- **Status**: ✅ Migrated
- **Notes**: Uses `getPgClientFromPool()`, CTE with issuer categorization

### 5. **GET `/api/admin/credentials/by-emp-code/:emp_code`**
- **File**: `server.js` (Line 599-639)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - SELECT from `v_credentials` view
- **Status**: ✅ Migrated
- **Notes**: Uses `getPgClientFromPool()`, parameterized query with `$1`

### 6. **GET `/api/employee/requests/:emp_code`**
- **File**: `voucher.js` (Line 243-288)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - SELECT from `voucher_requests` with JOIN to `employeedetails`
- **Status**: ✅ Migrated
- **Notes**: Uses `getPgClientFromPool()`, parameterized query

### 7. **POST `/api/employee/update-request`**
- **File**: `voucher.js` (Line 290-335)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - UPDATE `voucher_requests` table
  - SELECT to re-fetch updated record
- **Status**: ✅ Migrated
- **Notes**: Uses `getPgClientFromPool()`, dynamic UPDATE with parameterized queries

### 8. **POST `/api/approve-and-assign`**
- **File**: `voucher.js` (Line 337-400)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - SELECT from `voucher_requests`
  - SELECT from `voucher_codes` (with FOR UPDATE lock)
  - UPDATE `voucher_codes` (set status to 'assigned')
  - UPDATE `voucher_requests` (set status, voucher_id, timestamps)
  - SELECT to re-fetch updated request
- **Status**: ✅ Migrated
- **Notes**: Uses transactions (BEGIN/COMMIT/ROLLBACK), row-level locking

### 9. **POST `/api/reject-request`**
- **File**: `voucher.js` (Line 402-430)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - UPDATE `voucher_requests` (set status, rejection reason, timestamp)
  - SELECT to re-fetch updated record
- **Status**: ✅ Migrated
- **Notes**: Uses `getPgClientFromPool()`, parameterized UPDATE

### 10. **POST `/api/add-certificate`**
- **File**: `server.js` (Line 471-583)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - SELECT from `credentials` (check if exists)
  - UPDATE `credentials` (if exists) or INSERT (if new)
  - SELECT from `v_credentials` view (to re-fetch with status)
- **Status**: ✅ Migrated
- **Notes**: 
  - Uses `getPgClientFromPool()`, parameterized queries
  - Converted MERGE to SELECT-then-UPDATE-or-INSERT pattern
  - Complex matching logic preserved: `TRIM(LOWER(credential_title))` + `username` OR `emp_code`

### 11. **POST `/api/scrape-and-add-by-url`**
- **File**: `scraper.js` (Line 252-297)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - Web scraping (Playwright) - no database
  - Sequential UPSERT loop in `insertOrUpdateCredentials()` function
  - SELECT from `v_credentials` view (to re-fetch with status)
- **Status**: ✅ Migrated
- **Notes**: 
  - Uses `getPgClientFromPool()`, parameterized queries
  - Converted sequential MERGE loop to SELECT-then-UPDATE-or-INSERT pattern
  - Matching logic: `TRIM(LOWER(credential_title))` + `emp_code`
  - Removed dependency on `dbHelpers` parameter

### 12. **POST `/api/request-voucher`**
- **File**: `voucher.js` (Line 120-222)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - SELECT from `employeedetails` (find employee by email)
  - INSERT into `voucher_requests` (with RETURNING clause for ID)
- **Status**: ✅ Migrated
- **Notes**: 
  - Uses `getPgClientFromPool()`, parameterized queries
  - Replaced manual ID generation (MAX + 1) with PostgreSQL RETURNING clause
  - Auto-generates ID if table uses SERIAL/BIGSERIAL
  - Email sending logic preserved (non-blocking)

### 13. **GET `/api/admin/employees`**
- **File**: `server.js` (Line 588-632)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - SELECT with LEFT JOIN, COUNT, GROUP BY
  - FROM `employeedetails` and `v_credentials`
- **Status**: ✅ Migrated
- **Notes**: 
  - Uses `getPgClientFromPool()`, parameterized queries
  - Column name mapping to preserve frontend compatibility
  - Simple aggregation query

### 14. **GET `/api/admin/credentials-summary`**
- **File**: `server.js` (Line 677-715)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - SELECT with COUNT(DISTINCT), GROUP BY
  - FROM `v_credentials`
- **Status**: ✅ Migrated
- **Notes**: 
  - Uses `getPgClientFromPool()`
  - Simple aggregation query
  - Employee count converted to integer

### 15. **GET `/api/admin/employees-by-credential`**
- **File**: `server.js` (Line 718-767)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - SELECT with JOIN, GROUP BY
  - FROM `v_credentials` and `employeedetails`
- **Status**: ✅ Migrated
- **Notes**: 
  - Uses `getPgClientFromPool()`, parameterized queries
  - Query parameter converted from `sqlValue()` to `$1`
  - Column name mapping to preserve frontend compatibility

### 16. **GET `/api/admin/all-credentials-report`**
- **File**: `server.js` (Line 770-813)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - SELECT with JOIN
  - FROM `v_credentials` and `employeedetails`
- **Status**: ✅ Migrated
- **Notes**: 
  - Uses `getPgClientFromPool()`
  - Simple JOIN query
  - Column name mapping to preserve frontend compatibility

### 17. **GET `/api/admin/all-requests`**
- **File**: `voucher.js` (Line 225-267)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - SELECT with LEFT JOIN
  - FROM `voucher_requests` and `employeedetails`
- **Status**: ✅ Migrated
- **Notes**: 
  - Uses `getPgClientFromPool()`
  - Simple JOIN query
  - Error handling updated for PostgreSQL error messages

### 18. **POST `/api/admin/bulk-upload-credentials`**
- **File**: `bulkupload.js` (Line 6-177)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - SELECT from `employeedetails` (batch lookup by emails)
  - Deduplication in JavaScript (replacing MAX_BY logic)
  - Batch UPSERT into `credentials` (SELECT-then-UPDATE-or-INSERT pattern)
- **Status**: ✅ Migrated
- **Notes**: 
  - Uses `getPgClientFromPool()`, parameterized queries
  - Converted complex MERGE with CTE to JavaScript deduplication + PostgreSQL UPSERT
  - Processes in batches of 100 records with transactions
  - Matching logic: `emp_code` + normalized `credential_title`

### 19. **POST `/api/admin/bulk-upload-vouchers`**
- **File**: `bulkupload.js` (Line 180-291)
- **Database**: PostgreSQL/Lakebase
- **Operations**: 
  - INSERT into `voucher_codes` with `ON CONFLICT DO NOTHING`
- **Status**: ✅ Migrated
- **Notes**: 
  - Uses `getPgClientFromPool()`, parameterized queries
  - Converted MERGE WHEN NOT MATCHED to `INSERT ... ON CONFLICT (voucher_code) DO NOTHING`
  - Processes in batches of 100 records for performance
  - Assumes `voucher_code` has unique constraint

---

## 🔄 **APIs Still Using Databricks SQL (Need Migration)**

**🎉 ALL APIs HAVE BEEN MIGRATED TO POSTGRESQL/LAKEBASE! 🎉**

No APIs remain using Databricks SQL. All database operations now use PostgreSQL/Lakebase.

---

## 📋 **APIs Not Using Database (No Migration Needed)**

### 1. **POST `/api/extract-from-url`**
- **File**: `server.js` (Line 378-426)
- **Database**: None
- **Operations**: External API call (Gemini AI)
- **Status**: ✅ No migration needed

### 2. **POST `/api/extract-from-file`**
- **File**: `server.js` (Line 434-463)
- **Database**: None
- **Operations**: External API call (Gemini AI)
- **Status**: ✅ No migration needed

### 3. **POST `/api/generate-approval-email`**
- **File**: `voucher.js` (Line 432-449)
- **Database**: None
- **Operations**: External API call (Gemini AI)
- **Status**: ✅ No migration needed

### 4. **POST `/api/generate-denial-email`**
- **File**: `voucher.js` (Line 451-468)
- **Database**: None
- **Operations**: External API call (Gemini AI)
- **Status**: ✅ No migration needed

### 5. **POST `/api/generate-fulfillment-email`**
- **File**: `voucher.js` (Line 470-488)
- **Database**: None
- **Operations**: External API call (Gemini AI)
- **Status**: ✅ No migration needed

### 6. **GET `/health`**
- **File**: `server.js` (Line 746)
- **Database**: None
- **Operations**: Health check endpoint
- **Status**: ✅ No migration needed

---

## 📊 **Migration Summary**

| Status | Count | APIs |
|--------|-------|------|
| ✅ Migrated to PostgreSQL | 19 | email-login, register-employee, leaderboard, leaderboard/by-issuer, admin/credentials/by-emp-code, employee/requests, employee/update-request, approve-and-assign, reject-request, add-certificate, scrape-and-add-by-url, request-voucher, admin/employees, admin/credentials-summary, admin/employees-by-credential, admin/all-credentials-report, admin/all-requests, admin/bulk-upload-credentials, admin/bulk-upload-vouchers |
| 🔄 Using Databricks SQL | 0 | **NONE - ALL MIGRATED!** |
| ✅ No Database | 6 | extract-from-url, extract-from-file, generate-approval-email, generate-denial-email, generate-fulfillment-email, health |

**Total APIs**: 25  
**Remaining Migrations**: 0 ✅ **MIGRATION COMPLETE!**

---

## 🔧 **Key Migration Patterns**

### Pattern 1: MERGE → INSERT ... ON CONFLICT
**Databricks SQL:**
```sql
MERGE INTO schema.table AS target
USING (SELECT ...) AS source
ON target.key = source.key
WHEN MATCHED THEN UPDATE SET ...
WHEN NOT MATCHED THEN INSERT ...
```

**PostgreSQL:**
```sql
INSERT INTO schema.table (...)
VALUES (...)
ON CONFLICT (key) 
DO UPDATE SET ...
```

### Pattern 2: Manual ID Generation → SERIAL/SEQUENCE
**Databricks SQL:**
```javascript
const maxIdQuery = `SELECT MAX(id) as max_id FROM table`;
const newId = (maxIdResult[0].max_id || 0) + 1;
```

**PostgreSQL:**
```sql
-- Use SERIAL or SEQUENCE
CREATE TABLE table (id SERIAL PRIMARY KEY, ...);
-- Or use RETURNING clause
INSERT INTO table (...) VALUES (...) RETURNING id;
```

### Pattern 3: sqlValue() Helper → Parameterized Queries
**Databricks SQL:**
```javascript
WHERE column = ${sqlValue(value)}
```

**PostgreSQL:**
```javascript
WHERE column = $1
// With: await pgClient.query(query, [value])
```

### Pattern 4: Connection Pattern
**Databricks SQL:**
```javascript
const client = await getDbClient();
const session = await client.openSession();
try {
    const op = await session.executeStatement(sql);
    const result = await op.fetchAll();
    await op.close();
} finally {
    await session.close();
    await client.close();
}
```

**PostgreSQL:**
```javascript
let pgClient;
try {
    pgClient = await getPgClientFromPool();
    const result = await pgClient.query(sql, params);
    // Use result.rows
} finally {
    if (pgClient) pgClient.release();
}
```

---

## 🎯 **Recommended Migration Order**

1. **High Priority** (Core functionality):
   - ✅ `POST /api/add-certificate` - Certificate upload **[COMPLETED]**
   - ✅ `POST /api/scrape-and-add-by-url` - Scraper functionality **[COMPLETED]**
   - ✅ `POST /api/request-voucher` - Voucher request creation **[COMPLETED]**

2. **Medium Priority** (Admin/Reporting):
   - ✅ `GET /api/admin/employees` **[COMPLETED]**
   - ✅ `GET /api/admin/credentials-summary` **[COMPLETED]**
   - ✅ `GET /api/admin/employees-by-credential` **[COMPLETED]**
   - ✅ `GET /api/admin/all-credentials-report` **[COMPLETED]**
   - ✅ `GET /api/admin/all-requests` **[COMPLETED]**

3. **Lower Priority** (Bulk operations):
   - ✅ `POST /api/admin/bulk-upload-credentials` **[COMPLETED]**
   - ✅ `POST /api/admin/bulk-upload-vouchers` **[COMPLETED]**

---

## 📝 **Notes**

- All migrated APIs use `getPgClientFromPool()` from `lakebase.js`
- All migrated APIs use parameterized queries (`$1`, `$2`, etc.) for security
- Transaction support is available in PostgreSQL (BEGIN/COMMIT/ROLLBACK)
- Row-level locking is available (SELECT ... FOR UPDATE)
- PostgreSQL supports UPSERT via `INSERT ... ON CONFLICT`
- PostgreSQL supports SERIAL/SEQUENCE for auto-incrementing IDs


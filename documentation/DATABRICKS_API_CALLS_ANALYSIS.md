# Databricks API Calls Analysis - Complete Inventory

## Overview
This document catalogs all API calls hitting the Databricks Free Edition Lakehouse from the Employee Certification Portal. All operations use the `@databricks/sql` Node.js package via SQL Warehouse connections.

---

## Connection Pattern
All operations follow this pattern:
```javascript
const client = await getDbClient();  // DBSQLClient connection
const session = await client.openSession();
try {
    // SQL operations
} finally {
    await session.close();
    await client.close();
}
```

---

## DDL (Data Definition Language) Operations
**Status: NONE** - No schema creation/modification operations found in the codebase.

---

## DML (Data Manipulation Language) Operations

### 1. **MERGE Operations** (Upserts)

#### 1.1 Credentials Table - Single Record Upsert
**Location:** `server.js` - `/api/add-certificate` (Line 467-497)
**Operation:** MERGE INTO credentials
**Frequency:** Per certificate upload
**Details:**
- Upserts based on `credential_title` (case-insensitive) + `username` OR `emp_code`
- Updates: `full_name`, `issued_on`, `expiry_date`
- Inserts: All credential fields including new `credential_id`

#### 1.2 Credentials Table - Scraper Sequential Upsert
**Location:** `scraper.js` - `insertOrUpdateCredentials()` (Line 180-202)
**Operation:** MERGE INTO credentials (in sequential loop)
**Frequency:** Per credential scraped from Databricks profile URL
**Details:**
- Loops through scraped credentials sequentially (to avoid Delta Lake conflicts)
- Upserts based on `credential_title` (case-insensitive) + `emp_code`
- Updates: `credential_id`, `expiry_date`, `full_name`, `issued_on`, `username`
- Inserts: All credential fields

#### 1.3 Credentials Table - Bulk Upload
**Location:** `bulkupload.js` - `/api/admin/bulk-upload-credentials` (Line 82-109)
**Operation:** MERGE INTO credentials (bulk operation)
**Frequency:** Per bulk CSV upload
**Details:**
- Uses VALUES clause with multiple records
- Deduplicates within the batch using CTE
- Upserts based on `emp_code` + `credential_title` (normalized)
- Updates: `full_name`, `issued_on`, `expiry_date`
- Inserts: New records with `uuid()` for `credential_id`

#### 1.4 Voucher Codes Table - Bulk Upload
**Location:** `bulkupload.js` - `/api/admin/bulk-upload-vouchers` (Line 186-196)
**Operation:** MERGE INTO voucher_codes
**Frequency:** Per bulk voucher CSV upload
**Details:**
- Upserts based on `Voucher_Code`
- Only inserts new records (WHEN NOT MATCHED)
- Sets default status: 'not assigned'

### 2. **INSERT Operations**

#### 2.1 Employee Registration
**Location:** `server.js` - `/api/register-employee` (Line 213-216)
**Operation:** INSERT INTO EmployeeDetails
**Frequency:** Per new employee registration
**Details:**
- Inserts: `Emp_Code`, `Employee_Name`, `Employee_EmailID`, `Designation`
- Preceded by duplicate check query

#### 2.2 Voucher Request Creation
**Location:** `voucher.js` - `/api/request-voucher` (Line 146-153)
**Operation:** INSERT INTO voucher_requests
**Frequency:** Per voucher request submission
**Details:**
- Inserts: `id` (manual increment), `user_id`, `cert_type`, `cert_provider`, `status`, `requested_at`, `personal_email`
- Preceded by: Employee lookup query + MAX(id) query

### 3. **UPDATE Operations**

#### 3.1 Voucher Request Update (Employee)
**Location:** `voucher.js` - `/api/employee/update-request` (Line 289)
**Operation:** UPDATE voucher_requests
**Frequency:** When employee updates exam date/status/result
**Details:**
- Updates: `scheduled_at`, `status`, `exam_status`
- Followed by SELECT to fetch updated record

#### 3.2 Voucher Code Assignment
**Location:** `voucher.js` - `/api/approve-and-assign` (Line 331)
**Operation:** UPDATE voucher_codes
**Frequency:** When admin approves and assigns voucher
**Details:**
- Updates: `status = 'assigned'` for specific `Voucher_Code`

#### 3.3 Voucher Request Fulfillment
**Location:** `voucher.js` - `/api/approve-and-assign` (Line 334)
**Operation:** UPDATE voucher_requests
**Frequency:** When voucher is assigned
**Details:**
- Updates: `status = 'Fulfilled'`, `voucher_id`, `approved_at`, `fulfilled_at`, `reviewed_by`

#### 3.4 Voucher Request Approval (No Voucher Available)
**Location:** `voucher.js` - `/api/approve-and-assign` (Line 352)
**Operation:** UPDATE voucher_requests
**Frequency:** When approved but no voucher available
**Details:**
- Updates: `status = 'Approved'`, `approved_at`, `reviewed_by`

#### 3.5 Voucher Request Rejection
**Location:** `voucher.js` - `/api/reject-request` (Line 373-376)
**Operation:** UPDATE voucher_requests
**Frequency:** When admin rejects request
**Details:**
- Updates: `status = 'Rejected'`, `rejected_at`, `denial_reason`, `reviewed_by`

---

## DQL (Data Query Language) Operations

### 1. **Authentication & User Management**

#### 1.1 Email Login - Employee Lookup
**Location:** `server.js` - `/api/email-login` (Line 126-130)
**Operation:** SELECT FROM EmployeeDetails
**Frequency:** Per login attempt
**Query:**
```sql
SELECT Emp_Code, Employee_Name, Employee_EmailID, Designation
FROM ${DATABRICKS_SCHEMA}.EmployeeDetails
WHERE LOWER(Employee_EmailID) = ?
```

#### 1.2 Email Login - Credentials Fetch
**Location:** `server.js` - `/api/email-login` (Line 151-156)
**Operation:** SELECT FROM v_credentials
**Frequency:** Per successful login
**Query:**
```sql
SELECT credential_id, credential_title, issued_on, status, expiry_date
FROM ${DATABRICKS_SCHEMA}.v_credentials
WHERE emp_code = ?
ORDER BY issued_on DESC
```

#### 1.3 Employee Registration - Duplicate Check
**Location:** `server.js` - `/api/register-employee` (Line 200-203)
**Operation:** SELECT FROM EmployeeDetails
**Frequency:** Per registration attempt
**Query:**
```sql
SELECT 1 FROM ${DATABRICKS_SCHEMA}.EmployeeDetails
WHERE Emp_Code = ? OR LOWER(Employee_EmailID) = ?
```

### 2. **Certificate Management**

#### 2.1 Add Certificate - Post-Upsert Fetch
**Location:** `server.js` - `/api/add-certificate` (Line 507-513)
**Operation:** SELECT FROM v_credentials
**Frequency:** After each certificate upload
**Query:**
```sql
SELECT * FROM ${DATABRICKS_SCHEMA}.v_credentials
WHERE TRIM(LOWER(credential_title)) = TRIM(LOWER(?)) AND
      ((username = ? AND ? IS NOT NULL) OR
       (emp_code = ? AND ? IS NOT NULL))
LIMIT 1
```

#### 2.2 Scraper - Post-Upsert Fetch
**Location:** `scraper.js` - `/api/scrape-and-add-by-url` (Line 240-244)
**Operation:** SELECT FROM v_credentials
**Frequency:** After scraping credentials
**Query:**
```sql
SELECT credential_id, credential_title as title, issued_on as issuedOn, 
       status, expiry_date as expiryDate
FROM ${DATABRICKS_SCHEMA}.v_credentials
WHERE emp_code = ?
```

### 3. **Leaderboard Queries**

#### 3.1 Main Leaderboard
**Location:** `server.js` - `/api/leaderboard` (Line 248-272)
**Operation:** SELECT with JOIN and aggregation
**Frequency:** Per leaderboard page load
**Query:**
```sql
SELECT emp_code, Emp_name, Employee_EmailID, Designation, 
       credential_count,
       DENSE_RANK() OVER (ORDER BY credential_count DESC) as rank
FROM (
    SELECT e.Emp_Code AS emp_code, e.Employee_Name AS Emp_name,
           e.Employee_EmailID, e.Designation,
           COUNT(c.credential_id) AS credential_count
    FROM ${DATABRICKS_SCHEMA}.EmployeeDetails e
    LEFT JOIN ${DATABRICKS_SCHEMA}.v_credentials c ON e.Emp_Code = c.emp_code
    GROUP BY e.Emp_Code, e.Employee_Name, e.Employee_EmailID, e.Designation
)
ORDER BY rank ASC, Emp_name ASC
```

#### 3.2 Leaderboard by Issuer
**Location:** `server.js` - `/api/leaderboard/by-issuer` (Line 302-328)
**Operation:** SELECT with aggregation and CASE logic
**Frequency:** Per issuer leaderboard page load
**Query:**
```sql
WITH IssuerCounts AS (
    SELECT
        CASE
            WHEN LOWER(credential_title) LIKE '%databricks%' THEN 'Databricks'
            WHEN LOWER(credential_title) LIKE '%microsoft%' OR 
                 LOWER(credential_title) LIKE '%azure%' THEN 'Microsoft'
            WHEN LOWER(credential_title) LIKE '%google%' THEN 'Google'
            WHEN LOWER(credential_title) LIKE '%aws%' THEN 'AWS'
            ELSE 'Others'
        END as issuer_name,
        COUNT(credential_id) as credential_count
    FROM ${DATABRICKS_SCHEMA}.v_credentials
    WHERE credential_title IS NOT NULL AND credential_title != ''
    GROUP BY issuer_name
)
SELECT DENSE_RANK() OVER (ORDER BY credential_count DESC) as rank,
       issuer_name, credential_count
FROM IssuerCounts
ORDER BY rank ASC, issuer_name ASC
```

### 4. **Admin Queries**

#### 4.1 All Employees Directory
**Location:** `server.js` - `/api/admin/employees` (Line 542-557)
**Operation:** SELECT with LEFT JOIN
**Frequency:** Per admin employee directory page load
**Query:**
```sql
SELECT e.Emp_Code AS emp_code, e.Employee_Name AS Emp_name,
       e.Employee_EmailID, e.Designation,
       COUNT(c.credential_id) AS credential_count
FROM ${DATABRICKS_SCHEMA}.EmployeeDetails e
LEFT JOIN ${DATABRICKS_SCHEMA}.v_credentials c ON e.Emp_Code = c.emp_code
GROUP BY e.Emp_Code, e.Employee_Name, e.Employee_EmailID, e.Designation
ORDER BY credential_count DESC, Emp_name ASC
```

#### 4.2 Credentials by Employee Code
**Location:** `server.js` - `/api/admin/credentials/by-emp-code/:emp_code` (Line 580-585)
**Operation:** SELECT FROM v_credentials
**Frequency:** When admin views specific employee credentials
**Query:**
```sql
SELECT * FROM ${DATABRICKS_SCHEMA}.v_credentials
WHERE emp_code = ?
ORDER BY issued_on DESC
```

#### 4.3 Credentials Summary
**Location:** `server.js` - `/api/admin/credentials-summary` (Line 605-617)
**Operation:** SELECT with aggregation
**Frequency:** Per admin credentials summary page load
**Query:**
```sql
SELECT credential_title,
       COUNT(DISTINCT COALESCE(username, emp_code)) as employee_count
FROM ${DATABRICKS_SCHEMA}.v_credentials
WHERE credential_title IS NOT NULL
GROUP BY credential_title
ORDER BY employee_count DESC, credential_title ASC
```

#### 4.4 Employees by Credential
**Location:** `server.js` - `/api/admin/employees-by-credential` (Line 640-657)
**Operation:** SELECT with JOIN
**Frequency:** When admin views credential holders
**Query:**
```sql
SELECT e.Emp_Code, e.Employee_Name, e.Employee_EmailID, e.Designation
FROM ${DATABRICKS_SCHEMA}.v_credentials c
JOIN ${DATABRICKS_SCHEMA}.EmployeeDetails e ON c.emp_code = e.Emp_Code
WHERE c.credential_title = ? AND c.emp_code IS NOT NULL
GROUP BY e.Emp_Code, e.Employee_Name, e.Employee_EmailID, e.Designation
ORDER BY e.Employee_Name ASC
```

#### 4.5 All Credentials Report
**Location:** `server.js` - `/api/admin/all-credentials-report` (Line 675-689)
**Operation:** SELECT with JOIN
**Frequency:** Per admin report generation
**Query:**
```sql
SELECT c.credential_title AS CredentialName, e.Emp_Code, e.Employee_Name,
       e.Employee_EmailID, e.Designation
FROM ${DATABRICKS_SCHEMA}.v_credentials c
JOIN ${DATABRICKS_SCHEMA}.EmployeeDetails e ON c.emp_code = e.Emp_Code
WHERE c.emp_code IS NOT NULL AND c.credential_title IS NOT NULL
ORDER BY c.credential_title ASC, e.Employee_Name ASC
```

### 5. **Bulk Upload Queries**

#### 5.1 Bulk Upload Credentials - Employee Lookup
**Location:** `bulkupload.js` - `/api/admin/bulk-upload-credentials` (Line 40-44)
**Operation:** SELECT FROM EmployeeDetails
**Frequency:** Per bulk upload (validates all emails in batch)
**Query:**
```sql
SELECT Emp_Code, Employee_Name, LOWER(Employee_EmailID) as email
FROM ${DATABRICKS_SCHEMA}.EmployeeDetails
WHERE LOWER(Employee_EmailID) IN (?, ?, ...)
```

### 6. **Voucher Management Queries**

#### 6.1 Request Voucher - Employee Lookup
**Location:** `voucher.js` - `/api/request-voucher` (Line 124-127)
**Operation:** SELECT FROM EmployeeDetails
**Frequency:** Per voucher request
**Query:**
```sql
SELECT Emp_Code FROM ${DATABRICKS_SCHEMA}.EmployeeDetails
WHERE LOWER(Employee_EmailID) = ?
```

#### 6.2 Request Voucher - Max ID
**Location:** `voucher.js` - `/api/request-voucher` (Line 139)
**Operation:** SELECT MAX(id)
**Frequency:** Per voucher request (to generate new ID)
**Query:**
```sql
SELECT MAX(id) as max_id FROM emp_cred_dev.emp_credentials.voucher_requests
```

#### 6.3 All Voucher Requests (Admin)
**Location:** `voucher.js` - `/api/admin/all-requests` (Line 216-225)
**Operation:** SELECT with LEFT JOIN
**Frequency:** Per admin requests page load
**Query:**
```sql
SELECT vr.id AS request_id, vr.user_id, vr.cert_type, vr.cert_provider,
       vr.status, vr.requested_at AS request_date, vr.voucher_id,
       vr.scheduled_at AS exam_date, vr.exam_status AS result,
       vr.approved_at, vr.rejected_at, vr.fulfilled_at, vr.personal_email,
       ed.Employee_Name AS user_name, ed.Employee_EmailID AS user_email
FROM emp_cred_dev.emp_credentials.voucher_requests vr
LEFT JOIN ${DATABRICKS_SCHEMA}.EmployeeDetails ed ON vr.user_id = ed.Emp_Code
ORDER BY vr.requested_at DESC
```

#### 6.4 Employee Voucher Requests
**Location:** `voucher.js` - `/api/employee/requests/:emp_code` (Line 250-260)
**Operation:** SELECT with LEFT JOIN
**Frequency:** Per employee requests page load
**Query:**
```sql
SELECT vr.id AS request_id, vr.user_id, vr.cert_type, vr.cert_provider,
       vr.status, vr.requested_at AS request_date, vr.voucher_id,
       vr.scheduled_at AS exam_date, vr.exam_status AS result,
       vr.approved_at, vr.rejected_at, vr.fulfilled_at, vr.personal_email,
       ed.Employee_Name AS user_name, ed.Employee_EmailID AS user_email
FROM emp_cred_dev.emp_credentials.voucher_requests vr
LEFT JOIN ${DATABRICKS_SCHEMA}.EmployeeDetails ed ON vr.user_id = ed.Emp_Code
WHERE vr.user_id = ?
ORDER BY vr.requested_at DESC
```

#### 6.5 Approve and Assign - Request Lookup
**Location:** `voucher.js` - `/api/approve-and-assign` (Line 312)
**Operation:** SELECT FROM voucher_requests
**Frequency:** Per approval action
**Query:**
```sql
SELECT cert_type FROM emp_cred_dev.emp_credentials.voucher_requests
WHERE id = ?
```

#### 6.6 Approve and Assign - Voucher Lookup
**Location:** `voucher.js` - `/api/approve-and-assign` (Line 321)
**Operation:** SELECT FROM voucher_codes
**Frequency:** Per approval action (if voucher available)
**Query:**
```sql
SELECT Voucher_Code FROM emp_cred_dev.emp_credentials.voucher_codes
WHERE Credential_Name = ? AND status = 'not assigned'
ORDER BY Expiry_Date ASC LIMIT 1
```

#### 6.7 Get Full Request Details (Helper Function)
**Location:** `voucher.js` - `getFullRequestDetails()` (Line 84-106)
**Operation:** SELECT with LEFT JOIN
**Frequency:** After every voucher request update/approval/rejection
**Query:**
```sql
SELECT vr.id AS request_id, vr.user_id, vr.cert_type, vr.cert_provider,
       vr.status, vr.requested_at AS request_date, vr.voucher_id,
       vr.scheduled_at AS exam_date, vr.exam_status AS result,
       vr.approved_at, vr.rejected_at, vr.fulfilled_at, vr.personal_email,
       ed.Employee_Name AS user_name, ed.Employee_EmailID AS user_email
FROM emp_cred_dev.emp_credentials.voucher_requests vr
LEFT JOIN ${DATABRICKS_SCHEMA}.EmployeeDetails ed ON vr.user_id = ed.Emp_Code
WHERE vr.id = ?
```

---

## Summary Statistics

### Total Operations by Type:
- **DDL:** 0 operations
- **DML:** 12 unique operations
  - MERGE: 4 operations
  - INSERT: 2 operations
  - UPDATE: 5 operations
- **DQL:** 20 unique SELECT queries

### High-Frequency Operations (Potential Optimization Targets):
1. **Email Login** - 2 queries per login (EmployeeDetails + v_credentials)
2. **Add Certificate** - 2 queries per upload (MERGE + SELECT)
3. **Scraper** - N+1 queries (1 MERGE per credential + 1 final SELECT)
4. **Voucher Approval** - 3-4 queries per approval (SELECT request + SELECT voucher + UPDATE voucher + UPDATE request + SELECT full details)
5. **Leaderboard** - Complex aggregation queries on page load
6. **Admin Employee Directory** - JOIN with aggregation on page load

### Tables/Views Accessed:
1. `EmployeeDetails` - Master employee table
2. `credentials` - Credentials storage table
3. `v_credentials` - Dynamic view (calculates status)
4. `voucher_requests` - Voucher request tracking
5. `voucher_codes` - Available voucher inventory

---

## Recommendations for Cost Reduction

1. **Implement Caching:**
   - Cache leaderboard results (refresh every 5-10 minutes)
   - Cache employee directory (refresh hourly)
   - Cache credentials summary (refresh every 15 minutes)

2. **Batch Operations:**
   - Combine email login queries into single query with JOIN
   - Reduce scraper queries by batching MERGE operations (already sequential, but could batch multiple records)

3. **Optimize High-Frequency Queries:**
   - Add indexes on frequently filtered columns (emp_code, Employee_EmailID, credential_title)
   - Consider materialized views for leaderboard aggregations

4. **Reduce Redundant Queries:**
   - Post-upsert SELECT queries could be eliminated if MERGE returns the updated record
   - `getFullRequestDetails` is called after every update - consider returning data from UPDATE

5. **Connection Pooling:**
   - Current pattern opens/closes connection per request - consider connection pooling

---

## Migration Notes for Lakebase

When migrating to Lakebase, ensure:
- All MERGE operations are supported (Delta Lake syntax)
- Views (`v_credentials`) are recreated
- Schema references (`${DATABRICKS_SCHEMA}`) are updated
- Connection string and authentication method are updated
- Transaction isolation levels are compatible


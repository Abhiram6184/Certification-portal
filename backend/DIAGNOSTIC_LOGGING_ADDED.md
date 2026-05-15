# Diagnostic Logging Added - Scraping Flow Analysis

## Summary
Added comprehensive diagnostic logging throughout the scraping flow to identify where credentials are being lost.

## Logging Points Added

### 1. Tile Extraction Phase (Lines ~371-407)

**Added:**
- Log initial tile count vs expected count
- Track extraction errors per tile with reason
- Log final extracted count vs total tiles
- Warn if tiles are lost during extraction

**What it tracks:**
- Which tiles fail extraction (missing title/href)
- Why they failed (timeout, missing element, etc.)
- Count of lost tiles

**Example Output:**
```
[Scraper] Starting extraction from 9 tiles...
[Scraper] Extraction complete: 9 valid tiles extracted from 9 total tiles.
[Scraper] ⚠️ 2 tile(s) failed extraction: [
  { tileIndex: 3, reason: 'Missing title', title: 'N/A' },
  { tileIndex: 7, reason: 'Extraction error: Timeout 5000ms exceeded' }
]
```

### 2. Expiry Date Fetching Phase (Lines ~409-438)

**Added:**
- Log start of expiry date fetching
- Track success/failure for each credential
- Log expiry fetch errors with details
- Validate array length matches
- Validate result structure

**What it tracks:**
- Which credentials have expiry date fetch failures
- Error messages for failed fetches
- Array length mismatches (critical issue)

**Example Output:**
```
[Scraper] Fetching expiry dates for 9 credentials...
[Scraper] Expiry date fetch complete: 7 successful, 2 failed.
[Scraper] ⚠️ 2 credential(s) had expiry date fetch errors: [
  { title: 'Databricks Certified Data Engineer', error: 'Timeout 60000ms exceeded' }
]
[Scraper] ❌ CRITICAL: Array length mismatch! tileData: 9, expiryDates: 7
```

### 3. Data Combination Phase (Lines ~440-470)

**Added:**
- Log each credential being combined
- Track index out of bounds errors
- Filter out nulls from combination errors
- Final summary with breakdown

**What it tracks:**
- Index misalignment issues
- Credentials lost during combination
- Final count vs initial count

**Example Output:**
```
[Scraper] Successfully scraped 7 credentials for username.
[Scraper] Summary: 9 tiles → 9 extracted → 7 final credentials
[Scraper] ⚠️ WARNING: 2 credential(s) were lost during scraping process!
[Scraper] Breakdown: 9 tiles - 0 extraction errors - 2 combination errors = 7 final
```

### 4. Database Upsert Phase (Lines ~478-600)

**Added:**
- Log start of upsert with count
- Log each credential being processed (with index)
- Track failed credentials with reasons
- Detailed error logging with stack traces
- Final validation of processed count

**What it tracks:**
- Which credentials are skipped (missing title/ID)
- Which credentials fail database operations
- Database error details
- Count mismatches

**Example Output:**
```
[Lakebase] Starting upsert for 7 credentials...
[Lakebase] Processing credential 1/7: "Databricks Certified Data Engineer"
[Lakebase] ❌ Skipping credential 3: Missing title. Credential ID: abc123
[Lakebase] ❌ Failed to upsert credential 5 "Some Title": Database error: duplicate key value
[Lakebase] Sequential upsert complete: 3 inserted, 2 updated, 2 errors, 7 total processed
[Lakebase] ⚠️ WARNING: 2 credential(s) failed to upsert:
[Lakebase]   - Credential 3: "N/A" (ID: abc123) - Missing title
[Lakebase]   - Credential 5: "Some Title" (ID: xyz789) - Database error: duplicate key value
```

### 5. Re-fetch and Filtering Phase (Lines ~650-700)

**Added:**
- Log scraped titles set (normalized)
- Log each title match/mismatch
- Track missing titles with original credential info
- Final summary with all counts

**What it tracks:**
- Which scraped credentials are found in DB
- Which scraped credentials are missing from DB
- Title normalization mismatches
- Final count comparison

**Example Output:**
```
[Scraper] Filtering results: 7 scraped credentials, 7 unique titles after normalization
[Scraper] Scraped titles set: ['databricks certified data engineer', 'databricks certified ml engineer', ...]
[Scraper] ⚠️ WARNING: 2 scraped credential(s) not found in DB after upsert:
[Scraper]   - Missing title: "databricks certified data engineer"
[Scraper]     Original: Title="Databricks Certified Data Engineer", ID="abc123"
[Scraper] Final summary:
[Scraper]   - Scraped: 7 credentials
[Scraper]   - Total in DB: 5 credentials
[Scraper]   - Matched and returned: 5 credentials
[Scraper]   - Missing from DB: 2 credentials
[Scraper] ❌ CRITICAL: 2 credential(s) were lost! Scraped 7 but only 5 returned.
```

## Key Issues Identified

### Issue 1: Tile Extraction Failures
- **Location**: Lines 380-402
- **Problem**: Tiles with missing title or href are filtered out
- **Impact**: Credentials lost before processing
- **Detection**: Logged in `tileExtractionErrors` array

### Issue 2: Expiry Date Fetch Failures
- **Location**: Lines 412-438
- **Problem**: If expiry fetch fails, credential continues but might have wrong data
- **Impact**: Credential proceeds but data might be incomplete
- **Detection**: Logged in `expiryFetchErrors` array

### Issue 3: Array Length Mismatch
- **Location**: Lines 440-470
- **Problem**: `tileData` and `expiryDates` arrays might not match
- **Impact**: Index misalignment when combining data
- **Detection**: Validated and logged

### Issue 4: Database Validation Failures
- **Location**: Lines 490-500
- **Problem**: Credentials with missing title/ID are skipped
- **Impact**: Credentials lost during upsert
- **Detection**: Logged in `failedCredentials` array

### Issue 5: Database Operation Failures
- **Location**: Lines 570-580
- **Problem**: Database errors caught but credential lost
- **Impact**: Credentials fail silently
- **Detection**: Logged with full error details

### Issue 6: Title Matching Failures
- **Location**: Lines 650-700
- **Problem**: Title normalization might not match between scraped and stored
- **Impact**: Credentials not found in re-fetch
- **Detection**: Logged with missing titles and original data

## How to Use This Logging

1. **Run a scrape** and check the logs
2. **Look for warnings** (⚠️) - these indicate potential issues
3. **Look for critical errors** (❌) - these indicate data loss
4. **Check the breakdowns** - they show where credentials are lost
5. **Compare counts** at each phase to identify the loss point

## Next Steps

1. Run scraping with this logging enabled
2. Analyze logs to identify the specific failure point
3. Fix the identified issue
4. Verify with another scrape that all credentials are processed


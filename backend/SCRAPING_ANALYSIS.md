# End-to-End Scraping Flow Analysis

## Problem Statement
1. Sometimes application fails to upsert data
2. Sometimes scrapes 9 credentials but only upserts 7 (2 missing)

## Flow Analysis

### Phase 1: Scraping (scrapeCredentials function)

#### Step 1.1: Extract Basic Tile Info (Lines 379-390)
```javascript
const tileDataPromises = tiles.map(async (tile) => {
    const title = await tile.locator('h2').first().textContent({ timeout: 5000 }).catch(() => null);
    const issuedOnText = await tile.locator('div.issued-on').first().textContent({ timeout: 5000 }).catch(() => null);
    const issuedOn = issuedOnText ? issuedOnText.replace(/issued on/i, '').trim() : null;
    const href = await tile.locator("a").first().getAttribute("href");
    if (!href || !title) return null;  // ⚠️ POTENTIAL LOSS POINT #1
    const credential_id = href.split("/").pop();
    const detailUrl = `${baseUrl}${href}`;
    return { credential_id, title, issuedOn, detailUrl };
});
const tileData = (await Promise.all(tileDataPromises)).filter(Boolean); // ⚠️ Filters out nulls
```

**ISSUE #1**: If a tile has no `title` or `href`, it returns `null` and gets filtered out.
- **Impact**: Credential is lost before expiry date fetching
- **Why it happens**: 
  - Tile might not be fully loaded
  - Selector might not match
  - Timeout (5 seconds) might be too short

#### Step 1.2: Fetch Expiry Dates (Lines 392-414)
```javascript
const expiryDatePromises = tileData.map(async (data) => {
    const detailPage = await context.newPage();
    try {
        await detailPage.goto(data.detailUrl, { timeout: 0, waitUntil: 'networkidle' });
        const locator = detailPage.locator('div.expires-on');
        await locator.waitFor({ state: 'visible', timeout: 60000 });
        // ... extract expiry
    } catch (e) {
        console.warn(`[Scraper] Could not find expiry date for ${data.title}...`);
        return 'Does not expire';  // ⚠️ Returns default, doesn't fail
    } finally {
        await detailPage.close();
    }
});
const expiryDates = await Promise.all(expiryDatePromises);
```

**ISSUE #2**: If expiry date fetch fails, it returns default but credential continues.
- **Impact**: Credential proceeds but might have wrong expiry date
- **Why it happens**:
  - Detail page might not load
  - Selector might not exist
  - Network timeout

#### Step 1.3: Combine Data (Lines 418-430)
```javascript
const results = tileData.map((data, index) => {
    const expiryDate = expiryDates[index];
    const finalCredential = { ...data, expiryDate };
    return finalCredential;
});
```

**ISSUE #3**: Array mapping assumes `tileData` and `expiryDates` are same length.
- **Impact**: If expiry fetch fails silently, index might mismatch
- **Why it happens**: Promise.all might not maintain exact order if some fail

### Phase 2: Upsert (insertOrUpdateCredentials function)

#### Step 2.1: Validation (Lines 481-491)
```javascript
if (!cred.title || !cred.title.trim()) {
    console.error(`[Lakebase] Skipping credential with missing title...`);
    errorCount++;
    continue;  // ⚠️ POTENTIAL LOSS POINT #2
}

if (!cred.credential_id || !cred.credential_id.trim()) {
    console.error(`[Lakebase] Skipping credential with missing credential_id...`);
    errorCount++;
    continue;  // ⚠️ POTENTIAL LOSS POINT #3
}
```

**ISSUE #4**: Credentials with missing title or ID are skipped.
- **Impact**: Credential is lost, counted as error
- **Why it happens**: Data might be corrupted or incomplete

#### Step 2.2: Check Existing Record (Lines 498-505)
```javascript
const checkQuery = `
    SELECT credential_id
    FROM ${process.env.LAKEBASE_SCHEMA}.credentials
    WHERE TRIM(LOWER(credential_title)) = $1
      AND emp_code = $2
    LIMIT 1
`;
const checkResult = await pgClient.query(checkQuery, [normalizedTitle, emp_code]);
```

**ISSUE #5**: Matching uses normalized title + emp_code.
- **Impact**: If title normalization differs, might not find existing record
- **Why it happens**: 
  - Different whitespace handling
  - Case sensitivity issues
  - Special characters

#### Step 2.3: Update or Insert (Lines 507-552)
```javascript
if (checkResult.rows.length > 0) {
    // UPDATE
    await pgClient.query(updateQuery, [...]);
} else {
    // INSERT
    await pgClient.query(insertQuery, [...]);
}
```

**ISSUE #6**: Database errors are caught per credential but don't stop the loop.
- **Impact**: Some credentials might fail silently
- **Why it happens**:
  - Constraint violations
  - Data type mismatches
  - Connection issues

### Phase 3: Re-fetch and Filter (Lines 620-637)

#### Step 3.1: Re-fetch All Credentials
```javascript
const finalCredentialsQuery = `
    SELECT credential_id, credential_title as title, ...
    FROM ${process.env.LAKEBASE_SCHEMA}.v_credentials
    WHERE emp_code = $1
`;
const finalResult = await pgClient.query(finalCredentialsQuery, [user.id]);
```

#### Step 3.2: Filter by Scraped Titles
```javascript
const scrapedTitles = new Set(scraped.credentials
    .filter(c => c.title && c.title.trim())
    .map(c => c.title.trim().toLowerCase())
);
const newlyAddedOrUpdated = finalResult.rows.filter(c => 
    scrapedTitles.has((c.title || '').trim().toLowerCase())
);
```

**ISSUE #7**: Filtering uses title matching, but titles might differ.
- **Impact**: Credentials might not match if:
  - Title has different casing
  - Title has extra whitespace
  - Title was normalized differently in DB
- **Why it happens**: Normalization might not be consistent

## Root Cause Analysis

### Scenario: 9 Scraped, 7 Upserted

**Possible Causes:**

1. **2 tiles filtered out during extraction** (Line 390)
   - Missing title or href
   - Timeout during extraction

2. **2 credentials skipped during validation** (Lines 481-491)
   - Missing title or credential_id
   - Data corruption

3. **2 credentials failed during database operation** (Lines 553-557)
   - Database errors caught and logged
   - Error count incremented but credential lost

4. **2 credentials don't match during re-fetch filtering** (Lines 631-637)
   - Title normalization mismatch
   - Titles differ between scraped and stored

5. **Array length mismatch** (Line 418)
   - `tileData` and `expiryDates` arrays might not align
   - If expiry fetch fails, index might be wrong

## Diagnostic Recommendations

### Add Detailed Logging

1. **Log tile extraction results**:
   - Count tiles before extraction
   - Log which tiles return null and why
   - Log final tileData count

2. **Log expiry date fetching**:
   - Log success/failure for each credential
   - Log which credentials have missing expiry dates

3. **Log database operations**:
   - Log each credential being processed
   - Log check query results
   - Log insert/update success

4. **Log filtering results**:
   - Log scraped titles set
   - Log found titles set
   - Log missing titles with details

### Add Validation Checks

1. **Verify array lengths match**:
   - Check `tileData.length === expiryDates.length`
   - Check `scraped.credentials.length === results.length`

2. **Track processed credentials**:
   - Log which credentials are being processed
   - Log which credentials succeed/fail

3. **Verify database state**:
   - After upsert, verify all credentials were saved
   - Compare counts before and after


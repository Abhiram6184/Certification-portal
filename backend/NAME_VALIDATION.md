# Name Validation During Scraping

## Overview
Before scraping credentials, the system validates that the name on the Databricks wallet page matches the employee name in the database. This prevents scraping credentials from the wrong profile.

## How It Works

### 1. Name Normalization
Names are normalized before comparison to handle cases where organizations add numbers to distinguish employees with the same name:
- **Database**: "James Roy 1" → Normalized: "James Roy"
- **Database**: "James Roy 2" → Normalized: "James Roy"
- **Wallet Page**: "James Roy" → Normalized: "James Roy"
- **Result**: ✅ Match (both normalize to "James Roy")

### 2. Jaccard Similarity (Token Overlap Matching)
Names are compared using Jaccard similarity (intersection/union ratio) to handle different name orders:
- **Database**: "Harsha James Aurthur 2" → Words: ["harsha", "james", "aurthur"] (numbers filtered)
- **Wallet Page**: "James Aurthur Harsha" → Words: ["james", "aurthur", "harsha"]
- **Intersection**: { "harsha", "james", "aurthur" } → 3 words
- **Union**: { "harsha", "james", "aurthur" } → 3 unique words
- **Jaccard**: 3/3 = 1.0 (100% match) ✅

### 3. Validation Flow

1. **Fetch Employee Name from Database**
   - Query `employeedetails` table using `emp_code`
   - Get `employee_name` field

2. **Scrape Name from Wallet Page**
   - Navigate to Databricks wallet URL
   - Extract name from `h1.mat-h1` element

3. **Normalize Both Names**
   - Remove trailing numbers from full name (e.g., " 1", " 2")
   - Split into words by spaces
   - Remove trailing numbers from each word
   - Trim whitespace and convert to lowercase

4. **Calculate Jaccard Similarity**
   - Split both names into word arrays
   - Filter out pure numbers (using `/^\d+$/` regex)
   - Create sets from words
   - Calculate intersection (words in both sets)
   - Calculate union (all unique words from either set)
   - Jaccard = intersection.size / union.size
   - If Jaccard === 1.0: ✅ Perfect match, continue scraping
   - If Jaccard < 1.0: ⚠️ Warn but continue (allows for edge cases)

## Name Comparison Logic (Jaccard Similarity)

### Step 1: Normalize Full Name
```javascript
const normalizeName = (name) => {
    // Remove trailing numbers and whitespace
    // "James Roy 1" → "James Roy"
    // "John Doe 2" → "John Doe"
    return name.trim().replace(/\s+\d+$/, '').trim();
};
```

### Step 2: Filter Pure Numbers & Calculate Jaccard
```javascript
const compareNames = (name1, name2) => {
    // Split into words, normalize, filter out pure numbers
    const words1 = name1.split(/\s+/)
        .map(w => w.trim().toLowerCase())
        .filter(w => w.length > 0 && !/^\d+$/.test(w)); // Filter pure numbers
    
    const words2 = name2.split(/\s+/)
        .map(w => w.trim().toLowerCase())
        .filter(w => w.length > 0 && !/^\d+$/.test(w)); // Filter pure numbers
    
    // Convert to sets
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    // Calculate intersection (words in both)
    const intersection = new Set([...set1].filter(w => set2.has(w)));
    
    // Calculate union (all unique words)
    const union = new Set([...set1, ...set2]);
    
    // Jaccard similarity = intersection / union
    const jaccard = intersection.size / union.size;
    
    // Perfect match = 1.0 (100% overlap)
    return jaccard === 1.0;
};
```

### Examples

| Database Name | Wallet Name | DB Words | Wallet Words | Intersection | Union | Jaccard | Match? |
|--------------|-------------|----------|--------------|--------------|-------|---------|--------|
| "James Roy 1" | "James Roy" | ["james", "roy"] | ["james", "roy"] | 2 | 2 | 1.0 | ✅ Yes |
| "Harsha James Aurthur 2" | "James Aurthur Harsha" | ["harsha", "james", "aurthur"] | ["james", "aurthur", "harsha"] | 3 | 3 | 1.0 | ✅ Yes |
| "John Doe 2" | "Doe John" | ["john", "doe"] | ["doe", "john"] | 2 | 2 | 1.0 | ✅ Yes |
| "Jane Smith" | "Jane Smith" | ["jane", "smith"] | ["jane", "smith"] | 2 | 2 | 1.0 | ✅ Yes |
| "Bob Johnson 1" | "Robert Johnson" | ["bob", "johnson"] | ["robert", "johnson"] | 1 | 3 | 0.33 | ❌ No |
| "Alice Brown" | "Alice Brown 1" | ["alice", "brown"] | ["alice", "brown"] | 2 | 2 | 1.0 | ✅ Yes |
| "Mary Jane Watson" | "Watson Mary Jane" | ["mary", "jane", "watson"] | ["watson", "mary", "jane"] | 3 | 3 | 1.0 | ✅ Yes |
| "Peter Parker" | "Parker Peter" | ["peter", "parker"] | ["parker", "peter"] | 2 | 2 | 1.0 | ✅ Yes |
| "James Roy 1" | "John Roy" | ["james", "roy"] | ["john", "roy"] | 1 | 3 | 0.33 | ❌ No |

## Logging

### Successful Match
```
[Scraper] Found employee name in database: "Harsha James Aurthur 2" for emp_code: HRM3611
[Scraper] ✅ Name validation passed: Jaccard similarity = 100% (perfect match)
         Expected: "Harsha James Aurthur 2" → Scraped: "James Aurthur Harsha"
         Word sets match: [harsha, james, aurthur] (order-independent, numbers filtered)
```

### Mismatch Warning
```
[Scraper] Found employee name in database: "James Roy 1" for emp_code: HRM3611
[Scraper] ⚠️ Name mismatch detected (Jaccard similarity: 33.3%):
         Expected (from DB): "James Roy 1"
         Scraped (from page): "John Roy"
         Expected words: [james, roy]
         Scraped words: [john, roy]
         Intersection: [roy] (1 words)
         Union: [james, roy, john] (3 words)
[Scraper] Jaccard similarity 33.3% < 100%. Proceeding with scrape, but please verify this is the correct profile.
```

### Missing Name
```
[Scraper] Could not find employee name in database for emp_code: HRM3611. Skipping name validation.
```

## Behavior

### ✅ Match Found
- Logs success message
- Continues with scraping normally

### ⚠️ Mismatch Detected
- Logs warning with both names
- **Still continues scraping** (allows for edge cases)
- Admin should verify manually

### ❌ Name Not Found
- If database name not found: Skips validation, continues scraping
- If wallet page name not found: Warns, continues scraping

## Why Continue on Mismatch?

The system continues scraping even on name mismatch because:
1. **Edge Cases**: Names might be slightly different but still valid (nicknames, middle names, etc.)
2. **Data Quality**: Database names might be outdated
3. **Manual Verification**: Admin can verify later using the warning logs
4. **Non-Blocking**: Prevents blocking legitimate scrapes due to minor name differences

## Future Enhancements

Potential improvements:
- Add configuration option to **block scraping** on mismatch (strict mode)
- Add **similarity scoring** (fuzzy matching) instead of exact match
- Store mismatch events in a separate table for review
- Send notification to admin on mismatch

## Code Location

- **Normalization Functions**: `backend-scraper/scraper.js` (lines 20-35)
- **Validation Logic**: `backend-scraper/scraper.js` (lines 75-95)
- **Employee Lookup**: `backend-scraper/scraper.js` (lines 462-479)


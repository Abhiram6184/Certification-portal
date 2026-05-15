import { chromium } from "playwright";
import { getPgClientFromPool } from "./lakebase.js";

// Browser instance management
let browserInstance = null;

// Helper: race a promise against a timeout
const withTimeout = (promise, ms, label = 'Operation') => {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        })
    ]).finally(() => clearTimeout(timer));
};

export const getBrowser = async () => {
    const BROWSER_WS = process.env.BROWSER_WS_ENDPOINT;

    // Check if the cached browser is still alive
    if (browserInstance) {
        try {
            if (!browserInstance.isConnected()) {
                console.warn('[Scraper] Cached browser instance is disconnected. Reconnecting...');
                browserInstance = null;
            }
        } catch (e) {
            console.warn('[Scraper] Cached browser instance is stale. Reconnecting...');
            browserInstance = null;
        }
    }

    if (!browserInstance) {
        const CONNECT_TIMEOUT_MS = 30000; // 30 second timeout for browser connection
        const MAX_RETRIES = 2;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (BROWSER_WS) {
                    console.log(`[Scraper] Connecting to remote browser (attempt ${attempt}/${MAX_RETRIES}): ${BROWSER_WS.substring(0, 40)}...`);
                    browserInstance = await withTimeout(
                        chromium.connectOverCDP(BROWSER_WS),
                        CONNECT_TIMEOUT_MS,
                        'Browser connection'
                    );
                    console.log('[Scraper] Connected to remote browser.');
                } else {
                    console.log('[Scraper] Launching local browser...');
                    browserInstance = await withTimeout(
                        chromium.launch({ headless: true }),
                        CONNECT_TIMEOUT_MS,
                        'Local browser launch'
                    );
                }

                // Automatically clear the cache if the browser disconnects
                browserInstance.on('disconnected', () => {
                    console.warn('[Scraper] Browser disconnected event received. Clearing cached instance.');
                    browserInstance = null;
                });

                break; // Success - exit retry loop
            } catch (err) {
                console.error(`[Scraper] Browser connection attempt ${attempt} failed: ${err.message}`);
                browserInstance = null;
                if (attempt === MAX_RETRIES) {
                    throw new Error(`Failed to connect to browser after ${MAX_RETRIES} attempts: ${err.message}`);
                }
                // Brief delay before retry
                const delay = attempt * 2000;
                console.log(`[Scraper] Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    return browserInstance;
};

export const closeBrowser = async () => {
    if (browserInstance) {
        try {
            await browserInstance.close();
        } catch (e) {
            console.warn('[Scraper] Error closing browser:', e.message);
        }
        browserInstance = null;
    }
};

// Name Normalization function
// Removes trailing numbers from names (e.g., "James Roy 1" -> "James Roy")
// This handles cases where organizations add numbers to distinguish employees with same names
const normalizeName = (name) => {
    if (!name || typeof name !== 'string') {
        return '';
    }
    // Remove trailing numbers and whitespace
    // Pattern: matches one or more digits at the end, optionally preceded by spaces
    return name.trim().replace(/\s+\d+$/, '').trim();
};

// Name Comparison function using Jaccard Similarity
// Compares two names by calculating token overlap (order-independent)
// Uses Jaccard similarity = intersection / union
// Perfect match = 1.0 (100% overlap)
// Filters out pure numbers before comparison
const compareNames = (name1, name2) => {
    if (!name1 || !name2) {
        return false;
    }

    // Normalize and split into words
    const normalized1 = normalizeName(name1);
    const normalized2 = normalizeName(name2);

    // Split by spaces, normalize each word, and filter out pure numbers
    const words1 = normalized1
        .split(/\s+/)
        .map(word => word.trim().toLowerCase())
        .filter(word => word.length > 0 && !/^\d+$/.test(word)); // Remove empty strings and pure numbers

    const words2 = normalized2
        .split(/\s+/)
        .map(word => word.trim().toLowerCase())
        .filter(word => word.length > 0 && !/^\d+$/.test(word)); // Remove empty strings and pure numbers

    // If either name has no words after filtering, they don't match
    if (words1.length === 0 || words2.length === 0) {
        return false;
    }

    // Convert to sets for set operations
    const set1 = new Set(words1);
    const set2 = new Set(words2);

    // Calculate intersection (words in both sets)
    const intersection = new Set([...set1].filter(word => set2.has(word)));

    // Calculate union (all unique words from either set)
    const union = new Set([...set1, ...set2]);

    // Calculate Jaccard similarity
    const jaccardSimilarity = intersection.size / union.size;

    // Perfect match = 1.0 (100% overlap, all words present in both)
    return jaccardSimilarity === 1.0;
};

// URL Normalization function
// Extracts username from various credential wallet URLs and normalizes to Databricks format
const normalizeCredentialUrl = (profileUrl) => {
    try {
        // Extract username from URL patterns:
        // 1. https://www.credential.net/profile/username/wallet
        // 2. https://credentials.databricks.com/profile/username/wallet
        // 3. https://credential.net/profile/username/wallet (without www)
        // 4. Any other variation with /profile/username/ pattern

        const urlMatch = profileUrl.match(/\/profile\/([^\/]+)/);
        if (!urlMatch || !urlMatch[1]) {
            throw new Error(`Could not extract username from URL: ${profileUrl}`);
        }

        const username = urlMatch[1];

        // Normalize to Databricks format
        const normalizedUrl = `https://credentials.databricks.com/profile/${username}/wallet`;

        console.log(`[Scraper] Normalized URL: ${profileUrl} -> ${normalizedUrl}`);
        return { normalizedUrl, username };
    } catch (error) {
        console.error(`[Scraper] URL normalization failed: ${error.message}`);
        throw new Error(`Invalid credential wallet URL format: ${profileUrl}. Expected format: .../profile/username/wallet`);
    }
};

// Scraper function
const scrapeCredentials = async (profileUrl, expectedEmployeeName = null) => {
    // Normalize URL to Databricks format
    const { normalizedUrl, username } = normalizeCredentialUrl(profileUrl);
    const baseUrl = new URL(normalizedUrl).origin;
    const browser = await getBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // Name validation happens early - before any scraping
        // This ensures we don't waste time scraping if validation fails
        console.log(`[Scraper] Navigating to normalized URL: ${normalizedUrl}`);
        await page.goto(normalizedUrl, { timeout: 60000, waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2000);

        if (await page.locator("h1:has-text('404')").isVisible({ timeout: 5000 })) {
            throw new Error("Profile not found (404 error)");
        }

        let profileFullName = username;
        try {
            // Try multiple selectors to find the name
            // Primary: Specific CSS selector from the page structure
            let nameLocator = page.locator('#main-content > ng-component > div > div.main-header > div > div > div > div > h1');
            let nameFound = false;

            try {
                await nameLocator.waitFor({ state: 'visible', timeout: 5000 });
                // Get raw HTML for debugging
                const rawHtml = await nameLocator.innerHTML().catch(() => null);
                if (rawHtml) {
                    console.log(`[Scraper] Raw HTML from name element: ${rawHtml}`);
                }
                // Try innerText first (handles text better, respects visibility)
                let fullName = await nameLocator.innerText().catch(() => null);
                // Fallback to textContent if innerText fails
                if (!fullName) {
                    fullName = await nameLocator.textContent();
                }
                if (fullName && fullName.trim()) {
                    profileFullName = fullName.trim();
                    nameFound = true;
                    // Log raw extracted text for debugging
                    console.log(`[Scraper] Found name using CSS selector: "${profileFullName}"`);
                    console.log(`[Scraper] Raw name length: ${profileFullName.length}`);
                    console.log(`[Scraper] Raw name character codes: [${Array.from(profileFullName).map((c, i) => `'${c}'(${c.charCodeAt(0)})`).join(', ')}]`);
                    // Check for common character issues
                    if (profileFullName.includes('harshavrdhan') || profileFullName.toLowerCase().includes('harshavrdhan')) {
                        console.warn(`[Scraper] ⚠️ WARNING: Detected potential typo in scraped name - missing 'a' in "harshavardhan"`);
                    }
                }
            } catch (e) {
                console.warn(`[Scraper] CSS selector failed, trying XPath...`);
            }

            // Fallback: XPath selector
            if (!nameFound) {
                try {
                    nameLocator = page.locator('xpath=/html/body/rp-root/mat-sidenav-container/mat-sidenav-content/main/ng-component/div/div[1]/div/div/div/div/h1');
                    await nameLocator.waitFor({ state: 'visible', timeout: 5000 });
                    // Try innerText first (handles text better, respects visibility)
                    let fullName = await nameLocator.innerText().catch(() => null);
                    // Fallback to textContent if innerText fails
                    if (!fullName) {
                        fullName = await nameLocator.textContent();
                    }
                    if (fullName && fullName.trim()) {
                        profileFullName = fullName.trim();
                        nameFound = true;
                        console.log(`[Scraper] Found name using XPath: "${profileFullName}"`);
                        console.log(`[Scraper] Raw name length: ${profileFullName.length}, characters: [${Array.from(profileFullName).map(c => c.charCodeAt(0)).join(', ')}]`);
                    }
                } catch (e) {
                    console.warn(`[Scraper] XPath selector failed, trying generic selector...`);
                }
            }

            // Fallback: Generic h1.mat-h1 selector
            if (!nameFound) {
                try {
                    nameLocator = page.locator('h1.mat-h1');
                    await nameLocator.waitFor({ state: 'visible', timeout: 5000 });
                    // Try innerText first (handles text better, respects visibility)
                    let fullName = await nameLocator.innerText().catch(() => null);
                    // Fallback to textContent if innerText fails
                    if (!fullName) {
                        fullName = await nameLocator.textContent();
                    }
                    if (fullName && fullName.trim()) {
                        profileFullName = fullName.trim();
                        nameFound = true;
                        console.log(`[Scraper] Found name using generic selector: "${profileFullName}"`);
                        console.log(`[Scraper] Raw name length: ${profileFullName.length}, characters: [${Array.from(profileFullName).map(c => c.charCodeAt(0)).join(', ')}]`);
                    }
                } catch (e) {
                    console.warn(`[Scraper] Generic selector also failed.`);
                }
            }

            if (!nameFound) {
                console.warn(`[Scraper] Could not find employee name for user: ${username}. Will fall back to username.`);
            }
        } catch (e) {
            console.warn(`[Scraper] Error while trying to find employee name: ${e.message}. Will fall back to username.`);
        }

        // Name validation: Compare scraped name with expected name from database
        // Uses Jaccard similarity (token overlap) to handle different name orders
        // BLOCKS scraping if validation fails
        if (expectedEmployeeName && profileFullName) {
            // Log raw scraped name for debugging
            console.log(`[Scraper] Raw scraped name: "${profileFullName}" (length: ${profileFullName.length})`);
            console.log(`[Scraper] Raw expected name: "${expectedEmployeeName}" (length: ${expectedEmployeeName.length})`);

            // Calculate word sets for detailed logging
            const normalizedExpected = normalizeName(expectedEmployeeName);
            const normalizedScraped = normalizeName(profileFullName);

            console.log(`[Scraper] Normalized expected: "${normalizedExpected}"`);
            console.log(`[Scraper] Normalized scraped: "${normalizedScraped}"`);

            const wordsExpected = normalizedExpected
                .split(/\s+/)
                .map(w => w.trim().toLowerCase())
                .filter(w => w.length > 0 && !/^\d+$/.test(w));

            const wordsScraped = normalizedScraped
                .split(/\s+/)
                .map(w => w.trim().toLowerCase())
                .filter(w => w.length > 0 && !/^\d+$/.test(w));

            console.log(`[Scraper] Expected word breakdown:`, wordsExpected.map((w, i) => `[${i}] "${w}" (${w.length} chars)`));
            console.log(`[Scraper] Scraped word breakdown:`, wordsScraped.map((w, i) => `[${i}] "${w}" (${w.length} chars)`));

            const setExpected = new Set(wordsExpected);
            const setScraped = new Set(wordsScraped);
            const intersection = new Set([...setExpected].filter(w => setScraped.has(w)));
            const union = new Set([...setExpected, ...setScraped]);
            const jaccardSimilarity = intersection.size / union.size;

            const namesMatch = compareNames(expectedEmployeeName, profileFullName);

            if (!namesMatch) {
                console.error(`[Scraper] ❌ Name validation FAILED (Jaccard similarity: ${(jaccardSimilarity * 100).toFixed(1)}%):`);
                console.error(`         Expected (from DB): "${expectedEmployeeName}"`);
                console.error(`         Scraped (from page): "${profileFullName}"`);
                console.error(`         Expected words: [${wordsExpected.join(', ')}]`);
                console.error(`         Scraped words: [${wordsScraped.join(', ')}]`);
                console.error(`         Intersection: [${Array.from(intersection).join(', ')}] (${intersection.size} words)`);
                console.error(`         Union: [${Array.from(union).join(', ')}] (${union.size} words)`);

                // Character-by-character comparison for first word to debug
                if (wordsExpected.length > 0 && wordsScraped.length > 0) {
                    const firstExpected = wordsExpected[0];
                    const firstScraped = wordsScraped[0];
                    console.error(`[Scraper] First word comparison:`);
                    console.error(`         Expected: "${firstExpected}" (${firstExpected.length} chars)`);
                    console.error(`         Scraped: "${firstScraped}" (${firstScraped.length} chars)`);
                    if (firstExpected !== firstScraped) {
                        const minLen = Math.min(firstExpected.length, firstScraped.length);
                        for (let i = 0; i < minLen; i++) {
                            if (firstExpected[i] !== firstScraped[i]) {
                                console.error(`         First difference at position ${i}: expected '${firstExpected[i]}' (${firstExpected.charCodeAt(i)}), got '${firstScraped[i]}' (${firstScraped.charCodeAt(i)})`);
                                break;
                            }
                        }
                    }
                }

                // Throw error to block scraping
                // WARNING ONLY - Validation disabled by user request
                console.warn(
                    `[Scraper] ⚠️ Name validation failed: The name on the wallet page ("${profileFullName}") does not match the employee name in our records ("${expectedEmployeeName}"). Proceeding anyway.`
                );
            } else {
                console.log(`[Scraper] ✅ Name validation passed: Jaccard similarity = 100% (perfect match)`);
                console.log(`         Expected: "${expectedEmployeeName}" → Scraped: "${profileFullName}"`);
                console.log(`         Word sets match: [${wordsExpected.join(', ')}] (order-independent, numbers filtered)`);
            }
        } else if (expectedEmployeeName && !profileFullName) {
            // If we have expected name but couldn't scrape it, block scraping for security
            console.error(`[Scraper] ❌ Could not scrape name from page for validation. Expected: "${expectedEmployeeName}"`);
            throw new Error(
                `Unable to verify employee name: Could not find the name on the wallet page. ` +
                `Please ensure you are using a valid Databricks credential wallet URL. ` +
                `If the issue persists, please contact support.`
            );
        } else if (!expectedEmployeeName) {
            console.warn(`[Scraper] ⚠️ No expected employee name found in database for emp_code. Proceeding without name validation.`);
            // Note: We allow scraping to continue if employee name is not in database
            // This handles edge cases where employee might not be fully registered
        }

        const tileLocator = page.locator('accredible-tile');
        await tileLocator.first().waitFor({ state: 'visible', timeout: 60000 });

        // Try multiple selectors to find credential count
        // Primary: Specific CSS selector from the page structure
        // Fallback: Generic pattern matching
        let totalCredentials = -1;
        let countSource = 'unknown';

        // Method 1: Try the specific CSS selector
        try {
            const specificCountLocator = page.locator('#main-content > ng-component > div > div.main-header > div > div > div > div > div > div > p:nth-child(1)');
            await specificCountLocator.waitFor({ state: 'visible', timeout: 5000 });
            const countText = await specificCountLocator.textContent();
            const match = countText.match(/(\d+)/);
            if (match) {
                totalCredentials = parseInt(match[0], 10);
                countSource = 'specific-selector';
                console.log(`[Scraper] Found credential count using specific selector: ${totalCredentials} credentials.`);
            }
        } catch (e) {
            console.warn(`[Scraper] Specific selector failed, trying fallback methods...`);
        }

        // Method 2: Try XPath (if CSS selector fails)
        if (totalCredentials === -1) {
            try {
                const xpathLocator = page.locator('xpath=/html/body/rp-root/mat-sidenav-container/mat-sidenav-content/main/ng-component/div/div[1]/div/div/div/div/div/div/p[1]');
                await xpathLocator.waitFor({ state: 'visible', timeout: 5000 });
                const countText = await xpathLocator.textContent();
                const match = countText.match(/(\d+)/);
                if (match) {
                    totalCredentials = parseInt(match[0], 10);
                    countSource = 'xpath';
                    console.log(`[Scraper] Found credential count using XPath: ${totalCredentials} credentials.`);
                }
            } catch (e) {
                console.warn(`[Scraper] XPath selector failed, trying generic pattern...`);
            }
        }

        // Method 3: Fallback to generic pattern matching
        if (totalCredentials === -1) {
            try {
                const countLocator = page.locator('p, span').filter({ hasText: /^\d+\s+Credential(s)?$/i }).first();
                const countText = await countLocator.textContent({ timeout: 5000 });
                const match = countText.match(/(\d+)/);
                if (match) {
                    totalCredentials = parseInt(match[0], 10);
                    countSource = 'generic-pattern';
                    console.log(`[Scraper] Found credential count using generic pattern: ${totalCredentials} credentials.`);
                }
            } catch (e) {
                console.warn('[Scraper] Could not find total credential count using any method. Will use scroll stability check.');
            }
        }

        // Get initial tile count for validation
        const initialTileCount = await tileLocator.count();
        console.log(`[Scraper] Initial tile count: ${initialTileCount}, Expected count from page: ${totalCredentials > 0 ? totalCredentials : 'unknown'}`);

        // Validate: If count found, compare with initial tiles
        if (totalCredentials > 0 && initialTileCount > 0) {
            if (initialTileCount >= totalCredentials) {
                console.log(`[Scraper] All credentials already loaded (${initialTileCount} >= ${totalCredentials}). No scrolling needed.`);
            } else {
                console.log(`[Scraper] Need to scroll: ${initialTileCount} tiles visible, ${totalCredentials} expected.`);
            }
        }

        const scrollableSelector = ".mat-drawer-content";
        let finalTileCount = initialTileCount;

        if (totalCredentials > 0) {
            // Use count-based scrolling with validation
            let currentTileCount = initialTileCount;
            let stableScrolls = 0;
            const maxScrolls = 20; // Safety limit
            let scrollAttempts = 0;

            while (currentTileCount < totalCredentials && stableScrolls < 3 && scrollAttempts < maxScrolls) {
                await page.locator(scrollableSelector).evaluate(el => el.scrollTo(0, el.scrollHeight));
                await page.waitForTimeout(1500);
                scrollAttempts++;

                const newCount = await tileLocator.count();
                if (newCount === currentTileCount) {
                    stableScrolls++;
                } else {
                    stableScrolls = 0;
                }
                currentTileCount = newCount;
                console.log(`[Scraper] Scrolled (attempt ${scrollAttempts}). Found ${currentTileCount}/${totalCredentials} credentials.`);
            }

            finalTileCount = currentTileCount;

            // Validate final count against expected
            if (finalTileCount === totalCredentials) {
                console.log(`[Scraper] ✅ Successfully loaded all credentials: ${finalTileCount} = ${totalCredentials} (matched)`);
            } else if (finalTileCount > totalCredentials) {
                console.warn(`[Scraper] ⚠️ Found more tiles (${finalTileCount}) than expected count (${totalCredentials}). Using actual tile count.`);
                finalTileCount = currentTileCount; // Use actual count
            } else {
                console.warn(`[Scraper] ⚠️ Could not load all credentials. Expected: ${totalCredentials}, Found: ${finalTileCount}. Proceeding with available tiles.`);
            }
        } else {
            // Fallback: Use stability check method
            console.log('[Scraper] Using fallback scroll method (stability check) - no count found on page.');
            let lastKnownCount = initialTileCount;
            let stableCountChecks = 0;
            while (stableCountChecks < 3) {
                await page.locator(scrollableSelector).evaluate(el => el.scrollTo(0, el.scrollHeight));
                await page.waitForTimeout(2000);
                const currentTileCount = await tileLocator.count();
                if (currentTileCount === lastKnownCount) {
                    stableCountChecks++;
                } else {
                    lastKnownCount = currentTileCount;
                    stableCountChecks = 0;
                }
                console.log(`[Scraper] Fallback scroll: Tile count is ${currentTileCount}. Stability check ${stableCountChecks}/3.`);
            }
            finalTileCount = lastKnownCount;
        }

        const tiles = await tileLocator.all();
        console.log(`[Scraper] Final count: Found ${tiles.length} credential tiles (Expected: ${totalCredentials > 0 ? totalCredentials : 'unknown'}, Source: ${countSource}). Scraping details...`);

        // Final validation warning
        if (totalCredentials > 0 && tiles.length !== totalCredentials) {
            console.warn(`[Scraper] ⚠️ Mismatch detected: Page count = ${totalCredentials}, Actual tiles = ${tiles.length}. Proceeding with ${tiles.length} tiles.`);
        }

        // Step 1: Extract basic info from all tiles concurrently
        console.log(`[Scraper] Starting extraction from ${tiles.length} tiles...`);
        let tileExtractionErrors = [];
        const tileDataPromises = tiles.map(async (tile, tileIndex) => {
            try {
                const title = await tile.locator('h2').first().textContent({ timeout: 5000 }).catch(() => null);
                const issuedOnText = await tile.locator('div.issued-on').first().textContent({ timeout: 5000 }).catch(() => null);
                const issuedOn = issuedOnText ? issuedOnText.replace(/issued on/i, '').trim() : null;
                const href = await tile.locator("a").first().getAttribute("href");

                if (!href || !title) {
                    tileExtractionErrors.push({ tileIndex, reason: !href ? 'Missing href' : 'Missing title', title: title || 'N/A' });
                    return null;
                }

                const credential_id = href.split("/").pop();
                const detailUrl = `${baseUrl}${href}`;
                return { credential_id, title, issuedOn, detailUrl };
            } catch (err) {
                tileExtractionErrors.push({ tileIndex, reason: `Extraction error: ${err.message}` });
                return null;
            }
        });
        const tileData = (await Promise.all(tileDataPromises)).filter(Boolean); // filter out nulls

        console.log(`[Scraper] Extraction complete: ${tileData.length} valid tiles extracted from ${tiles.length} total tiles.`);
        if (tileExtractionErrors.length > 0) {
            console.warn(`[Scraper] ⚠️ ${tileExtractionErrors.length} tile(s) failed extraction:`, tileExtractionErrors);
        }

        // Step 2: Fetch expiry dates sequentially to prevent remote browser crashes
        console.log(`[Scraper] Fetching expiry dates for ${tileData.length} credentials...`);
        let expiryFetchErrors = [];
        const expiryResults = [];
        
        for (let i = 0; i < tileData.length; i++) {
            const data = tileData[i];
            const detailPage = await context.newPage();
            try {
                // domcontentloaded is much faster and less prone to timeout than networkidle
                await detailPage.goto(data.detailUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
                const locator = detailPage.locator('div.expires-on');
                // Wait locally rather than 60s
                await locator.waitFor({ state: 'visible', timeout: 10000 }); 
                const text = await locator.innerText();
                if (/does not expire/i.test(text)) {
                    expiryResults.push({ expiryDate: 'Does not expire', success: true, index: i });
                } else {
                    const dateStr = text.replace(/^(Expires on|Expired on)\s*/i, '').trim();
                    expiryResults.push({ expiryDate: dateStr || 'Does not expire', success: true, index: i });
                }
            } catch (e) {
                expiryFetchErrors.push({ title: data.title, url: data.detailUrl, error: e.message, index: i });
                console.warn(`[Scraper] Could not find expiry date for ${data.title} at ${data.detailUrl}. Setting to 'Does not expire'.`);
                expiryResults.push({ expiryDate: 'Does not expire', success: false, index: i });
            } finally {
                await detailPage.close();
            }
        }
        const expiryDates = expiryResults.map(r => r.expiryDate);

        console.log(`[Scraper] Expiry date fetch complete: ${expiryResults.filter(r => r.success).length} successful, ${expiryFetchErrors.length} failed.`);
        if (expiryFetchErrors.length > 0) {
            console.warn(`[Scraper] ⚠️ ${expiryFetchErrors.length} credential(s) had expiry date fetch errors:`, expiryFetchErrors.map(e => ({ title: e.title, error: e.error })));
        }

        // Validate array lengths match
        if (tileData.length !== expiryDates.length) {
            console.error(`[Scraper] ❌ CRITICAL: Array length mismatch! tileData: ${tileData.length}, expiryDates: ${expiryDates.length}`);
            console.error(`[Scraper] This will cause index misalignment when combining data!`);
        }

        // Validate expiry results array structure
        if (expiryResults.some(r => !r || typeof r !== 'object' || !r.hasOwnProperty('expiryDate'))) {
            console.error(`[Scraper] ❌ CRITICAL: Invalid expiry results structure detected!`);
            expiryResults.forEach((r, idx) => {
                if (!r || typeof r !== 'object' || !r.hasOwnProperty('expiryDate')) {
                    console.error(`[Scraper]   - Index ${idx}: Invalid result:`, r);
                }
            });
        }

        // Step 3: Combine data and log. Status is no longer calculated here.
        console.log(`\n--- Scraped Details for ${username} ---`);
        const results = tileData.map((data, index) => {
            if (index >= expiryDates.length) {
                console.error(`[Scraper] ❌ CRITICAL: Index ${index} out of bounds for expiryDates array (length: ${expiryDates.length})`);
                return null;
            }
            const expiryDate = expiryDates[index];
            const finalCredential = { ...data, expiryDate };

            // Log the details of each credential
            console.log(`[Credential ${index + 1}/${tileData.length}] Title: ${finalCredential.title}`);
            console.log(`             ID: ${finalCredential.credential_id}`);
            console.log(`             Link: ${finalCredential.detailUrl || 'N/A'}`);
            console.log(`             Issued: ${finalCredential.issuedOn || 'N/A'}`);
            console.log(`             Expires: ${finalCredential.expiryDate || 'N/A'}\n`);

            return finalCredential;
        }).filter(Boolean); // Filter out any nulls from index errors

        console.log("---------------------------------------\n");
        console.log(`[Scraper] Successfully scraped ${results.length} credentials for ${username}.`);
        console.log(`[Scraper] Summary: ${tiles.length} tiles → ${tileData.length} extracted → ${results.length} final credentials`);

        // Final validation
        if (tiles.length !== results.length) {
            const lost = tiles.length - results.length;
            console.warn(`[Scraper] ⚠️ WARNING: ${lost} credential(s) were lost during scraping process!`);
            console.warn(`[Scraper] Breakdown: ${tiles.length} tiles - ${tileExtractionErrors.length} extraction errors - ${(tileData.length !== results.length ? tileData.length - results.length : 0)} combination errors = ${results.length} final`);
        }
        // Return the normalized URL so it's saved to the database
        return { fullName: profileFullName, credentials: results, username, profileUrl: normalizedUrl };

    } finally {
        await context.close();
    }
};

// THIS FUNCTION IS MIGRATED TO POSTGRESQL/LAKEBASE
async function insertOrUpdateCredentials(scrapedData) {
    if (!scrapedData || !scrapedData.credentials || scrapedData.credentials.length === 0) {
        console.log("[Lakebase] No new credentials to upsert.");
        return;
    }

    const emp_code = scrapedData.emp_code;
    const username = scrapedData.username;
    const fullName = scrapedData.fullName;
    const profileUrl = scrapedData.profileUrl;

    let pgClient;
    try {
        console.log(`[Lakebase] insertOrUpdateCredentials leasing client for emp_code: ${emp_code}`);
        pgClient = await getPgClientFromPool();

        // Step 0: Update employeedetails with profile_url if provided
        if (profileUrl && emp_code) {
            const updateEmployeeQuery = `
                UPDATE ${process.env.LAKEBASE_SCHEMA}.employeedetails
                SET profile_url = $1
                WHERE emp_code = $2
            `;
            await pgClient.query(updateEmployeeQuery, [profileUrl, emp_code]);
            console.log(`[Lakebase] Updated profile_url for emp_code ${emp_code}`);
        }

        // Use a sequential for...of loop to process credentials one by one
        // This ensures proper transaction handling and avoids potential conflicts
        let insertedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;
        const processedTitles = [];
        const failedCredentials = [];

        console.log(`[Lakebase] Starting upsert for ${scrapedData.credentials.length} credentials...`);

        for (let i = 0; i < scrapedData.credentials.length; i++) {
            const cred = scrapedData.credentials[i];
            console.log(`[Lakebase] Processing credential ${i + 1}/${scrapedData.credentials.length}: "${cred.title || 'Unknown'}"`);
            try {
                // Validate required fields
                if (!cred.title || !cred.title.trim()) {
                    console.error(`[Lakebase] ❌ Skipping credential ${i + 1}: Missing title. Credential ID: ${cred.credential_id || 'N/A'}`);
                    errorCount++;
                    failedCredentials.push({ index: i + 1, title: 'N/A', credential_id: cred.credential_id || 'N/A', reason: 'Missing title' });
                    continue;
                }

                if (!cred.credential_id || !cred.credential_id.trim()) {
                    console.error(`[Lakebase] ❌ Skipping credential ${i + 1}: Missing credential_id. Title: ${cred.title}`);
                    errorCount++;
                    failedCredentials.push({ index: i + 1, title: cred.title, credential_id: 'N/A', reason: 'Missing credential_id' });
                    continue;
                }

                const normalizedTitle = cred.title.trim().toLowerCase();
                const issuedOn = cred.issuedOn ? new Date(cred.issuedOn).toISOString() : null;

                // Step 1: Check if a matching record already exists
                // IMPORTANT: Match on credential_id first (most reliable), then fall back to title+emp_code
                // This handles renewed credentials (same title, different credential_id) correctly
                const checkByIdQuery = `
                    SELECT credential_id
                    FROM ${process.env.LAKEBASE_SCHEMA}.credentials
                    WHERE credential_id = $1
                    LIMIT 1
                `;
                const checkByIdResult = await pgClient.query(checkByIdQuery, [cred.credential_id]);

                if (checkByIdResult.rows.length > 0) {
                    // Step 2a: Record exists with same credential_id - UPDATE it
                    const updateQuery = `
                        UPDATE ${process.env.LAKEBASE_SCHEMA}.credentials
                        SET expiry_date = $1,
                            full_name = $2,
                            issued_on = $3,
                            username = $4,
                            credential_link = $5,
                            credential_title = $6,
                            emp_code = $7
                        WHERE credential_id = $8
                    `;
                    await pgClient.query(updateQuery, [
                        cred.expiryDate,
                        fullName,
                        issuedOn,
                        username,
                        cred.detailUrl || null,
                        cred.title,
                        emp_code,
                        cred.credential_id
                    ]);
                    updatedCount++;
                    processedTitles.push(normalizedTitle);
                    console.log(`[Lakebase] Updated existing credential "${cred.title}" (ID: ${cred.credential_id}) for emp_code ${emp_code}`);
                } else {
                    // Step 2b: Check if record exists with same title (for renewed credentials)
                    // This handles the Databricks glitch where renewed credentials have same title but different ID
                    const checkByTitleQuery = `
                        SELECT credential_id
                        FROM ${process.env.LAKEBASE_SCHEMA}.credentials
                        WHERE TRIM(LOWER(credential_title)) = $1
                          AND emp_code = $2
                          AND credential_id != $3
                        LIMIT 1
                    `;
                    const checkByTitleResult = await pgClient.query(checkByTitleQuery, [normalizedTitle, emp_code, cred.credential_id]);

                    if (checkByTitleResult.rows.length > 0) {
                        // Record exists with same title but different ID - this is a renewed credential
                        // INSERT as new record (don't update the old one, keep both)
                        const insertQuery = `
                            INSERT INTO ${process.env.LAKEBASE_SCHEMA}.credentials
                                (credential_id, username, emp_code, full_name, credential_title, issued_on, expiry_date, credential_link)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        `;
                        await pgClient.query(insertQuery, [
                            cred.credential_id,
                            username,
                            emp_code,
                            fullName,
                            cred.title,
                            issuedOn,
                            cred.expiryDate,
                            cred.detailUrl || null
                        ]);
                        insertedCount++;
                        processedTitles.push(normalizedTitle);
                        console.log(`[Lakebase] Inserted renewed credential "${cred.title}" (new ID: ${cred.credential_id}, existing ID: ${checkByTitleResult.rows[0].credential_id}) for emp_code ${emp_code}`);
                    } else {
                        // No matching record - INSERT as new
                        const insertQuery = `
                            INSERT INTO ${process.env.LAKEBASE_SCHEMA}.credentials
                                (credential_id, username, emp_code, full_name, credential_title, issued_on, expiry_date, credential_link)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        `;
                        await pgClient.query(insertQuery, [
                            cred.credential_id,
                            username,
                            emp_code,
                            fullName,
                            cred.title,
                            issuedOn,
                            cred.expiryDate,
                            cred.detailUrl || null
                        ]);
                        insertedCount++;
                        processedTitles.push(normalizedTitle);
                        console.log(`[Lakebase] Inserted new credential "${cred.title}" (ID: ${cred.credential_id}) for emp_code ${emp_code}`);
                    }
                }
            } catch (err) {
                errorCount++;
                failedCredentials.push({
                    index: i + 1,
                    title: cred.title || 'Unknown',
                    credential_id: cred.credential_id || 'Unknown',
                    reason: `Database error: ${err.message}`
                });
                console.error(`[Lakebase] ❌ Failed to upsert credential ${i + 1} "${cred.title || 'Unknown'}" (ID: ${cred.credential_id || 'Unknown'}): ${err.message}`);
                console.error(`[Lakebase] Error details:`, err);
                console.error(`[Lakebase] Error stack:`, err.stack);
            }
        }

        console.log(`[Lakebase] Sequential upsert complete: ${insertedCount} inserted, ${updatedCount} updated, ${errorCount} errors, ${scrapedData.credentials.length} total processed for Emp_Code: ${emp_code}.`);
        if (errorCount > 0) {
            console.warn(`[Lakebase] ⚠️ WARNING: ${errorCount} credential(s) failed to upsert:`);
            failedCredentials.forEach(fc => {
                console.warn(`[Lakebase]   - Credential ${fc.index}: "${fc.title}" (ID: ${fc.credential_id}) - ${fc.reason}`);
            });
        }

        // Validate: Check if all credentials were processed
        const expectedProcessed = insertedCount + updatedCount;
        if (expectedProcessed !== scrapedData.credentials.length - errorCount) {
            console.error(`[Lakebase] ❌ CRITICAL: Processed count mismatch! Expected: ${scrapedData.credentials.length - errorCount}, Got: ${expectedProcessed}`);
        }

    } catch (err) {
        console.error("[Lakebase] Sequential upsert failed:", err);
        throw err;
    } finally {
        if (pgClient) {
            pgClient.release();
            console.log('[PgPoolManager] Client released for insertOrUpdateCredentials.');
        }
    }
}

// THIS ENDPOINT IS MIGRATED TO POSTGRESQL/LAKEBASE
// Overall scrape operation timeout (90s) to respond before platform proxy kills it
const SCRAPE_OPERATION_TIMEOUT_MS = 90000;

export const registerScraperRoutes = (app) => {
    app.post("/api/scrape-and-add-by-url", async (req, res) => {
        const { url, user } = req.body;
        if (!url || !user || !user.id) {
            return res.status(400).json({ error: "A valid URL and user object are required." });
        }

        let pgClient;
        // Set a hard timeout so the client gets a response before the upstream proxy kills the connection
        const operationTimer = setTimeout(() => {
            if (!res.headersSent) {
                console.error(`[Scraper] ❌ Scrape operation timed out after ${SCRAPE_OPERATION_TIMEOUT_MS}ms for user ${user.id}`);
                res.status(504).json({
                    error: "The scraping operation timed out. This can happen if the remote browser service is slow or unavailable. Please try again in a few minutes."
                });
            }
        }, SCRAPE_OPERATION_TIMEOUT_MS);

        try {
            console.log(`[Scraper] Starting scrape for user ${user.id} from URL: ${url}`);

            // Fetch employee name from database for validation
            console.log(`[Lakebase] /api/scrape-and-add-by-url leasing client for employee lookup`);
            pgClient = await getPgClientFromPool();
            const employeeQuery = `
            SELECT employee_name
            FROM ${process.env.LAKEBASE_SCHEMA}.employeedetails
            WHERE emp_code = $1
        `;
            const employeeResult = await pgClient.query(employeeQuery, [user.id]);
            pgClient.release();
            pgClient = null;

            const expectedEmployeeName = employeeResult.rows.length > 0 ? employeeResult.rows[0].employee_name : null;
            if (expectedEmployeeName) {
                console.log(`[Scraper] Found employee name in database: "${expectedEmployeeName}" for emp_code: ${user.id}`);
            } else {
                console.warn(`[Scraper] Could not find employee name in database for emp_code: ${user.id}. Skipping name validation.`);
            }

            // Scrape credentials with name validation
            const scraped = await scrapeCredentials(url, expectedEmployeeName);

            // If the timeout already fired, don't continue DB operations
            if (res.headersSent) {
                console.warn('[Scraper] Response already sent (timeout). Skipping DB upsert.');
                return;
            }

            await insertOrUpdateCredentials({
                ...scraped,
                emp_code: user.id,
                profileUrl: url
            });

            // After upserting, re-fetch from the view to get the correct dynamic status.
            console.log(`[Lakebase] /api/scrape-and-add-by-url leasing client for re-fetch`);
            pgClient = await getPgClientFromPool();

            // IMPORTANT: Return ALL credentials for this employee, not just the ones we scraped
            // This handles cases where employees have renewed credentials (same title, different credential_id)
            // which is a Databricks glitch - we want to show all credentials
            const finalCredentialsQuery = `
            SELECT credential_id, credential_title as title, issued_on as "issuedOn", status, expiry_date as "expiryDate"
            FROM ${process.env.LAKEBASE_SCHEMA}.v_credentials
            WHERE emp_code = $1
            ORDER BY issued_on DESC, credential_title ASC
        `;
            const finalResult = await pgClient.query(finalCredentialsQuery, [user.id]);

            // Create a map of scraped credential_ids for quick lookup
            const scrapedCredentialIds = new Set(scraped.credentials
                .filter(c => c.credential_id && c.credential_id.trim())
                .map(c => c.credential_id.trim())
            );

            // Create normalized title map with counts (to handle duplicates)
            const scrapedTitlesMap = new Map();
            scraped.credentials.forEach(c => {
                if (c.title && c.title.trim()) {
                    const normalizedTitle = c.title.trim().toLowerCase();
                    const count = scrapedTitlesMap.get(normalizedTitle) || 0;
                    scrapedTitlesMap.set(normalizedTitle, count + 1);
                }
            });

            console.log(`[Scraper] Filtering results: ${scraped.credentials.length} scraped credentials, ${scrapedTitlesMap.size} unique titles`);
            console.log(`[Scraper] Scraped credential IDs: ${Array.from(scrapedCredentialIds).join(', ')}`);
            console.log(`[Scraper] Title counts:`, Array.from(scrapedTitlesMap.entries()).map(([title, count]) => `"${title}": ${count}`));

            // Return ALL credentials from DB for this employee
            // This ensures we return all credentials including renewed ones with same title
            const allCredentials = finalResult.rows;

            // Track which scraped credentials were found
            const foundScrapedIds = new Set();
            const foundScrapedTitles = new Map();

            allCredentials.forEach(c => {
                const normalizedTitle = (c.title || '').trim().toLowerCase();
                if (scrapedCredentialIds.has(c.credential_id)) {
                    foundScrapedIds.add(c.credential_id);
                }
                if (scrapedTitlesMap.has(normalizedTitle)) {
                    const currentCount = foundScrapedTitles.get(normalizedTitle) || 0;
                    foundScrapedTitles.set(normalizedTitle, currentCount + 1);
                }
            });

            // Log matching results
            const missingIds = Array.from(scrapedCredentialIds).filter(id => !foundScrapedIds.has(id));
            if (missingIds.length > 0) {
                console.warn(`[Scraper] ⚠️ WARNING: ${missingIds.length} scraped credential ID(s) not found in DB:`, missingIds);
            }

            // Check title matches (accounting for duplicates)
            scrapedTitlesMap.forEach((expectedCount, normalizedTitle) => {
                const foundCount = foundScrapedTitles.get(normalizedTitle) || 0;
                if (foundCount < expectedCount) {
                    console.warn(`[Scraper] ⚠️ WARNING: Title "${normalizedTitle}" - Expected ${expectedCount} credential(s), found ${foundCount} in DB`);
                }
            });

            console.log(`[Scraper] Final summary:`);
            console.log(`[Scraper]   - Scraped: ${scraped.credentials.length} credentials`);
            console.log(`[Scraper]   - Total in DB: ${allCredentials.length} credentials`);
            console.log(`[Scraper]   - Returning: ${allCredentials.length} credentials (all credentials for employee)`);
            console.log(`[Scraper]   - Scraped IDs found: ${foundScrapedIds.size}/${scrapedCredentialIds.size}`);

            // Return ALL credentials for this employee (not just scraped ones)
            // This handles renewed credentials with same title but different ID
            if (!res.headersSent) {
                res.json(allCredentials);
            }

        } catch (err) {
            console.error(`[Error] /api/scrape-and-add-by-url (Lakebase): ${err.message}`);

            if (!res.headersSent) {
                // Return 400 for validation errors (name mismatch, invalid URL, etc.)
                // Return 500 for server errors (database issues, scraping failures, etc.)
                const isValidationError = err.message.includes('Name validation failed') ||
                    err.message.includes('Unable to verify employee name') ||
                    err.message.includes('Invalid credential wallet URL') ||
                    err.message.includes('Profile not found');

                const isBrowserTimeout = err.message.includes('timed out') ||
                    err.message.includes('Failed to connect to browser');

                const statusCode = isValidationError ? 400 : (isBrowserTimeout ? 504 : 500);
                res.status(statusCode).json({ error: err.message });
            }
        } finally {
            clearTimeout(operationTimer);
            if (pgClient) {
                pgClient.release();
                console.log('[PgPoolManager] Client released for /api/scrape-and-add-by-url.');
            }
        }
    });
};
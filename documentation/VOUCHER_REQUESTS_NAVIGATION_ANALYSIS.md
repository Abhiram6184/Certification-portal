# Voucher Requests Navigation Analysis

## Key Finding: Why Voucher Requests Load Faster and Don't Refresh

The voucher requests tab behaves differently from Employee Directory and Credential Directory because of **different data fetching strategies**.

---

## Data Flow Comparison

### 1. **Voucher Requests** (Fast, No Refresh on Toggle)

#### Fetching Strategy: **Fetch Once on Admin Login**

**Location:** `App.tsx` (Lines 119-135)

```typescript
useEffect(() => {
  if (currentUser?.role === UserRole.Admin) {
    const fetchAdminData = async () => {
      setIsLoading(true);
      try {
        const requests = await getAllRequests();  // ← Fetches ONCE
        setAllRequests(requests);                 // ← Stored in App.tsx state
      } catch (error) {
        console.error("Failed to fetch all requests:", error);
        setError("Could not load voucher requests.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAdminData();
  }
}, [currentUser]);  // ← Only runs when currentUser changes (i.e., on login)
```

**Data Flow:**
1. Admin logs in → `currentUser` changes
2. `useEffect` triggers → Calls `getAllRequests()` → Fetches from `/api/admin/all-requests`
3. Data stored in `App.tsx` state (`allRequests`)
4. Passed as **prop** to `Admin` component: `<Admin requests={allRequests} />`
5. **No refetch** when toggling to requests tab

**In Admin.tsx (Lines 545-575):**
```typescript
{currentTab === 'requests' && (
  <div>
    {/* No useEffect for requests tab! */}
    <AdminRequestTable 
      requests={filteredRequests}  // ← Uses prop data, just filters it
      onApprove={onApprove}
      onDeny={onDeny}
    />
  </div>
)}
```

**Filtering (Lines 174-198):**
- Uses `useMemo` to filter the existing `requests` prop
- No database query on tab toggle
- Instant display (data already in memory)

---

### 2. **Employee Directory** (Slower, Refreshes on Toggle)

#### Fetching Strategy: **Fetch Every Time Tab is Opened**

**Location:** `Admin.tsx` (Lines 78-91, 93-103)

```typescript
useEffect(() => {
  if (!currentUser) return;
  
  setSearchTerm(''); // Reset search term when tab changes

  if (currentTab === 'employees') {
    fetchEmployees();  // ← Fetches EVERY TIME tab is opened
  }
  
  if (currentTab === 'credentials') {
    fetchCredentialSummary();  // ← Fetches EVERY TIME tab is opened
  }

}, [currentUser, currentTab]);  // ← Runs when currentTab changes!

const fetchEmployees = async () => {
  setIsLoadingEmployees(true);
  try {
    const employeeData = await getAdminEmployees();  // ← Database query
    setEmployees(employeeData);
  } catch (error) {
    console.error("Failed to fetch employees:", error);
  } finally {
    setIsLoadingEmployees(false);
  }
};
```

**Data Flow:**
1. User clicks "Employee Directory" tab → `currentTab` changes to `'employees'`
2. `useEffect` triggers → Calls `fetchEmployees()`
3. Makes API call to `/api/admin/employees` → **Database query**
4. Shows loading spinner → Displays data
5. **Repeats every time** you toggle to this tab

---

### 3. **Credential Directory** (Slower, Refreshes on Toggle)

#### Fetching Strategy: **Fetch Every Time Tab is Opened**

**Location:** `Admin.tsx` (Lines 105-116)

```typescript
const fetchCredentialSummary = async () => {
  setSelectedIssuer('All'); // Reset filter on tab switch
  setIsLoadingCredentials(true);
  try {
    const summaryData = await getCredentialSummary();  // ← Database query
    setCredentialSummary(summaryData);
  } catch (error) {
    console.error("Failed to fetch credential summary:", error);
  } finally {
    setIsLoadingCredentials(false);
  }
};
```

**Data Flow:**
1. User clicks "Credential Directory" tab → `currentTab` changes to `'credentials'`
2. `useEffect` triggers → Calls `fetchCredentialSummary()`
3. Makes API call to `/api/admin/credentials-summary` → **Database query**
4. Shows loading spinner → Displays data
5. **Repeats every time** you toggle to this tab

---

## Summary Table

| Tab | Fetch Strategy | When Fetched | Database Calls on Toggle | Speed |
|-----|---------------|--------------|-------------------------|-------|
| **Voucher Requests** | Fetch once on login | Admin login only | ❌ None | ⚡ Fast (in-memory) |
| **Employee Directory** | Fetch on tab open | Every tab toggle | ✅ Yes (`/api/admin/employees`) | 🐌 Slower (DB query) |
| **Credential Directory** | Fetch on tab open | Every tab toggle | ✅ Yes (`/api/admin/credentials-summary`) | 🐌 Slower (DB query) |

---

## Why This Design Difference?

### Voucher Requests (Fetch Once)
- **Rationale:** Voucher requests are relatively static during a session
- **Benefit:** Faster navigation, reduced database load
- **Trade-off:** Data might be stale if requests are updated elsewhere

### Employee/Credential Directories (Fetch on Toggle)
- **Rationale:** These directories might change frequently (new employees, new credentials)
- **Benefit:** Always shows fresh data
- **Trade-off:** Slower navigation, more database queries

---

## Code Locations

### Voucher Requests Flow:
1. **Initial Fetch:** `App.tsx:119-135` → `getAllRequests()` → `services/api.ts:306-334`
2. **Backend:** `backend-scraper/voucher.js:212-241` → `/api/admin/all-requests`
3. **Display:** `App.tsx:369` → Passes `allRequests` as prop → `Admin.tsx:545-575`
4. **Filtering:** `Admin.tsx:174-198` → `useMemo` filters existing data

### Employee Directory Flow:
1. **Fetch Trigger:** `Admin.tsx:78-91` → `useEffect` watches `currentTab`
2. **Fetch Function:** `Admin.tsx:93-103` → `fetchEmployees()` → `getAdminEmployees()`
3. **Backend:** `backend-scraper/server.js:538-570` → `/api/admin/employees`
4. **Display:** `Admin.tsx:406-434`

### Credential Directory Flow:
1. **Fetch Trigger:** `Admin.tsx:78-91` → `useEffect` watches `currentTab`
2. **Fetch Function:** `Admin.tsx:105-116` → `fetchCredentialSummary()` → `getCredentialSummary()`
3. **Backend:** `backend-scraper/server.js:599-630` → `/api/admin/credentials-summary`
4. **Display:** `Admin.tsx:436-543`

---

## Recommendations for Consistency

If you want all tabs to behave consistently, you have two options:

### Option 1: Make All Tabs Fetch Once (Like Voucher Requests)
- Move `employees` and `credentials` fetching to `App.tsx`
- Pass as props to `Admin` component
- **Pros:** Faster navigation, fewer DB calls
- **Cons:** Stale data if changes occur elsewhere

### Option 2: Make Voucher Requests Fetch on Toggle (Like Other Tabs)
- Add `useEffect` in `Admin.tsx` for `currentTab === 'requests'`
- Call `getAllRequests()` when tab is opened
- **Pros:** Always fresh data
- **Cons:** Slower navigation, more DB calls

### Option 3: Hybrid Approach (Recommended)
- Keep voucher requests as-is (fetch once, update on actions)
- Add **manual refresh button** for all tabs
- Add **auto-refresh** with configurable interval (e.g., every 5 minutes)
- **Pros:** Balance between performance and freshness

---

## Current Database Impact

### Voucher Requests Tab:
- **On Admin Login:** 1 query (`/api/admin/all-requests`)
- **On Tab Toggle:** 0 queries
- **Total per session:** 1 query

### Employee Directory Tab:
- **On Admin Login:** 0 queries (not fetched yet)
- **On Tab Toggle:** 1 query (`/api/admin/employees`) **every time**
- **Total per session:** N queries (where N = number of times you open the tab)

### Credential Directory Tab:
- **On Admin Login:** 0 queries (not fetched yet)
- **On Tab Toggle:** 1 query (`/api/admin/credentials-summary`) **every time**
- **Total per session:** M queries (where M = number of times you open the tab)

---

## Cost Optimization Opportunity

If you want to reduce database calls while maintaining data freshness:

1. **Implement caching** for Employee and Credential directories
2. **Add refresh button** to manually update when needed
3. **Use the same pattern as voucher requests** (fetch once, update on mutations)
4. **Add optimistic updates** when admin makes changes (update local state immediately)

This would reduce database calls from **N+M+1** to **3** per admin session (one fetch per tab on login).


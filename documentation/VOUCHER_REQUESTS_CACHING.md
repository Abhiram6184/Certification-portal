# Voucher Requests Caching Mechanism

## Overview
Voucher requests data is cached in React component state to improve performance and reduce database queries. This document explains how the caching works, where data is stored, and when it gets refreshed.

---

## 📍 Where Data is Stored

### 1. **Primary Storage: App.tsx State**
**Location:** `App.tsx` (Line 119-135)

```typescript
const [allRequests, setAllRequests] = useState<CertificationRequest[]>([]);
```

**Storage Type:** React component state (in-memory)
**Scope:** App-level state (persists for entire admin session)
**Lifetime:** Until admin logs out or page is refreshed

### 2. **Data Flow:**
```
Database (PostgreSQL/Lakebase)
    ↓
API Endpoint: /api/admin/all-requests
    ↓
getAllRequests() function (services/api.ts)
    ↓
App.tsx state: allRequests
    ↓
Props passed to Admin component
    ↓
Admin.tsx: filteredRequests (useMemo)
    ↓
AdminRequestTable component (display)
```

---

## 🔄 How Data Gets Refreshed

### **Initial Fetch (Cache Population)**
**Trigger:** Admin login
**Location:** `App.tsx:119-135`

```typescript
useEffect(() => {
  if (currentUser?.role === UserRole.Admin) {
    const fetchAdminData = async () => {
      setIsLoading(true);
      try {
        const requests = await getAllRequests();  // ← Fetches from API
        setAllRequests(requests);                 // ← Stores in state (cache)
      } catch (error) {
        console.error("Failed to fetch all requests:", error);
        setError("Could not load voucher requests.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAdminData();
  }
}, [currentUser]);  // ← Only runs when currentUser changes (on login)
```

**When it runs:**
- ✅ When admin logs in (`currentUser` changes to admin role)
- ✅ When admin session is restored
- ❌ NOT when toggling to requests tab
- ❌ NOT on page navigation

---

### **Cache Updates (Optimistic Updates)**

The cache is updated **optimistically** when admin actions occur:

#### 1. **New Voucher Request Created**
**Location:** `App.tsx:228-241`

```typescript
const handleNewVoucherRequest = async (formData: VoucherRequestData) => {
  if (!currentUser) return;
  try {
    const newRequest = await submitVoucherRequest(formData);
    setRequested(prev => [newRequest, ...prev]);
    if(currentUser.role === UserRole.Admin) {
      setAllRequests(prev => [newRequest, ...prev]);  // ← Updates cache
    }
  } catch (error: any) {
    console.error("Failed to submit voucher:", error);
    alert(error.message || "There was an error submitting the request.");
    throw error;
  }
};
```

**What happens:**
- New request is added to `allRequests` state immediately
- No API call to refresh all requests
- Cache stays in sync with database

---

#### 2. **Request Updated (Status Change)**
**Location:** `App.tsx:243-252`

```typescript
const handleUpdateRequest = async (requestId: string, updates: Partial<CertificationRequest>) => {
  try {
    const updatedRequest = await updateRequestProgress(requestId, updates);
    setRequested(prev => prev.map(req => req.id === requestId ? updatedRequest : req));
    setAllRequests(prev => prev.map(req => req.id === requestId ? updatedRequest : req));  // ← Updates cache
  } catch(error) {
    console.error("Failed to update request:", error);
    alert("There was an error updating the request. Please try again.");
  }
};
```

**What happens:**
- Specific request is updated in `allRequests` state
- Other requests remain unchanged
- No full refresh needed

---

#### 3. **Request Approved**
**Location:** `App.tsx:254-267`

```typescript
const handleApproveRequest = async (request: CertificationRequest) => {
  if (!currentUser || currentUser.role !== UserRole.Admin) return;
  
  setIsLoading(true);
  try {
    const updatedRequest = await approveAndAssignRequest(request, currentUser.id);
    setAllRequests(prev => prev.map(r => r.id === updatedRequest.id ? updatedRequest : r));  // ← Updates cache
  } catch (error: any) {
    console.error(`Failed to approve request:`, error);
    alert(error.message || "There was an error approving the request. Please try again.");
  } finally {
    setIsLoading(false);
  }
};
```

**What happens:**
- Approved request is updated in cache
- Status changes from "Pending" to "Approved"
- Voucher assignment is reflected immediately

---

#### 4. **Request Denied/Rejected**
**Location:** `App.tsx:270-286`

```typescript
const handleAdminActionConfirm = async (updates: Partial<CertificationRequest>, emailContent: string) => {
  if (!currentUser || currentUser.role !== UserRole.Admin || !adminAction) return;
  
  setIsLoading(true);
  try {
    const status = adminAction.action === 'Approve' ? RequestStatus.Approved : RequestStatus.Rejected;
    const updatedRequest = await updateCertificationStatus(adminAction.request, status, currentUser.id, updates, emailContent);
    setAllRequests(prev => prev.map(r => r.id === updatedRequest.id ? updatedRequest : r));  // ← Updates cache
  } catch (error) {
    console.error(`Failed to ${adminAction.action.toLowerCase()} request:`, error);
    alert(`There was an error. Please try again.`);
  } finally {
    setIsLoading(false);
    setAdminAction(null);
  }
};
```

**What happens:**
- Rejected request is updated in cache
- Status changes from "Pending" to "Rejected"
- Denial reason is included in the update

---

## 🚫 When Data Does NOT Refresh

### **Tab Navigation**
**Location:** `components/Admin.tsx:545-575`

```typescript
{currentTab === 'requests' && (
  <div>
    {/* No useEffect for requests tab! */}
    <AdminRequestTable 
      requests={filteredRequests}  // ← Uses cached data from props
      onApprove={onApprove}
      onDeny={onDeny}
    />
  </div>
)}
```

**What happens:**
- When admin toggles to "Voucher Requests" tab, **NO API call is made**
- Data is filtered from cached `requests` prop using `useMemo`
- Display is instant (no loading spinner)

---

### **Filtering (No Refresh)**
**Location:** `components/Admin.tsx:174-198`

```typescript
const filteredRequests = useMemo(() => {
  let filteredList = requests;  // ← Uses cached data
  
  // Apply status filter
  if (requestStatusFilter !== 'All') {
    filteredList = filteredList.filter(req => 
      isStatusMatch(req.status, requestStatusFilter)
    );
  }
  
  // Apply search filter
  if (searchTerm) {
    filteredList = filteredList.filter(req =>
      req.certification.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.user.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  
  return filteredList;
}, [requests, requestStatusFilter, searchTerm]);
```

**What happens:**
- Filtering happens in-memory using `useMemo`
- No database queries
- Instant results

---

## 📊 Cache Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Login                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ useEffect triggers (currentUser changes)             │  │
│  │   ↓                                                  │  │
│  │ getAllRequests() → API call                         │  │
│  │   ↓                                                  │  │
│  │ setAllRequests(data) → Cache populated              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              Cache in Memory (allRequests)                  │
│  • Stored in App.tsx state                                  │
│  • Passed as prop to Admin component                        │
│  • Used for filtering and display                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              Cache Updates (Optimistic)                      │
│  • New request created → Add to cache                       │
│  • Request approved → Update in cache                       │
│  • Request denied → Update in cache                         │
│  • Request updated → Update in cache                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              Cache Invalidation                              │
│  • Admin logs out → State cleared                           │
│  • Page refresh → State cleared                             │
│  • New login → Cache repopulated                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Backend API Endpoint

### **Endpoint:** `/api/admin/all-requests`
**Location:** `backend-scraper/voucher.js:212-241`

**What it does:**
- Queries PostgreSQL/Lakebase database
- Fetches all voucher requests from `voucher_requests` table
- Returns complete request data with user and certification info

**Database Query:**
```sql
SELECT 
  vr.*,
  e.emp_code,
  e.employee_name,
  e.employee_emailid,
  e.designation
FROM voucher_requests vr
LEFT JOIN employeedetails e ON vr.user_id = e.emp_code
ORDER BY vr.requested_at DESC
```

---

## ⚡ Performance Benefits

### **Current Implementation:**
- ✅ **1 database query** per admin session (on login)
- ✅ **0 queries** when toggling to requests tab
- ✅ **Instant filtering** (in-memory)
- ✅ **Optimistic updates** (immediate UI feedback)

### **Alternative (No Caching):**
- ❌ **1 database query** every time requests tab is opened
- ❌ **Loading delay** on every tab toggle
- ❌ **More database load**

---

## 🔄 Manual Refresh Options

Currently, there is **NO manual refresh button**. To refresh data:

1. **Log out and log back in** → Triggers `useEffect` → Fetches fresh data
2. **Refresh the page** → Clears state → Re-fetches on login
3. **Wait for next action** → Cache updates optimistically

---

## 📝 Summary

| Aspect | Details |
|--------|---------|
| **Storage Location** | `App.tsx` state (`allRequests`) |
| **Storage Type** | React component state (in-memory) |
| **Initial Fetch** | On admin login only |
| **Refresh Triggers** | Optimistic updates on admin actions |
| **Tab Navigation** | No refresh (uses cached data) |
| **Filtering** | In-memory (useMemo) |
| **Cache Lifetime** | Until logout or page refresh |
| **Database Queries** | 1 per session (on login) |

---

## 🎯 Key Takeaways

1. **Voucher requests are cached in App.tsx state** - Not in localStorage, sessionStorage, or external cache
2. **Cache is populated once** - On admin login via `useEffect`
3. **Cache is updated optimistically** - When admin performs actions (approve, deny, update)
4. **No refresh on tab toggle** - Data is filtered from cache, not re-fetched
5. **Cache persists for session** - Until logout or page refresh


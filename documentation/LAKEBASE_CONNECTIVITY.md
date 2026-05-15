## Lakebase Connectivity & Cost-Optimized OAuth Pooling

This document captures how the backend establishes secure connections to Databricks Lakehouse (Lakebase), reuses OAuth tokens, and manages PostgreSQL connection pooling to keep the service principal footprint small.

---

### 1. Environment Bootstrapping

- `backend-scraper/lakebase.js` is the single source of truth for Lakebase connectivity.
- It loads `.env` from `backend-scraper/.env` via `dotenv`, ensuring every script (server, scraper, bulk upload, etc.) can import `getPgClientFromPool()` without reconfiguring paths.
- Mandatory environment variables:
  - `SERVICE_PRINCIPAL_CLIENT_ID`
  - `SERVICE_PRINCIPAL_CLIENT_SECRET`
  - `DATABRICKS_HOST`
  - `LAKEBASE_HOST`
  - `LAKEBASE_DATABASE`
  - `LAKEBASE_SCHEMA`

Missing values are logged early so deployments fail fast instead of throwing opaque pool errors later on.

---

### 2. OAuth Token Cache (Service Principal)

The `OAuthTokenCache` class encapsulates the entire client-credential exchange against Databricks OIDC:

```1:76:backend-scraper/lakebase.js
class OAuthTokenCache {
  constructor(clientId, clientSecret, databricksHost) { ... }
  async generateNewToken() { ... }
  async getToken() { ... }
}
```

Key behaviors:
- Normalizes `DATABRICKS_HOST` (protocol + trailing slash handling).
- Generates tokens via `POST /oidc/v1/token` using `client_credentials` + `scope=all-apis`.
- Caches the `access_token` and its expiry (`expires_in` − 60 s buffer) to avoid unnecessary requests.
- Serializes concurrent refreshes through `tokenPromise` so only one OAuth call happens even if many API routes request a client simultaneously.

**Cost benefit:** By reusing a single token until it expires, the service principal only performs one OAuth transaction per hour (or whatever `expires_in` is), instead of once per API call. This drastically trims Databricks audit noise and avoids throttling.

---

### 3. PgPoolManager (Lakebase connection reuse)

`PgPoolManager` wraps `pg.Pool` so every leased client automatically uses the latest OAuth token as the PostgreSQL password:

```79:123:backend-scraper/lakebase.js
class PgPoolManager {
  constructor(oauthCache, dbConfig) { ... }
  async createPool() { ... }
  async getPool() { ... }
}
```

Highlights:
- `createPool()` requests a fresh token from the cache, drains the previous pool (if any), and spins up a new pool whose `password` is the OAuth token.
- `getPool()` checks whether the cached token changed; if yes, it recreates the pool so idle clients never use an expired secret.
- Global `pgPoolManager` uses the service principal client ID as the PostgreSQL username and enforces TLS (`ssl: { rejectUnauthorized: true }`).

**Cost benefit:** PostgreSQL connections are reused across requests. The combination of `OAuthTokenCache` + `PgPoolManager` means one OAuth call feeds an entire pool of DB clients for its lifetime. Most API hits simply lease/release an existing client from the pool, so the service principal doesn’t repeatedly authenticate.

---

### 4. Borrowing Clients in API Routes

Every route or job that needs Lakebase calls `getPgClientFromPool()`:

```150:180:backend-scraper/lakebase.js
export const getPgClientFromPool = async () => {
  const pool = await pgPoolManager.getPool();
  const client = await pool.connect();
  return client;
};
```

Usage pattern inside routes (example from `voucher.js` / `server.js` / `scraper.js`):
1. `const pgClient = await getPgClientFromPool();`
2. Run SQL via `pgClient.query(...)`.
3. `pgClient.release()` in `finally` blocks to return it to the pool.

This keeps memory stable and ensures the pool has enough idle clients to absorb traffic without hammering OAuth.

---

### 5. Operational Notes

- **Token/Pool refresh** happens automatically—no route logic needs to anticipate expiry.
- **Environment validation** protects local devs from silent failures (missing `.env` keys result in explicit console errors).
- **Error transparency:** when `DATABRICKS_HOST` is missing, the exported helper throws immediately with actionable guidance, avoiding ambiguous “password authentication failed” errors.
- **Scalability:** because the token cache is process-wide, horizontal scaling (multiple Node processes/containers) still keeps OAuth calls minimal; each process maintains one token + pool.

---

### 6. What to do when extending

1. **Always import** `getPgClientFromPool()` instead of instantiating your own `Pool`.
2. **Wrap DB work** in try/finally and call `pgClient.release()` to avoid pool exhaustion.
3. **Never store tokens** anywhere else—the helper already abstracts it.
4. **Add env vars** to `.env.example` when new Lakebase metadata is required so validation can catch omissions.

Following this pattern keeps our Lakebase integration secure, maintainable, and inexpensive from the service principal perspective.



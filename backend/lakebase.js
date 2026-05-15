import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import axios from 'axios';
import pg from 'pg';
const { Pool } = pg;

// Load environment variables - ensure .env is loaded from the backend directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// ============================================================
// Lakebase Connection (cross-workspace compatible):
//
// 1. SP credentials authenticate against OAUTH_DATABRICKS_HOST
//    (the workspace where Lakebase lives)
// 2. OAuth token is used as PG password
// 3. PG user = SERVICE_PRINCIPAL_CLIENT_ID (NOT 'token')
// 4. Connects to LAKEBASE_HOST on port 5432
// ============================================================

class OAuthTokenCache {
  constructor(clientId, clientSecret, oauthHost) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;

    let normalizedHost = oauthHost || '';
    if (normalizedHost && !normalizedHost.startsWith('http')) {
      normalizedHost = `https://` + normalizedHost;
    }
    if (normalizedHost.endsWith('/')) {
      normalizedHost = normalizedHost.slice(0, -1);
    }
    this.oauthHost = normalizedHost;

    this.token = null;
    this.expiry = null;
    this.tokenPromise = null;
  }

  async generateNewToken() {
    if (!this.oauthHost) {
      throw new Error('OAuth host is not configured. Set OAUTH_DATABRICKS_HOST in app.yaml.');
    }
    if (!this.clientId || !this.clientSecret) {
      throw new Error('SP credentials missing. Set SERVICE_PRINCIPAL_CLIENT_ID and SERVICE_PRINCIPAL_CLIENT_SECRET in app.yaml.');
    }

    const tokenEndpoint = `${this.oauthHost}/oidc/v1/token`;
    console.log(`[OAuth] Requesting token from: ${tokenEndpoint}`);
    console.log(`[OAuth] Using SP Client ID: ${this.clientId.substring(0, 8)}...`);

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    try {
      const response = await axios.post(
        tokenEndpoint,
        'grant_type=client_credentials&scope=all-apis',
        { headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      this.token = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600;
      this.expiry = Date.now() + (expiresIn * 1000) - (60 * 1000);

      console.log('[OAuth] ✅ Token generated successfully.');
      return this.token;
    } catch (error) {
      this.token = null;
      this.expiry = null;
      const status = error.response?.status || 'unknown';
      console.error(`[OAuth] ❌ Token request failed (HTTP ${status}): ${error.message}`);
      console.error(`[OAuth] Endpoint: ${tokenEndpoint}`);
      console.error(`[OAuth] SP Client ID: ${this.clientId}`);
      throw new Error(`OAuth token generation failed (HTTP ${status}). Verify SP credentials and OAUTH_DATABRICKS_HOST.`);
    }
  }

  async getToken() {
    if (this.token && this.expiry && Date.now() < this.expiry) {
      return this.token;
    }
    if (this.tokenPromise) {
      return await this.tokenPromise;
    }
    try {
      this.tokenPromise = this.generateNewToken();
      return await this.tokenPromise;
    } finally {
      this.tokenPromise = null;
    }
  }
}

class PgPoolManager {
  constructor(oauthCache, dbConfig) {
    this.oauthCache = oauthCache;
    this.dbConfig = dbConfig;
    this.pool = null;
    this.currentToken = null;
  }

  async createPool() {
    const token = await this.oauthCache.getToken();

    if (this.pool) {
      await this.pool.end();
    }

    this.currentToken = token;

    this.pool = new Pool({
      ...this.dbConfig,
      password: token,
    });

    this.pool.on('error', (err) => {
      console.error('[PgPool] Unexpected error on idle client', err);
    });

    console.log(`[PgPool] ✅ Pool created → host=${this.dbConfig.host} user=${this.dbConfig.user} db=${this.dbConfig.database}`);
  }

  async getPool() {
    const freshToken = await this.oauthCache.getToken();
    if (!this.pool || freshToken !== this.currentToken) {
      await this.createPool();
    }
    return this.pool;
  }
}

// ============================================================
// Initialization
// ============================================================

// These MUST come from app.yaml (not system env vars) to avoid conflicts
const SP_CLIENT_ID = process.env.SERVICE_PRINCIPAL_CLIENT_ID;
const SP_CLIENT_SECRET = process.env.SERVICE_PRINCIPAL_CLIENT_SECRET;
const OAUTH_HOST = process.env.OAUTH_DATABRICKS_HOST;

// Log ALL relevant env vars at startup for debugging
console.log('\n--- Lakebase Configuration ---');
console.log(`OAUTH_DATABRICKS_HOST = ${OAUTH_HOST || '❌ NOT SET'}`);
console.log(`DATABRICKS_HOST (system) = ${process.env.DATABRICKS_HOST || 'not set'}`);
console.log(`SERVICE_PRINCIPAL_CLIENT_ID = ${SP_CLIENT_ID ? SP_CLIENT_ID.substring(0, 8) + '...' : '❌ NOT SET'}`);
console.log(`SERVICE_PRINCIPAL_CLIENT_SECRET = ${SP_CLIENT_SECRET ? '***set***' : '❌ NOT SET'}`);
console.log(`LAKEBASE_HOST = ${process.env.LAKEBASE_HOST || '❌ NOT SET'}`);
console.log(`LAKEBASE_DATABASE = ${process.env.LAKEBASE_DATABASE || '❌ NOT SET'}`);
console.log(`LAKEBASE_SCHEMA = ${process.env.LAKEBASE_SCHEMA || '❌ NOT SET'}`);
console.log(`LAKEBASE_PAT = ${process.env.LAKEBASE_PAT ? '***set***' : 'not set'}`);
console.log(`LAKEBASE_USER = ${process.env.LAKEBASE_USER || 'not set'}`);
console.log('------------------------------\n');

const usePATMode = !!(process.env.LAKEBASE_PAT && process.env.LAKEBASE_USER);

let patPool = null;
let oauthCache = null;
let pgPoolManager = null;

if (usePATMode) {
  console.log('[Lakebase] Mode: PAT');
  patPool = new Pool({
    host: process.env.LAKEBASE_HOST,
    port: process.env.LAKEBASE_PORT || 5432,
    database: process.env.LAKEBASE_DATABASE,
    user: process.env.LAKEBASE_USER,
    password: process.env.LAKEBASE_PAT,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  patPool.on('error', (err) => console.error('[PgPool-PAT] Error:', err));
  console.log('[Lakebase] PAT pool created.');
} else {
  // OAuth mode: use OAUTH_DATABRICKS_HOST explicitly (NOT DATABRICKS_HOST)
  // DATABRICKS_HOST is system-managed and points to the APP workspace
  // OAUTH_DATABRICKS_HOST points to the LAKEBASE workspace
  if (!OAUTH_HOST) {
    console.error('[Lakebase] ❌ FATAL: OAUTH_DATABRICKS_HOST is not set!');
    console.error('[Lakebase] This MUST be set in app.yaml to the Lakebase workspace URL.');
    console.error('[Lakebase] Example: https://adb-3520591918725100.0.azuredatabricks.net');
  }

  console.log(`[Lakebase] Mode: OAuth → ${OAUTH_HOST}`);

  oauthCache = new OAuthTokenCache(SP_CLIENT_ID, SP_CLIENT_SECRET, OAUTH_HOST);

  pgPoolManager = new PgPoolManager(oauthCache, {
    host: process.env.LAKEBASE_HOST,
    port: process.env.LAKEBASE_PORT || 5432,
    database: process.env.LAKEBASE_DATABASE,
    user: SP_CLIENT_ID,  // Lakebase requires the SP Client ID as the PG username
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
}

export const getPgClientFromPool = async () => {
  try {
    if (usePATMode) {
      const client = await patPool.connect();
      console.log('[PgPool] Client leased (PAT mode).');
      return client;
    } else {
      const pool = await pgPoolManager.getPool();
      const client = await pool.connect();
      console.log('[PgPool] Client leased (OAuth mode).');
      return client;
    }
  } catch (error) {
    console.error('[Lakebase] Failed to get client:', error.message);
    throw error;
  }
};

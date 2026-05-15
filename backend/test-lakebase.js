import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

async function getOAuthToken() {
  const tokenEndpoint = `${process.env.DATABRICKS_HOST}/oidc/v1/token`;
  const clientId = process.env.SERVICE_PRINCIPAL_CLIENT_ID || process.env.SP_ID;
  const clientSecret = process.env.SERVICE_PRINCIPAL_CLIENT_SECRET || process.env.SP_SECRET;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await axios.post(
    tokenEndpoint,
    'grant_type=client_credentials&scope=all-apis',
    { headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return response.data.access_token;
}

async function testConnection(name, user, password) {
  const pool = new pg.Pool({
    host: process.env.LAKEBASE_HOST,
    port: process.env.LAKEBASE_PORT || 5432,
    database: process.env.LAKEBASE_DATABASE,
    user: user, 
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    console.log(`✅ [${name}] SUCCESS`);
    client.release();
  } catch (err) {
    console.error(`❌ [${name}] FAILED: ${err.message}`);
  }
  await pool.end();
}

async function run() {
  const oauthToken = await getOAuthToken();
  const pat = process.env.DATABRICKS_TOKEN;
  
  await testConnection('1. PAT + user=token', "token", pat);
  await testConnection('2. PAT + user=email', "bharadwaj.kakarlamudi@celebaltech.com", pat);
  await testConnection('3. OAuth + user=token', "token", oauthToken);
  await testConnection('4. OAuth + user=SP_ID', process.env.SERVICE_PRINCIPAL_CLIENT_ID, oauthToken);
  await testConnection('5. OAuth + user=email', "bharadwaj.kakarlamudi@celebaltech.com", oauthToken);
}

run();

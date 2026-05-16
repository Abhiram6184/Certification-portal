
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables - ensure .env is loaded from the backend-scraper directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { DBSQLClient } from "@databricks/sql";
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI, Type } from "@google/genai";

import { getPgClientFromPool } from "./lakebase.js";
import { registerScraperRoutes, getBrowser, closeBrowser } from "./scraper.js";
import { registerVoucherRoutes } from "./voucher.js";
import { registerBulkUploadRoutes } from "./bulkupload.js";


// --- Diagnostic Logging ---
console.log("\n--- Backend Configuration Status ---");
if (process.env.API_KEY) {
  console.log("✅ Gemini API Key: Loaded successfully.");
} else {
  console.log("❌ Gemini API Key: NOT FOUND. Please check your backend-scraper/.env file.");
}
if (process.env.DATABRICKS_HOST && process.env.DATABRICKS_WAREHOUSE_ID && process.env.DATABRICKS_TOKEN && process.env.DATABRICKS_SCHEMA) {
  console.log("✅ Databricks SQL Warehouse Config: All variables seem to be present.");
} else {
  console.log("⚠️ Databricks SQL Warehouse Config: One or more variables missing. Legacy endpoints may fail.");
}
if (process.env.SERVICE_PRINCIPAL_CLIENT_ID && process.env.SERVICE_PRINCIPAL_CLIENT_SECRET && process.env.LAKEBASE_HOST && process.env.LAKEBASE_DATABASE && process.env.LAKEBASE_SCHEMA) {
  console.log("✅ Databricks Lakebase (PostgreSQL) Config: All variables seem to be present.");
} else {
  console.log("⚠️ Databricks Lakebase (PostgreSQL) Config: One or more variables missing. Migrated endpoints (e.g., email-login) may fail.");
}
if (process.env.MAIL_USER && process.env.MAIL_PASS) {
  console.log("✅ Nodemailer Config: MAIL_USER and MAIL_PASS are present.");
} else {
  console.log("❌ Nodemailer Config: MAIL_USER or MAIL_PASS not found in .env. Email sending will be disabled.");
}
if (process.env.LND_EMAIL) {
  console.log(`✅ L&D Email Config: LND_EMAIL found. Notifications will be sent to ${process.env.LND_EMAIL}.`);
} else {
  console.log("⚠️ L&D Email Config: LND_EMAIL not found in .env. Using default fallback email address.");
}
console.log("------------------------------------\n");


const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for file uploads
app.use(morgan("dev"));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Gemini AI setup
let ai;
if (process.env.API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
} else {
  console.error("Gemini API key not found in backend .env. Please set API_KEY. URL processing will be disabled.");
}
const geminiModel = "gemini-2.5-flash";


// --- DATABRICKS SQL WAREHOUSE (LEGACY) HELPERS ---
const sqlValue = (val) => (val ? `'${String(val).replace(/'/g, "''")}'` : "NULL");

const getDbClient = () => {
  const client = new DBSQLClient();
  return client.connect({
    host: process.env.DATABRICKS_HOST,
    path: `/sql/1.0/warehouses/${process.env.DATABRICKS_WAREHOUSE_ID}`,
    token: process.env.DATABRICKS_TOKEN,
  });
};

const dbHelpers = { getDbClient, sqlValue };


// --- REGISTER ROUTES FROM MODULES ---
registerScraperRoutes(app);
registerVoucherRoutes(app, { ...dbHelpers, ai });
registerBulkUploadRoutes(app);


// --- AI Model Configuration ---
const EXTRACTION_PROMPT = `
    Analyze the provided certificate document and extract the following details.
    The issuer's name is often found in the logo or header.
    The holder's name is the person who received the certificate.
    If an expiry date isn't found, return 'Does not expire'.
    Format the output according to the provided JSON schema.
`;

const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    issuer_name: { type: Type.STRING, description: "Name of the organization that issued the certificate." },
    credential_name: { type: Type.STRING, description: "The name or title of the certificate." },
    holder_full_name: { type: Type.STRING, description: "The full name of the person who received the certificate." },
    issued_date: { type: Type.STRING, description: "The date when the certificate was issued. Format as YYYY-MM-DD." },
    expiry_date: { type: Type.STRING, description: "The expiration date. Format as YYYY-MM-DD or 'Does not expire'." }
  },
  required: ["issuer_name", "credential_name", "holder_full_name"]
};


// --- CORE API ENDPOINTS ---

// THIS ENDPOINT IS MIGRATED TO POSTGRESQL/LAKEBASE
app.post("/api/email-login", async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: "Email is required." });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.endsWith('@celebaltech.com')) {
    return res.status(400).json({ error: "Invalid email domain. Please use a @celebaltech.com address." });
  }

  let pgClient;
  try {
    console.log(`[Lakebase] /api/email-login leasing client for user: ${cleanEmail}`);
    pgClient = await getPgClientFromPool();

    // Step 1: Find the employee in the EmployeeDetails table using lowercase identifiers.
    const employeeQuery = `
      SELECT emp_code, employee_name, employee_emailid, designation, department, profile_url
      FROM ${process.env.LAKEBASE_SCHEMA}.employeedetails
      WHERE LOWER(employee_emailid) = $1
    `;
    const employeeResult = await pgClient.query(employeeQuery, [cleanEmail]);

    if (employeeResult.rows.length === 0) {
      console.log(`[Auth] New user detected: ${email}. Prompting for registration.`);
      return res.json({ newUser: true, email: email.trim() });
    }

    const employee = employeeResult.rows[0];
    const userProfile = {
      id: employee.emp_code,
      name: employee.employee_name,
      email: employee.employee_emailid,
      designation: employee.designation,
      department: employee.department,
      profile_url: employee.profile_url,
      role: 'Employee'
    };

    // Step 2: Fetch credentials for that employee from the dynamic view.
    const credentialsQuery = `
      SELECT credential_id, credential_title, issued_on, status, expiry_date, credential_link
      FROM ${process.env.LAKEBASE_SCHEMA}.v_credentials
      WHERE emp_code = $1
      ORDER BY issued_on DESC
    `;
    const credentialsResult = await pgClient.query(credentialsQuery, [employee.emp_code]);

    const acquiredCredentials = credentialsResult.rows.map(row => ({
      credential_id: row.credential_id,
      title: row.credential_title,
      issuedOn: row.issued_on,
      status: row.status,
      expiryDate: row.expiry_date,
      credential_link: row.credential_link, // Include credential link
    }));

    console.log(`[Auth] Successful email login for ${email} via Lakebase. Found ${acquiredCredentials.length} credentials.`);
    res.json({
      user: userProfile,
      acquired: acquiredCredentials,
    });

  } catch (err) {
    console.error(`[Error] /api/email-login (Lakebase): ${err.message}`);
    res.status(500).json({ error: "A server error occurred while trying to log in via Lakebase." });
  } finally {
    if (pgClient) {
      pgClient.release();
      console.log('[PgPoolManager] Client released for /api/email-login.');
    }
  }
});

// THIS ENDPOINT IS MIGRATED TO POSTGRESQL/LAKEBASE
app.post("/api/register-employee", async (req, res) => {
  const { emp_code, employee_name, designation, email, profile_url } = req.body;
  if (!emp_code || !employee_name || !designation || !email) {
    return res.status(400).json({ error: "All fields except URL are required for registration." });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.endsWith('@celebaltech.com')) {
    return res.status(400).json({ error: "Invalid email domain for registration." });
  }

  let pgClient;
  try {
    console.log(`[Lakebase] /api/register-employee leasing client for user: ${cleanEmail}`);
    pgClient = await getPgClientFromPool();

    // Check if emp_code or email already exists to prevent duplicates
    const checkQuery = `
      SELECT 1 FROM ${process.env.LAKEBASE_SCHEMA}.employeedetails
      WHERE emp_code = $1 OR LOWER(employee_emailid) = $2
    `;
    const checkResult = await pgClient.query(checkQuery, [emp_code, cleanEmail]);

    if (checkResult.rows.length > 0) {
      return res.status(409).json({ error: "An employee with this Employee Code or Email already exists." });
    }

    // Insert the new employee record
    const insertQuery = `
      INSERT INTO ${process.env.LAKEBASE_SCHEMA}.employeedetails (emp_code, employee_name, employee_emailid, designation, profile_url)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await pgClient.query(insertQuery, [emp_code, employee_name, email, designation, profile_url || null]);

    console.log(`[Auth] New user ${employee_name} (${emp_code}) registered successfully via Lakebase.`);

    // Return the new user profile to log them in immediately
    const userProfile = {
      id: emp_code,
      name: employee_name,
      email: email,
      designation: designation,
      profile_url: profile_url || null,
      role: 'Employee'
    };

    // Return a response consistent with the login endpoint
    res.status(201).json({ user: userProfile, acquired: [] });

  } catch (err) {
    console.error(`[Error] /api/register-employee (Lakebase): ${err.message}`);
    res.status(500).json({ error: "A server error occurred during registration." });
  } finally {
    if (pgClient) {
      pgClient.release();
      console.log('[PgPoolManager] Client released for /api/register-employee.');
    }
  }
});

// MIGRATED TO POSTGRESQL/LAKEBASE
app.get("/api/leaderboard", async (req, res) => {
  let pgClient;
  try {
    console.log('[Lakebase] /api/leaderboard leasing client.');
    pgClient = await getPgClientFromPool();
    const query = `
            SELECT
                emp_code,
                emp_name,
                employee_emailid,
                designation,
                credential_count,
                DENSE_RANK() OVER (ORDER BY credential_count DESC) as rank
            FROM (
                SELECT
                    e.emp_code,
                    e.employee_name AS emp_name,
                    e.employee_emailid,
                    e.designation,
                    COUNT(c.credential_id) AS credential_count
                FROM
                    ${process.env.LAKEBASE_SCHEMA}.employeedetails e
                LEFT JOIN
                    ${process.env.LAKEBASE_SCHEMA}.v_credentials c ON e.emp_code = c.emp_code
                GROUP BY
                    e.emp_code, e.employee_name, e.employee_emailid, e.designation
            ) as ranked_employees
            ORDER BY
                rank ASC, emp_name ASC
        `;

    const result = await pgClient.query(query);

    const leaderboard = result.rows.map(row => ({
      emp_code: row.emp_code,
      Emp_name: row.emp_name,
      Employee_EmailID: row.employee_emailid,
      Designation: row.designation,
      credential_count: parseInt(row.credential_count, 10),
      rank: row.rank
    }));

    const totalEmployees = leaderboard.length;
    const totalCredentials = leaderboard.reduce((sum, employee) => sum + employee.credential_count, 0);

    res.json({
      leaderboard,
      summary: {
        totalEmployees,
        totalCredentials,
      },
    });
  } catch (err) {
    console.error("[Error] /api/leaderboard (Lakebase):", err.message);
    res.status(500).json({ error: "Failed to fetch leaderboard data." });
  } finally {
    if (pgClient) {
      pgClient.release();
      console.log('[PgPoolManager] Client released for /api/leaderboard.');
    }
  }
});

// MIGRATED TO POSTGRESQL/LAKEBASE
app.get("/api/leaderboard/by-issuer", async (req, res) => {
  let pgClient;
  try {
    console.log('[Lakebase] /api/leaderboard/by-issuer leasing client.');
    pgClient = await getPgClientFromPool();
    const query = `
            WITH IssuerCounts AS (
                SELECT
                    CASE
                        WHEN LOWER(credential_title) LIKE '%databricks%' THEN 'Databricks'
                        WHEN LOWER(credential_title) LIKE '%microsoft%' OR LOWER(credential_title) LIKE '%azure%' THEN 'Microsoft'
                        WHEN LOWER(credential_title) LIKE '%google%' THEN 'Google'
                        WHEN LOWER(credential_title) LIKE '%aws%' THEN 'AWS'
                        ELSE 'Others'
                    END as issuer_name,
                    COUNT(credential_id) as credential_count
                FROM
                    ${process.env.LAKEBASE_SCHEMA}.v_credentials
                WHERE
                    credential_title IS NOT NULL AND credential_title != ''
                GROUP BY
                    issuer_name
            )
            SELECT
                DENSE_RANK() OVER (ORDER BY credential_count DESC) as rank,
                issuer_name,
                credential_count
            FROM
                IssuerCounts
            ORDER BY
                rank ASC, issuer_name ASC
        `;

    const result = await pgClient.query(query);

    const typedResult = result.rows.map(row => ({
      ...row,
      credential_count: parseInt(row.credential_count, 10),
    }));

    res.json(typedResult);

  } catch (err) {
    console.error("[Error] /api/leaderboard/by-issuer (Lakebase):", err.message);
    res.status(500).json({ error: "Failed to fetch issuer leaderboard data." });
  } finally {
    if (pgClient) {
      pgClient.release();
      console.log('[PgPoolManager] Client released for /api/leaderboard/by-issuer.');
    }
  }
});


app.post("/api/extract-from-url", async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Backend AI service is not configured. API_KEY is missing." });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required." });
  }

  try {
    console.log(`[AI] Fetching content from URL: ${url}`);
    const pdfResponse = await fetch(url);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch from URL: ${pdfResponse.statusText}`);
    }

    const mimeType = pdfResponse.headers.get('content-type');
    if (!mimeType || !mimeType.includes('application/pdf')) {
      console.warn(`[AI] Content-Type from URL is not PDF (${mimeType}). The document might not be processed correctly.`);
    }

    const arrayBuffer = await pdfResponse.arrayBuffer();
    const base64File = Buffer.from(arrayBuffer).toString('base64');

    console.log(`[AI] Sending PDF content from URL to Gemini for extraction.`);

    const filePart = {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64File
      },
    };
    const textPart = { text: EXTRACTION_PROMPT };

    const geminiResponse = await ai.models.generateContent({
      model: geminiModel,
      contents: { parts: [textPart, filePart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: EXTRACTION_SCHEMA
      }
    });

    const jsonText = geminiResponse.text.trim();
    const extracted = JSON.parse(jsonText);

    console.log("[AI] Extraction from URL successful.");
    res.json(extracted);

  } catch (error) {
    console.error("[Error] /api/extract-from-url:", error);
    res.status(500).json({ error: "AI extraction failed. The document at the URL might not be a valid certificate or is inaccessible." });
  }
});

app.post("/api/extract-from-file", async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Backend AI service is not configured. API_KEY is missing." });
  }

  const { base64File, mimeType, fileName } = req.body;
  if (!base64File || !mimeType) {
    return res.status(400).json({ error: "base64File and mimeType are required." });
  }

  try {
    console.log(`[AI] Sending file ${fileName} to Gemini for extraction.`);

    const filePart = { inlineData: { mimeType, data: base64File } };
    const textPart = { text: EXTRACTION_PROMPT };

    const geminiResponse = await ai.models.generateContent({
      model: geminiModel,
      contents: { parts: [textPart, filePart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: EXTRACTION_SCHEMA
      }
    });

    const jsonText = geminiResponse.text.trim();
    const extracted = JSON.parse(jsonText);

    console.log(`[AI] Extraction from file ${fileName} successful.`);
    res.json(extracted);

  } catch (error) {
    console.error("[Error] /api/extract-from-file:", error);
    res.status(500).json({ error: "AI extraction failed. The document might not be a valid certificate or is unreadable." });
  }
});

// THIS ENDPOINT IS MIGRATED TO POSTGRESQL/LAKEBASE
app.post("/api/add-certificate", async (req, res) => {
  const { certificateData, user } = req.body;
  if (!certificateData || !user) {
    return res.status(400).json({ error: 'Missing certificate data or user information.' });
  }

  let pgClient;
  try {
    const { credential_name, holder_full_name, issued_date, expiry_date } = certificateData;

    const isEmailLogin = !!user.email;
    const emp_code = isEmailLogin ? user.id : null;
    const username = isEmailLogin ? null : user.id;

    console.log(`[Lakebase] /api/add-certificate leasing client for user: ${user.id}`);
    pgClient = await getPgClientFromPool();

    // Prepare the new record data
    const credentialId = uuidv4();
    const issuedOn = issued_date ? new Date(issued_date).toISOString() : null;
    const normalizedTitle = credential_name.trim().toLowerCase();

    // Step 1: Check if a matching record already exists
    // Match on: normalized credential_title AND (username OR emp_code)
    const checkQuery = `
      SELECT credential_id
      FROM ${process.env.LAKEBASE_SCHEMA}.credentials
      WHERE TRIM(LOWER(credential_title)) = $1
        AND (
          (username = $2 AND $2 IS NOT NULL)
          OR
          (emp_code = $3 AND $3 IS NOT NULL)
        )
      LIMIT 1
    `;
    const checkResult = await pgClient.query(checkQuery, [normalizedTitle, username, emp_code]);

    if (checkResult.rows.length > 0) {
      // Step 2a: Record exists - UPDATE it
      const existingCredentialId = checkResult.rows[0].credential_id;
      const updateQuery = `
        UPDATE ${process.env.LAKEBASE_SCHEMA}.credentials
        SET full_name = $1,
            issued_on = $2,
            expiry_date = $3
        WHERE credential_id = $4
      `;
      await pgClient.query(updateQuery, [holder_full_name, issuedOn, expiry_date, existingCredentialId]);
      console.log(`[Lakebase] Updated existing certificate ${existingCredentialId} for user ${user.id}`);
    } else {
      // Step 2b: Record doesn't exist - INSERT it
      const insertQuery = `
        INSERT INTO ${process.env.LAKEBASE_SCHEMA}.credentials
          (credential_id, username, emp_code, full_name, credential_title, issued_on, expiry_date, credential_link)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      await pgClient.query(insertQuery, [
        credentialId,
        username,
        emp_code,
        holder_full_name,
        credential_name,
        issuedOn,
        expiry_date,
        null  // credential_link is NULL for manually added certificates
      ]);
      console.log(`[Lakebase] Inserted new certificate ${credentialId} for user ${user.id}`);
    }

    // Step 3: Re-fetch the record from the view to get the calculated status
    const selectQuery = `
      SELECT *
      FROM ${process.env.LAKEBASE_SCHEMA}.v_credentials
      WHERE TRIM(LOWER(credential_title)) = $1
        AND (
          (username = $2 AND $2 IS NOT NULL)
          OR
          (emp_code = $3 AND $3 IS NOT NULL)
        )
      LIMIT 1
    `;
    const selectResult = await pgClient.query(selectQuery, [normalizedTitle, username, emp_code]);

    if (selectResult.rows.length > 0) {
      const finalRecord = selectResult.rows[0];
      console.log(`[Lakebase] Successfully upserted certificate for user ${user.id}. Returning record with ID: ${finalRecord.credential_id}`);
      res.status(201).json(finalRecord);
    } else {
      // Fallback: return the record we just created/updated
      const fallbackRecord = {
        credential_id: checkResult.rows.length > 0 ? checkResult.rows[0].credential_id : credentialId,
        username,
        emp_code,
        full_name: holder_full_name,
        credential_title: credential_name,
        issued_on: issuedOn,
        expiry_date: expiry_date,
        status: 'Active' // Default status
      };
      console.warn(`[Lakebase] Could not re-fetch record for ${credential_name} post-upsert. Returning fallback object.`);
      res.status(201).json(fallbackRecord);
    }

  } catch (err) {
    console.error(`[Error] /api/add-certificate (Lakebase): ${err.message}`);
    res.status(500).json({ error: "Failed to save certificate to the database." });
  } finally {
    if (pgClient) {
      pgClient.release();
      console.log('[PgPoolManager] Client released for /api/add-certificate.');
    }
  }
});


// --- ADMIN DATA ENDPOINTS ---
// THIS ENDPOINT IS MIGRATED TO POSTGRESQL/LAKEBASE
app.get("/api/admin/employees", async (req, res) => {
  let pgClient;
  try {
    console.log('[Lakebase] /api/admin/employees leasing client.');
    pgClient = await getPgClientFromPool();

    const query = `
            SELECT
                e.emp_code,
                MAX(e.employee_name) AS "Emp_name",
                MAX(e.employee_emailid) AS "Employee_EmailID",
                MAX(e.designation) AS "Designation",
                MAX(e.department) AS "Department",
                MAX(e.city) AS "City",
                MAX(e.profile_url) AS profile_url,
                COUNT(c.credential_id) AS credential_count
            FROM
                ${process.env.LAKEBASE_SCHEMA}.employeedetails e
            LEFT JOIN
                ${process.env.LAKEBASE_SCHEMA}.credentials c ON e.emp_code = c.emp_code
            GROUP BY
                e.emp_code
            ORDER BY
                credential_count DESC, "Emp_name" ASC
        `;
    console.log(`[Lakebase] Querying employee directory from employeedetails table.`);
    const result = await pgClient.query(query);

    // Map results to match expected format (preserve column name casing for frontend compatibility)
    const mappedResults = result.rows.map(row => ({
      emp_code: row.emp_code,
      Emp_name: row.Emp_name,
      Employee_EmailID: row.Employee_EmailID,
      Designation: row.Designation,
      Department: row.Department,
      City: row.City,
      credential_count: parseInt(row.credential_count, 10)
    }));

    res.json(mappedResults);
  } catch (err) {
    console.error(`[Error] /api/admin/employees (Lakebase): ${err.message}`);
    res.status(500).json({ error: "Failed to fetch employee data." });
  } finally {
    if (pgClient) {
      pgClient.release();
      console.log('[PgPoolManager] Client released for /api/admin/employees.');
    }
  }
});

app.get("/api/admin/credentials/by-emp-code/:emp_code", async (req, res) => {
  const { emp_code } = req.params;
  if (!emp_code) {
    return res.status(400).json({ error: "Employee code is required." });
  }

  let pgClient;
  try {
    console.log(`[Lakebase] /api/admin/credentials/by-emp-code leasing client for emp_code: ${emp_code}`);
    pgClient = await getPgClientFromPool();
    const query = `
            SELECT *
            FROM ${process.env.LAKEBASE_SCHEMA}.v_credentials
            WHERE emp_code = $1
            ORDER BY issued_on DESC
        `;
    const result = await pgClient.query(query, [emp_code]);

    console.log(`[Lakebase] Fetched ${result.rows.length} credentials for emp_code ${emp_code}.`);
    const mappedResults = result.rows.map(row => ({
      credential_id: row.credential_id,
      username: row.username,
      emp_code: row.emp_code,
      full_name: row.full_name,
      credential_title: row.credential_title,
      title: row.credential_title, // Alias for frontend
      issued_on: row.issued_on,
      expiry_date: row.expiry_date,
      status: row.status,
      credential_link: row.credential_link, // Include credential link
    }));
    res.json(mappedResults);
  } catch (err) {
    console.error(`[Error] /api/admin/credentials/by-emp-code (Lakebase) for emp_code ${emp_code} failed:`, err);
    res.status(500).json({ error: "Failed to fetch employee credentials." });
  } finally {
    if (pgClient) {
      pgClient.release();
      console.log(`[PgPoolManager] Client released for /api/admin/credentials/by-emp-code/${emp_code}.`);
    }
  }
});

// THIS ENDPOINT IS MIGRATED TO POSTGRESQL/LAKEBASE
app.get("/api/admin/credentials-summary", async (req, res) => {
  let pgClient;
  try {
    console.log('[Lakebase] /api/admin/credentials-summary leasing client.');
    pgClient = await getPgClientFromPool();

    const query = `
            SELECT
                TRIM(credential_title) as credential_title,
                COUNT(DISTINCT emp_code) as employee_count,
                ARRAY_AGG(DISTINCT emp_code) as emp_codes
            FROM
                ${process.env.LAKEBASE_SCHEMA}.credentials
            WHERE
                credential_title IS NOT NULL
            GROUP BY
                TRIM(credential_title)
            ORDER BY
                employee_count DESC, TRIM(credential_title) ASC
        `;
    console.log(`[Lakebase] Querying credential summary.`);
    const result = await pgClient.query(query);

    // Map results to ensure employee_count is an integer
    const mappedResults = result.rows.map(row => ({
      credential_title: row.credential_title,
      employee_count: parseInt(row.employee_count, 10),
      emp_codes: row.emp_codes || []
    }));

    res.json(mappedResults);
  } catch (err) {
    console.error(`[Error] /api/admin/credentials-summary (Lakebase): ${err.message}`);
    res.status(500).json({ error: "Failed to fetch credentials summary." });
  } finally {
    if (pgClient) {
      pgClient.release();
      console.log('[PgPoolManager] Client released for /api/admin/credentials-summary.');
    }
  }
});

// THIS ENDPOINT IS MIGRATED TO POSTGRESQL/LAKEBASE
app.get("/api/admin/employees-by-credential", async (req, res) => {
  const { title } = req.query;
  if (!title) {
    return res.status(400).json({ error: "Credential title is required." });
  }

  let pgClient;
  try {
    console.log(`[Lakebase] /api/admin/employees-by-credential leasing client for credential: ${title}`);
    pgClient = await getPgClientFromPool();

    const query = `
            SELECT
                e.emp_code AS "Emp_Code",
                e.employee_name AS "Employee_Name",
                e.employee_emailid AS "Employee_EmailID",
                e.designation AS "Designation"
            FROM
                ${process.env.LAKEBASE_SCHEMA}.credentials c
            JOIN
                ${process.env.LAKEBASE_SCHEMA}.employeedetails e ON c.emp_code = e.emp_code
            WHERE
                TRIM(LOWER(c.credential_title)) = TRIM(LOWER($1))
                AND c.emp_code IS NOT NULL
            GROUP BY
                e.emp_code, e.employee_name, e.employee_emailid, e.designation
            ORDER BY
                e.employee_name ASC
        `;
    const result = await pgClient.query(query, [title]);

    // Map results to match expected format (preserve column name casing for frontend compatibility)
    const mappedResults = result.rows.map(row => ({
      Emp_Code: row.Emp_Code,
      Employee_Name: row.Employee_Name,
      Employee_EmailID: row.Employee_EmailID,
      Designation: row.Designation
    }));

    res.json(mappedResults);
  } catch (err) {
    console.error(`[Error] /api/admin/employees-by-credential (Lakebase) for credential "${title}" failed:`, err);
    res.status(500).json({ error: "Failed to fetch employees for this credential." });
  } finally {
    if (pgClient) {
      pgClient.release();
      console.log('[PgPoolManager] Client released for /api/admin/employees-by-credential.');
    }
  }
});

// THIS ENDPOINT IS MIGRATED TO POSTGRESQL/LAKEBASE
app.get("/api/admin/all-credentials-report", async (req, res) => {
  let pgClient;
  try {
    console.log('[Lakebase] /api/admin/all-credentials-report leasing client.');
    pgClient = await getPgClientFromPool();

    const query = `
            SELECT
                c.credential_title AS "CredentialName",
                e.emp_code AS "Emp_Code",
                e.employee_name AS "Employee_Name",
                e.employee_emailid AS "Employee_EmailID",
                e.designation AS "Designation"
            FROM
                ${process.env.LAKEBASE_SCHEMA}.v_credentials c
            JOIN
                ${process.env.LAKEBASE_SCHEMA}.employeedetails e ON c.emp_code = e.emp_code
            WHERE c.emp_code IS NOT NULL AND c.credential_title IS NOT NULL
            ORDER BY
                c.credential_title ASC, e.employee_name ASC
        `;
    console.log(`[Lakebase] Querying for full credential report.`);
    const result = await pgClient.query(query);

    // Map results to match expected format (preserve column name casing for frontend compatibility)
    const mappedResults = result.rows.map(row => ({
      CredentialName: row.CredentialName,
      Emp_Code: row.Emp_Code,
      Employee_Name: row.Employee_Name,
      Employee_EmailID: row.Employee_EmailID,
      Designation: row.Designation
    }));

    res.json(mappedResults);
  } catch (err) {
    console.error(`[Error] /api/admin/all-credentials-report (Lakebase): ${err.message}`);
    res.status(500).json({ error: "Failed to fetch credentials report data." });
  } finally {
    if (pgClient) {
      pgClient.release();
      console.log('[PgPoolManager] Client released for /api/admin/all-credentials-report.');
    }
  }
});


// Serve static frontend files
app.use(express.static(join(__dirname, 'static')));

// The "catchall" handler: for any request that doesn't match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'static/index.html'));
});

// Health check
app.get("/health", (_, res) => res.json({ status: "healthy" }));

// Start server only if not running on Vercel (Vercel uses the exported app)
if (!process.env.VERCEL) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Backend server running on http://0.0.0.0:${PORT}`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`❌ Port ${PORT} is already in use.`);
      process.exit(1);
    }
  });
}
process.on("SIGTERM", async () => { await closeBrowser(); process.exit(0); });
process.on("SIGINT", async () => { await closeBrowser(); process.exit(0); });

export default app;
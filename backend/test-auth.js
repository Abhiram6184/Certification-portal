const { Client } = require('pg');
const xlsx = require('xlsx');
const path = require('path');

// 1. The Token (Using the one you provided in the previous version)
const token = "eyJraWQiOiJjMGQ2YzQ2MTA4NWVmY2E1YTgzYTMxNzI2ZDQ2ZmMzN2QxNmMwYzY4NWQwNDRhMTJhNTUxNjhhOGM3MzZkM2U2IiwidHlwIjoiYXQrand0IiwiYWxnIjoiUlMyNTYifQ.eyJjbGllbnRfaWQiOiJkYXRhYnJpY2tzLXNlc3Npb24iLCJzY29wZSI6ImlhbS5jdXJyZW50LXVzZXI6cmVhZCBpYW0uZ3JvdXBzOnJlYWQgaWFtLnNlcnZpY2UtcHJpbmNpcGFsczpyZWFkIGlhbS51c2VyczpyZWFkIiwiaWRtIjoiRUFBPSIsImlzcyI6Imh0dHBzOi8vYWRiLTM1MjA1OTE5MTg3MjUxMDAuMC5henVyZWRhdGFicmlja3MubmV0L29pZGMiLCJhdWQiOiIzNTIwNTkxOTE4NzI1MTAwIiwic3ViIjoiYmhhcmFkd2FqLmtha2FybGFtdWRpQGNlbGViYWx0ZWNoLmNvbSIsImlhdCI6MTc2Nzg0ODM0MywiZXhwIjoxNzY3ODUxOTQzLCJqdGkiOiI2YTE1N2Q5NS05ZjE4LTQ0OWMtOTAyMC05NGNmOGY0NDJmNWYifQ.qxDPxHxmLwnK5ruBZGH80iHQiKbwma8oxGe-gDt4FnCTYfagQMU5DXDDkfAhmvYG01Y9spPBiWbOM7hzH2AQotBoIJl-Cy8Hpfat2pL2TIP1yR4AK8NSHavTozYrVZahGMaPIkpiMAjTgQ2j_sPBA1Au5LHIA7FHZjt5EPqB0un-Z5Ez5Xn-lBFpLU9m6UL6_ri8qmgKXds2CZ_sYz8GKgXLKDIOU7ENhvrMXTYEM8JPVgdT5oP86wHFkvigq_E6Z58kG7YXB-NlSUlEqL4_gSb4qJx25Zxqcf4KtKTxrl10OFZrPKCiv_7p1PqA5h9mJQjA5Amj9M-zcFrDlTXl1A";

// 2. Connection Details
const config = {
  host: 'instance-c93f2f81-421c-4cbf-b985-0ac352f757a4.database.azuredatabricks.net',
  port: 5432,
  database: 'certification_portal_pgdb',
  user: 'bharadwaj.kakarlamudi@celebaltech.com',
  password: token,
  ssl: { rejectUnauthorized: true }
};

console.log(`Testing PostgreSQL connection to Lakebase...`);

const client = new Client(config);

async function runUpsert() {
  try {
    await client.connect();
    console.log('\n[RESULT] SUCCESS: Connected to Lakebase!');

    // 1. Read Excel File
    const excelPath = path.join(__dirname, 'emp_master.xlsx');
    console.log(`Reading Excel file from: ${excelPath}`);

    let workbook;
    try {
      workbook = xlsx.readFile(excelPath);
    } catch (e) {
      console.error('Error reading Excel file. Ensure "emp_master.xlsx" exists.');
      throw e;
    }

    // Read 'master' sheet
    const sheetName = 'master';
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      console.error(`Sheet "${sheetName}" not found in Excel file.`);
      return;
    }
    const employees = xlsx.utils.sheet_to_json(sheet);
    console.log(`Found ${employees.length} records in Excel sheet "${sheetName}".`);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const emp of employees) {
      // Map Excel columns
      // Expected: email, name, designation, department, emp_code, city
      const email = emp['email'] || emp['Email'] || emp['Employee_EmailID'];
      const fullName = emp['name'] || emp['Name'] || emp['Emp_name'] || emp['full_name'];
      const empCode = emp['emp_code'] || emp['Emp_Code'] || emp['Emp_code'];
      const designation = emp['designation'] || emp['Designation'];
      const department = emp['department'] || emp['Department'];
      const city = emp['city'] || emp['City'] || emp['location'] || emp['Location'];

      // Strictly skip if empCode is missing or whitespace only
      if (!empCode || String(empCode).trim() === '') {
        console.warn(`[SKIP] Missing or empty emp_code for record: ${JSON.stringify(emp)}`);
        skipped++;
        continue;
      }

      try {
        // Check if emp_code exists
        const checkRes = await client.query(
          'SELECT 1 FROM "certification_portal_pgdb"."portal_data"."employeedetails" WHERE emp_code = $1',
          [empCode]
        );

        if (checkRes.rowCount > 0) {
          // UPDATE: Update department and city
          const updateQuery = `
                    UPDATE "certification_portal_pgdb"."portal_data"."employeedetails"
                    SET department = $1, city = $2
                    WHERE emp_code = $3
                `;
          await client.query(updateQuery, [department, city, empCode]);
          console.log(`[UPDATE] Updated ${empCode}: Dep=${department}, City=${city}`);
          updated++;
        } else {
          // INSERT: Create new record
          // Columns: emp_code, employee_name, employee_emailid, designation, department, city
          const insertQuery = `
                    INSERT INTO "certification_portal_pgdb"."portal_data"."employeedetails" 
                    (emp_code, employee_name, employee_emailid, designation, department, city) 
                    VALUES ($1, $2, $3, $4, $5, $6)
                `;
          await client.query(insertQuery, [empCode, fullName, email, designation, department, city]);
          console.log(`[INSERT] Added new employee: ${empCode} (${fullName})`);
          inserted++;
        }
      } catch (dbErr) {
        console.error(`[ERROR] Failed to process ${empCode}: ${dbErr.message}`);
        errors++;
      }
    }

    console.log(`\nOperation Complete.`);
    console.log(`Updated: ${updated}`);
    console.log(`Inserted: ${inserted}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors:  ${errors}`);

  } catch (err) {
    console.log('\n[RESULT] FAILURE: Could not connect or execute.');
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

runUpsert();
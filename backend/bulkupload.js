import { v4 as uuidv4 } from 'uuid';
import { getPgClientFromPool } from "./lakebase.js";

export const registerBulkUploadRoutes = (app) => {
    // THIS ENDPOINT IS MIGRATED TO POSTGRESQL/LAKEBASE
    app.post("/api/admin/bulk-upload-credentials", async (req, res) => {
        const { csvData } = req.body;
        if (!csvData) {
            return res.status(400).json({ error: "CSV data is required." });
        }

        let pgClient;
        try {
            console.log('[Lakebase] /api/admin/bulk-upload-credentials leasing client.');
            pgClient = await getPgClientFromPool();

            const decodedCsv = Buffer.from(csvData, 'base64').toString('utf-8');
            const rows = decodedCsv.split('\n').map(row => row.trim()).filter(Boolean);
            if (rows.length < 2) {
                return res.status(400).json({ error: "CSV file must contain a header and at least one data row." });
            }

            const header = rows.shift().toLowerCase().split(',').map(h => h.trim());
            const requiredHeaders = ['credential_name', 'final_email', 'issued_on', 'expired_on'];
            const missingHeaders = requiredHeaders.filter(h => !header.includes(h));
            if (missingHeaders.length > 0) {
                return res.status(400).json({ error: `Missing required CSV columns: ${missingHeaders.join(', ')}` });
            }

            const records = rows.map(row => {
                const values = row.split(',');
                const record = {};
                header.forEach((h, i) => record[h] = values[i]?.trim());
                return record;
            });

            const emails = [...new Set(records.map(r => r.final_email?.toLowerCase()).filter(Boolean))];
            if (emails.length === 0) {
                return res.status(400).json({ error: "No valid emails found in the CSV file." });
            }

            // Step 1: Look up employees by email using parameterized query
            const placeholders = emails.map((_, i) => `$${i + 1}`).join(',');
            const employeeQuery = `
                SELECT emp_code, employee_name, LOWER(employee_emailid) as email
                FROM ${process.env.LAKEBASE_SCHEMA}.employeedetails
                WHERE LOWER(employee_emailid) IN (${placeholders})
            `;
            const employeeResult = await pgClient.query(employeeQuery, emails);
            const employees = employeeResult.rows;

            const employeeMap = new Map(employees.map(e => [e.email, e]));
            const validRecords = [];
            const errors = [];

            records.forEach((record, index) => {
                const email = record.final_email?.toLowerCase();
                if (!email) {
                    errors.push({ row: index + 2, email: 'N/A', reason: 'Missing email address.' });
                    return;
                }
                const employee = employeeMap.get(email);
                if (!employee) {
                    errors.push({ row: index + 2, email: record.final_email, reason: 'Email not found in Employee Directory.' });
                    return;
                }
                if (!record.credential_name) {
                    errors.push({ row: index + 2, email: record.final_email, reason: 'Missing credential_name.' });
                    return;
                }
                validRecords.push({
                    emp_code: employee.emp_code,
                    full_name: employee.employee_name,
                    credential_title: record.credential_name,
                    issued_on: record.issued_on ? new Date(record.issued_on).toISOString() : null,
                    expiry_date: record.expired_on || 'Does not expire',
                });
            });

            if (validRecords.length > 0) {
                // Step 2: Deduplicate records in JavaScript (replacing MAX_BY logic)
                // Group by emp_code and normalized credential_title, keep the one with latest issued_on
                const dedupMap = new Map();
                validRecords.forEach(record => {
                    const key = `${record.emp_code}|${record.credential_title.trim().toLowerCase()}`;
                    const existing = dedupMap.get(key);
                    if (!existing || 
                        (record.issued_on && existing.issued_on && 
                         new Date(record.issued_on) > new Date(existing.issued_on))) {
                        dedupMap.set(key, record);
                    }
                });
                const deduplicatedRecords = Array.from(dedupMap.values());

                // Step 3: Use PostgreSQL UPSERT with batch processing
                // Process in batches to avoid parameter limit issues and improve performance
                const batchSize = 100;
                let processedCount = 0;

                for (let i = 0; i < deduplicatedRecords.length; i += batchSize) {
                    const batch = deduplicatedRecords.slice(i, i + batchSize);
                    
                    // Use transaction for each batch to ensure atomicity
                    await pgClient.query('BEGIN');
                    try {
                        for (const record of batch) {
                            const normalizedTitle = record.credential_title.trim().toLowerCase();
                            
                            // Check if record exists
                            const checkQuery = `
                                SELECT credential_id
                                FROM ${process.env.LAKEBASE_SCHEMA}.credentials
                                WHERE emp_code = $1
                                  AND TRIM(LOWER(credential_title)) = $2
                                LIMIT 1
                            `;
                            const checkResult = await pgClient.query(checkQuery, [record.emp_code, normalizedTitle]);

                            if (checkResult.rows.length > 0) {
                                // Update existing
                                const updateQuery = `
                                    UPDATE ${process.env.LAKEBASE_SCHEMA}.credentials
                                    SET full_name = $1,
                                        issued_on = $2,
                                        expiry_date = $3
                                    WHERE credential_id = $4
                                `;
                                await pgClient.query(updateQuery, [
                                    record.full_name,
                                    record.issued_on,
                                    record.expiry_date,
                                    checkResult.rows[0].credential_id
                                ]);
                            } else {
                                // Insert new
                                const insertQuery = `
                                    INSERT INTO ${process.env.LAKEBASE_SCHEMA}.credentials
                                        (credential_id, emp_code, full_name, credential_title, issued_on, expiry_date, credential_link)
                                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                                `;
                                await pgClient.query(insertQuery, [
                                    uuidv4(),
                                    record.emp_code,
                                    record.full_name,
                                    record.credential_title,
                                    record.issued_on,
                                    record.expiry_date,
                                    null  // credential_link is NULL for bulk uploaded credentials
                                ]);
                            }
                        }
                        await pgClient.query('COMMIT');
                        processedCount += batch.length;
                    } catch (batchErr) {
                        await pgClient.query('ROLLBACK');
                        throw batchErr;
                    }
                }

                console.log(`[Lakebase] Bulk upsert complete. Processed ${processedCount} deduplicated records from ${validRecords.length} total records.`);
            }

            res.json({
                processed: records.length,
                success: validRecords.length,
                errors: errors,
            });

        } catch (err) {
            console.error(`[Error] /api/admin/bulk-upload-credentials (Lakebase): ${err.message}`);
            res.status(500).json({ error: "An unexpected server error occurred during the bulk upload process." });
        } finally {
            if (pgClient) {
                pgClient.release();
                console.log('[PgPoolManager] Client released for /api/admin/bulk-upload-credentials.');
            }
        }
    });

    // THIS ENDPOINT IS MIGRATED TO POSTGRESQL/LAKEBASE
    app.post("/api/admin/bulk-upload-vouchers", async (req, res) => {
        const { csvData } = req.body;
        if (!csvData) {
            return res.status(400).json({ error: "CSV data is required." });
        }
    
        let pgClient;
        try {
            console.log('[Lakebase] /api/admin/bulk-upload-vouchers leasing client.');
            pgClient = await getPgClientFromPool();
    
            const decodedCsv = Buffer.from(csvData, 'base64').toString('utf-8');
            const rows = decodedCsv.split('\n').map(row => row.trim()).filter(Boolean);
            if (rows.length < 2) {
                return res.status(400).json({ error: "CSV file must contain a header and at least one data row." });
            }
    
            const header = rows.shift().toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
            const requiredHeaders = ['credential_name', 'voucher_code', 'expiry_date'];
            const missingHeaders = requiredHeaders.filter(h => !header.includes(h));
            if (missingHeaders.length > 0) {
                return res.status(400).json({ error: `Missing required CSV columns: ${missingHeaders.join(', ')}` });
            }
    
            const records = rows.map(row => {
                const values = row.split(',');
                const record = {};
                header.forEach((h, i) => record[h] = values[i]?.trim().replace(/"/g, ''));
                return record;
            });
    
            const validRecords = [];
            const errors = [];
    
            records.forEach((record, index) => {
                if (!record.voucher_code) {
                    errors.push({ row: index + 2, voucherCode: 'N/A', reason: 'Missing Voucher_Code.' });
                    return;
                }
                if (!record.credential_name) {
                    errors.push({ row: index + 2, voucherCode: record.voucher_code, reason: 'Missing Credential_Name.' });
                    return;
                }
                if (!record.expiry_date || isNaN(new Date(record.expiry_date).getTime())) {
                    errors.push({ row: index + 2, voucherCode: record.voucher_code, reason: 'Invalid or missing Expiry_Date. Use YYYY-MM-DD format.' });
                    return;
                }
                validRecords.push(record);
            });
    
            if (validRecords.length > 0) {
                // Use batch processing for better performance
                const batchSize = 100;
                let processedCount = 0;

                for (let i = 0; i < validRecords.length; i += batchSize) {
                    const batch = validRecords.slice(i, i + batchSize);
                    
                    // Build VALUES clause with parameters
                    const valueClauses = [];
                    const params = [];
                    let paramIndex = 1;

                    batch.forEach(record => {
                        valueClauses.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
                        params.push(record.credential_name);
                        params.push(record.voucher_code);
                        params.push(record.expiry_date);
                        params.push('not assigned'); // status
                    });

                    // Use INSERT ... ON CONFLICT DO NOTHING (equivalent to MERGE WHEN NOT MATCHED)
                    // Assumes voucher_code is the primary key or has a unique constraint
                    const insertQuery = `
                        INSERT INTO ${process.env.LAKEBASE_SCHEMA}.voucher_codes
                            (credential_name, voucher_code, expiry_date, status)
                        VALUES ${valueClauses.join(', ')}
                        ON CONFLICT (voucher_code) DO NOTHING
                    `;
                    
                    const result = await pgClient.query(insertQuery, params);
                    processedCount += batch.length;
                }
                
                console.log(`[Lakebase] Bulk insert complete for vouchers. Processed ${processedCount} records.`);
            }
    
            res.json({
                processed: records.length,
                success: validRecords.length,
                errors: errors,
            });
    
        } catch (err) {
            console.error(`[Error] /api/admin/bulk-upload-vouchers (Lakebase): ${err.message}`);
            if (err.message?.includes('relation') && err.message?.includes('does not exist')) {
                return res.status(500).json({ error: "The voucher system is not available. The required database table `voucher_codes` could not be found." });
            }
            if (err.message?.includes('duplicate key') || err.message?.includes('unique constraint')) {
                // Some vouchers may already exist, which is fine (ON CONFLICT DO NOTHING handles this)
                // But if the error is about the constraint name, we might need to adjust
                console.warn(`[Lakebase] Some voucher codes may already exist. Continuing...`);
            }
            res.status(500).json({ error: "An unexpected server error occurred during the voucher bulk upload." });
        } finally {
            if (pgClient) {
                pgClient.release();
                console.log('[PgPoolManager] Client released for /api/admin/bulk-upload-vouchers.');
            }
        }
    });
};

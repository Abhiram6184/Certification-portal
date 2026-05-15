
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { getPgClientFromPool } from "./lakebase.js";

dotenv.config();

const geminiModel = "gemini-2.5-flash";
const LND_EMAIL = process.env.LND_EMAIL || "bharadwaj.kakrlamudi@gmail.com";
let transporter;

const VOUCHER_EMAIL_TEMPLATES = [
    {
        subject: "Congratulations on Your [Certification Name] Voucher Approval!",
        body: `Dear [Employee Name],\n\n🎉 Congratulations! Your request for the [Certification Name] Certification voucher has been successfully approved. This is a remarkable achievement that reflects your commitment to continuous learning and professional growth.\n\nHere are your voucher details for scheduling your exam:\n\nVoucher ID: [Voucher ID]\n\nPlease use this ID while registering for your exam. We encourage you to book your exam soon and take this next step toward your certification success.\n\nOnce again, well done on this great accomplishment! We’re cheering for you and can’t wait to celebrate your success.\n\nBest regards,\nThe L&D Team`
    },
    {
        subject: "Great Job, [Employee Name]! Your Certification Voucher Is Ready 🎉",
        body: `Hi [Employee Name],\n\nGreat job! Your [Certification Name] certification voucher has been approved and issued.\n\nVoucher ID: [Voucher ID]\n\nYou can now schedule your exam using this voucher ID. This milestone marks your dedication and drive for excellence — truly commendable!\n\nKeep up the amazing work, and don’t forget to share your success story once you earn your certification. We’re proud of your progress!\n\nCheers,\nL&D Support Team`
    },
    {
        subject: "Bravo! Your [Certification Name] Voucher Has Been Approved 🎊",
        body: `Dear [Employee Name],\n\nBravo! Your request for the [Certification Name] certification has been approved, and your voucher is now available.\n\nVoucher ID: [Voucher ID]\n\nPlease use this voucher to register and schedule your certification exam. Your continued pursuit of knowledge and excellence is truly inspiring.\n\nWe wish you all the best as you prepare — you’ve got this! 💪\n\nWarm regards,\nThe Learning & Development Team`
    },
    {
        subject: "Congratulations, [Employee Name] — Your Certification Journey Begins! 🎓",
        body: `Dear [Employee Name],\n\nCongratulations on reaching this exciting stage in your learning journey! Your [Certification Name] certification voucher has been issued and is ready for use.\n\nVoucher ID: [Voucher ID]\n\nPlease use this ID when booking your exam. Take this opportunity to showcase your skills and elevate your professional profile.\n\nWe’re confident you’ll excel and make us proud. Best of luck — and once again, congratulations!\n\nSincerely,\nThe L&D Team`
    },
    {
        subject: "Fantastic News — Your Certification Voucher Has Been Issued! 🎉",
        body: `Hi [Employee Name],\n\nWe have fantastic news! Your request for the [Certification Name] exam voucher has been approved.\n\nVoucher ID: [Voucher ID]\n\nYou can now register for your certification exam using this voucher ID. Well done on taking this proactive step toward advancing your career and skills.\n\nWe’re thrilled to see your enthusiasm for learning and can’t wait to celebrate your success soon! 🥳\n\nKind regards,\nThe L&D Team`
    },
    {
        subject: "Your [Certification Name] Certification Voucher Details - Congratulations!",
        body: `Dear [Employee Name],\n\nWe are thrilled to inform you that your request for the "[Certification Name]" certification has been approved! This is a fantastic step in your professional development, and we are excited to support you in achieving this important milestone. To help you with your next step, we are providing you with your certification exam voucher details.\n\nYour Voucher ID: **[Voucher ID]**\n\nPlease use this ID when you register and schedule your exam. This is the unique identifier for your assigned voucher. We encourage you to schedule your exam at your earliest convenience. We are confident in your abilities and look forward to celebrating your success. Should you have any questions regarding the scheduling process or the exam itself, please don't hesitate to reach out. Congratulations once again on this excellent initiative!\n\nBest regards,\nThe L&D Team`
    }
];

if (process.env.MAIL_USER && process.env.MAIL_PASS) {
    transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // use TLS
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS, // Use an "App Password" for Gmail
        },
    });

    transporter.verify((error, success) => {
        if (error) {
            console.error("❌ Nodemailer: Transporter verification failed.", error);
            if (error.code === 'EAUTH' && error.response?.includes('5.7.8')) {
                console.error("\n[Hint] This is a common Gmail authentication error. If you're using a Gmail account with 2-Factor Authentication, you MUST use a special 'App Password', not your regular password. See the README.md for details.\n");
            }
        } else {
            console.log("✅ Nodemailer: Server is ready to take our messages.");
        }
    });
}

async function sendEmail(subject, recipient, html) {
    if (!transporter) {
        console.warn(`[Email] Nodemailer not configured. Skipping email to ${recipient}.`);
        return false;
    }
    try {
        const mailOptions = {
            from: `"Certification Portal" <${process.env.MAIL_USER}>`,
            to: recipient,
            subject: subject,
            html: html.replace(/\n/g, '<br>'),
            text: html.replace(/<[^>]+>/g, '') // strip HTML for fallback plain text
        };

        let info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent successfully to ${recipient}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send email to ${recipient}: ${error}`);
        return false;
    }
}

async function getFullRequestDetails(pgClient, req_id) {
    const selectQuery = `
        SELECT
            vr.id AS request_id,
            vr.user_id,
            vr.cert_type,
            vr.cert_provider,
            vr.status,
            vr.requested_at AS request_date,
            vr.voucher_id,
            vr.scheduled_at AS exam_date,
            vr.exam_status AS result,
            vr.approved_at,
            vr.rejected_at,
            vr.fulfilled_at,
            vr.personal_email,
            ed.employee_name AS user_name,
            ed.employee_emailid AS user_email
        FROM
            ${process.env.LAKEBASE_SCHEMA}.voucher_requests vr
        LEFT JOIN
            ${process.env.LAKEBASE_SCHEMA}.employeedetails ed ON vr.user_id = ed.emp_code
        WHERE vr.id = $1
    `;
    const result = await pgClient.query(selectQuery, [req_id]);

    if (result.rows.length > 0) {
        return result.rows[0];
    }
    throw new Error(`Could not re-fetch request ${req_id} after update.`);
}


export const registerVoucherRoutes = (app, { getDbClient, sqlValue, ai }) => {
    // THIS ENDPOINT IS MIGRATED TO POSTGRESQL/LAKEBASE
    app.post('/api/request-voucher', async (req, res) => {
        const { name, email, cert_provider, cert_type, personal_email } = req.body;

        let pgClient;
        try {
            console.log(`[Lakebase] /api/request-voucher leasing client for user: ${email}`);
            pgClient = await getPgClientFromPool();

            // Step 1: Find employee by email
            const cleanEmail = email.toLowerCase();
            const employeeQuery = `
                SELECT emp_code
                FROM ${process.env.LAKEBASE_SCHEMA}.employeedetails
                WHERE LOWER(employee_emailid) = $1
            `;
            const employeeResult = await pgClient.query(employeeQuery, [cleanEmail]);

            if (employeeResult.rows.length === 0) {
                return res.status(404).json({ error: `User with email ${email} not found in the Employee Directory. Please register or contact HR.` });
            }

            const userId = employeeResult.rows[0].emp_code;
            console.log(`[Lakebase] Found employee ${email} with emp_code: ${userId}.`);

            // Step 2: Get the next ID manually (to avoid sequence permission issues)
            // Use a transaction to safely get MAX(id) and insert
            let newRequestId;
            const requested_at = new Date().toISOString();

            await pgClient.query('BEGIN');
            try {
                const maxIdQuery = `SELECT COALESCE(MAX(id), 0) as max_id FROM ${process.env.LAKEBASE_SCHEMA}.voucher_requests`;
                const maxIdResult = await pgClient.query(maxIdQuery);
                newRequestId = parseInt(maxIdResult.rows[0].max_id || 0, 10) + 1;

                // Step 3: Insert voucher request with manually generated ID
                const insertQuery = `
                    INSERT INTO ${process.env.LAKEBASE_SCHEMA}.voucher_requests
                        (id, user_id, cert_type, cert_provider, status, requested_at, personal_email)
                    VALUES ($1, $2, $3, $4, 'Pending', $5, $6)
                `;
                await pgClient.query(insertQuery, [
                    newRequestId,
                    userId,
                    cert_type,
                    cert_provider,
                    requested_at,
                    personal_email
                ]);

                await pgClient.query('COMMIT');
                console.log(`[Lakebase] Created voucher request ${newRequestId} for user ${userId}.`);
            } catch (insertErr) {
                await pgClient.query('ROLLBACK');
                throw insertErr;
            }

            if (transporter) {
                try {
                    // L&D notification
                    const mailOptions = {
                        from: `"Certification Portal" <${process.env.MAIL_USER}>`, to: LND_EMAIL,
                        subject: `[New Voucher Request] - ${name}`,
                        html: `<div style="font-family: sans-serif; line-height: 1.6;">
                                <h2 style="color: #333;">New Voucher Request Received</h2>
                                <p>A new voucher request has been submitted through the portal.</p>
                                <div style="background-color: #f7f7f7; border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
                                    <p><strong>Employee Name:</strong> ${name}</p>
                                    <p><strong>Employee Email:</strong> ${email}</p>
                                    ${personal_email ? `<p><strong>Personal Email:</strong> ${personal_email}</p>` : ''}
                                    <p><strong>Certification Provider:</strong> ${cert_provider}</p>
                                    <p><strong>Requested Certification:</strong> ${cert_type}</p>
                                    <p><strong>Request ID:</strong> ${newRequestId}</p>
                                </div><p>Please review this request in the Admin Dashboard.</p></div>`
                    };
                    await transporter.sendMail(mailOptions);
                    console.log(`[Email] Voucher request notification sent to L&D for ${email}.`);

                    // Employee acknowledgment email
                    const acknowledgmentSubject = 'Acknowledgment – Voucher Request Received';
                    const acknowledgmentHtml = `Dear ${name},\n\nWe have received your voucher request for the ${cert_type} certification. Our team will review your request along with your current learning progress and eligibility.\n\nOnce the evaluation is complete, we will get back to you with the next steps.\n\nThank you for your initiative and commitment to continuous learning.\n\nThanks and Regards\nCaTalyst (L&D)\nTransforming Vision into Velocity`;
                    await sendEmail(acknowledgmentSubject, email, acknowledgmentHtml);

                } catch (emailError) {
                    console.error(`[Email] CRITICAL: Failed to send one or more voucher request emails for ${email}.`, emailError);
                }
            } else {
                console.warn(`[Email] Nodemailer is not configured. Skipping email notification for voucher request from ${email}.`);
            }

            const responsePayload = {
                id: newRequestId.toString(),
                user: { id: userId, name: name, role: 'Employee', email: email },
                userId: userId,
                personal_email: personal_email,
                certification: { name: cert_type, vendor: cert_provider },
                requestDate: requested_at,
                status: 'Pending',
            };
            res.status(201).json(responsePayload);

        } catch (err) {
            console.error(`[Error] /api/request-voucher (Lakebase): ${err.message}`);
            const detailedMessage = err.message || 'An unknown database error occurred.';
            if (err.message?.includes('relation') && err.message?.includes('does not exist')) {
                return res.status(500).json({ error: 'The voucher system is not available. The required database table could not be found.' });
            }
            res.status(500).json({ error: `Failed to submit voucher request. Please contact an administrator. (Details: ${detailedMessage})` });
        } finally {
            if (pgClient) {
                pgClient.release();
                console.log('[PgPoolManager] Client released for /api/request-voucher.');
            }
        }
    });

    // THIS ENDPOINT IS MIGRATED TO POSTGRESQL/LAKEBASE
    app.get("/api/admin/all-requests", async (req, res) => {
        let pgClient;
        try {
            console.log('[Lakebase] /api/admin/all-requests leasing client.');
            pgClient = await getPgClientFromPool();

            const query = `
                SELECT
                    vr.id AS request_id, 
                    vr.user_id, 
                    vr.cert_type, 
                    vr.cert_provider, 
                    vr.status,
                    vr.requested_at AS request_date, 
                    vr.voucher_id, 
                    vr.scheduled_at AS exam_date,
                    vr.exam_status AS result, 
                    vr.approved_at, 
                    vr.rejected_at, 
                    vr.fulfilled_at,
                    vr.personal_email, 
                    ed.employee_name AS user_name, 
                    ed.employee_emailid AS user_email
                FROM ${process.env.LAKEBASE_SCHEMA}.voucher_requests vr
                LEFT JOIN ${process.env.LAKEBASE_SCHEMA}.employeedetails ed ON vr.user_id = ed.emp_code
                ORDER BY vr.requested_at DESC
            `;
            const result = await pgClient.query(query);
            res.json(result.rows);
        } catch (err) {
            console.error(`[Error] /api/admin/all-requests (Lakebase): ${err.message}`);
            if (err.message?.includes('relation') && err.message?.includes('does not exist')) {
                console.error("\n[CRITICAL] The 'voucher_requests' table was not found in your PostgreSQL schema.\n");
                return res.json([]);
            }
            res.status(500).json({ error: "Failed to fetch voucher requests." });
        } finally {
            if (pgClient) {
                pgClient.release();
                console.log('[PgPoolManager] Client released for /api/admin/all-requests.');
            }
        }
    });

    app.get("/api/employee/requests/:emp_code", async (req, res) => {
        const { emp_code } = req.params;
        if (!emp_code) return res.status(400).json({ error: "Employee code is required." });

        let pgClient;
        try {
            console.log(`[Lakebase] /api/employee/requests leasing client for emp_code: ${emp_code}`);
            pgClient = await getPgClientFromPool();

            const query = `
                SELECT
                    vr.id AS request_id,
                    vr.user_id,
                    vr.cert_type,
                    vr.cert_provider,
                    vr.status,
                    vr.requested_at AS request_date,
                    vr.voucher_id,
                    vr.scheduled_at AS exam_date,
                    vr.exam_status AS result,
                    vr.approved_at,
                    vr.rejected_at,
                    vr.fulfilled_at,
                    vr.personal_email,
                    ed.employee_name AS user_name,
                    ed.employee_emailid AS user_email
                FROM ${process.env.LAKEBASE_SCHEMA}.voucher_requests vr
                LEFT JOIN ${process.env.LAKEBASE_SCHEMA}.employeedetails ed ON vr.user_id = ed.emp_code
                WHERE vr.user_id = $1
                ORDER BY vr.requested_at DESC
            `;

            const result = await pgClient.query(query, [emp_code]);
            console.log(`[Lakebase] Fetched ${result.rows.length} requests for emp_code ${emp_code}.`);
            res.json(result.rows);

        } catch (err) {
            console.error(`[Error] [Lakebase] Fetch requests for emp_code ${emp_code} failed:`, err);
            res.status(500).json({ error: "Failed to fetch employee requests." });
        } finally {
            if (pgClient) {
                pgClient.release();
                console.log(`[PgPoolManager] Client released for /api/employee/requests/${emp_code}.`);
            }
        }
    });

    app.post('/api/employee/update-request', async (req, res) => {
        const { req_id, updates } = req.body;
        if (!req_id || !updates || typeof updates !== 'object') {
            return res.status(400).json({ error: 'Request ID and updates object are required.' });
        }

        let pgClient;
        try {
            pgClient = await getPgClientFromPool();
            let updateClauses = [];
            let queryParams = [];
            let paramIndex = 1;

            if (updates.examDate) {
                updateClauses.push(`scheduled_at = $${paramIndex++}`);
                queryParams.push(new Date(updates.examDate).toISOString());
            }
            if (updates.status) {
                updateClauses.push(`status = $${paramIndex++}`);
                queryParams.push(updates.status);
            }
            if (updates.result) {
                updateClauses.push(`exam_status = $${paramIndex++}`);
                queryParams.push(updates.result);
            }

            if (updateClauses.length === 0) {
                return res.status(400).json({ error: 'No valid update fields provided.' });
            }

            queryParams.push(req_id);
            const sql = `UPDATE ${process.env.LAKEBASE_SCHEMA}.voucher_requests SET ${updateClauses.join(', ')} WHERE id = $${paramIndex}`;

            await pgClient.query(sql, queryParams);
            console.log(`[Lakebase] Employee updated request ${req_id} with:`, updates);

            const updatedRecord = await getFullRequestDetails(pgClient, req_id);
            res.json(updatedRecord);

        } catch (err) {
            console.error(`[Error] /api/employee/update-request (Lakebase): ${err.message}`);
            res.status(500).json({ error: 'Failed to update request.' });
        } finally {
            if (pgClient) pgClient.release();
        }
    });

    app.post('/api/approve-and-assign', async (req, res) => {
        const { req_id, adminId } = req.body;

        let pgClient;
        try {
            pgClient = await getPgClientFromPool();
            await pgClient.query('BEGIN'); // Start transaction

            const requestQuery = `SELECT cert_type FROM ${process.env.LAKEBASE_SCHEMA}.voucher_requests WHERE id = $1`;
            const reqResult = await pgClient.query(requestQuery, [req_id]);

            if (reqResult.rows.length === 0) {
                await pgClient.query('ROLLBACK');
                return res.status(404).json({ error: "Request not found." });
            }

            const { cert_type } = reqResult.rows[0];

            const voucherQuery = `SELECT voucher_code FROM ${process.env.LAKEBASE_SCHEMA}.voucher_codes WHERE credential_name = $1 AND status = 'not assigned' ORDER BY expiry_date ASC LIMIT 1 FOR UPDATE`;
            const voucherResult = await pgClient.query(voucherQuery, [cert_type]);

            let message;

            if (voucherResult.rows.length > 0) {
                const voucherCode = voucherResult.rows[0].voucher_code;

                const assignVoucherSql = `UPDATE ${process.env.LAKEBASE_SCHEMA}.voucher_codes SET status = 'assigned' WHERE voucher_code = $1`;
                await pgClient.query(assignVoucherSql, [voucherCode]);

                // Try to update with reviewed_by, fallback to without it if column doesn't exist
                // Use SAVEPOINT to allow rollback and retry if reviewed_by column doesn't exist
                await pgClient.query('SAVEPOINT before_fulfill_update');
                try {
                    const fulfillRequestSql = `UPDATE ${process.env.LAKEBASE_SCHEMA}.voucher_requests SET status = 'Fulfilled', voucher_id = $1, approved_at = current_timestamp, fulfilled_at = current_timestamp, reviewed_by = $2 WHERE id = $3`;
                    await pgClient.query(fulfillRequestSql, [voucherCode, adminId, req_id]);
                    await pgClient.query('RELEASE SAVEPOINT before_fulfill_update');
                } catch (reviewedByErr) {
                    // If reviewed_by column doesn't exist, rollback to savepoint and retry without it
                    if (reviewedByErr.message?.includes('column') && reviewedByErr.message?.includes('reviewed_by')) {
                        console.warn('[Lakebase] reviewed_by column not found, updating without it.');
                        await pgClient.query('ROLLBACK TO SAVEPOINT before_fulfill_update');
                        const fulfillRequestSql = `UPDATE ${process.env.LAKEBASE_SCHEMA}.voucher_requests SET status = 'Fulfilled', voucher_id = $1, approved_at = current_timestamp, fulfilled_at = current_timestamp WHERE id = $2`;
                        await pgClient.query(fulfillRequestSql, [voucherCode, req_id]);
                    } else {
                        await pgClient.query('ROLLBACK TO SAVEPOINT before_fulfill_update');
                        throw reviewedByErr; // Re-throw if it's a different error
                    }
                }

                const updatedRequest = await getFullRequestDetails(pgClient, req_id);

                const template = VOUCHER_EMAIL_TEMPLATES[Math.floor(Math.random() * VOUCHER_EMAIL_TEMPLATES.length)];
                const subject = template.subject.replace(/\[Certification Name\]/g, updatedRequest.cert_type);
                const body = template.body.replace(/\[Employee Name\]/g, updatedRequest.user_name).replace(/\[Certification Name\]/g, updatedRequest.cert_type).replace(/\[Voucher ID\]/g, voucherCode);

                const recipients = [updatedRequest.user_email, updatedRequest.personal_email].filter(Boolean);
                if (recipients.length > 0) {
                    await sendEmail(subject, recipients.join(', '), body);
                }

                await pgClient.query('COMMIT');
                message = `Request approved and voucher ${voucherCode} assigned successfully.`;
                res.json({ updatedRequest, message });

            } else {
                // Try to update with reviewed_by, fallback to without it if column doesn't exist
                // Use SAVEPOINT to allow rollback and retry if reviewed_by column doesn't exist
                await pgClient.query('SAVEPOINT before_approve_update');
                try {
                    const approveRequestSql = `UPDATE ${process.env.LAKEBASE_SCHEMA}.voucher_requests SET status = 'Approved', approved_at = current_timestamp, reviewed_by = $1 WHERE id = $2`;
                    await pgClient.query(approveRequestSql, [adminId, req_id]);
                    await pgClient.query('RELEASE SAVEPOINT before_approve_update');
                } catch (reviewedByErr) {
                    // If reviewed_by column doesn't exist, rollback to savepoint and retry without it
                    if (reviewedByErr.message?.includes('column') && reviewedByErr.message?.includes('reviewed_by')) {
                        console.warn('[Lakebase] reviewed_by column not found, updating without it.');
                        await pgClient.query('ROLLBACK TO SAVEPOINT before_approve_update');
                        const approveRequestSql = `UPDATE ${process.env.LAKEBASE_SCHEMA}.voucher_requests SET status = 'Approved', approved_at = current_timestamp WHERE id = $1`;
                        await pgClient.query(approveRequestSql, [req_id]);
                    } else {
                        await pgClient.query('ROLLBACK TO SAVEPOINT before_approve_update');
                        throw reviewedByErr; // Re-throw if it's a different error
                    }
                }

                const updatedRequest = await getFullRequestDetails(pgClient, req_id);
                await pgClient.query('COMMIT');
                message = 'Request approved. No voucher was available for automatic assignment. Please upload vouchers for this certification.';
                res.json({ updatedRequest, message });
            }
        } catch (err) {
            if (pgClient) await pgClient.query('ROLLBACK');
            console.error(`[Error] /api/approve-and-assign (Lakebase): ${err.message}`);
            res.status(500).json({ error: 'Failed to approve and assign voucher.' });
        } finally {
            if (pgClient) pgClient.release();
        }
    });

    app.post('/api/reject-request', async (req, res) => {
        const { req_id, adminId, reason, emailContent } = req.body;

        let pgClient;
        try {
            pgClient = await getPgClientFromPool();
            // Try to update with reviewed_by, fallback to without it if column doesn't exist
            try {
                const sql = `
                    UPDATE ${process.env.LAKEBASE_SCHEMA}.voucher_requests
                    SET status = 'Rejected', rejected_at = current_timestamp, denial_reason = $1, reviewed_by = $2
                    WHERE id = $3
                `;
                await pgClient.query(sql, [reason, adminId, req_id]);
            } catch (reviewedByErr) {
                // If reviewed_by column doesn't exist, update without it
                if (reviewedByErr.message?.includes('column') && reviewedByErr.message?.includes('reviewed_by')) {
                    console.warn('[Lakebase] reviewed_by column not found, updating without it.');
                    const sql = `
                        UPDATE ${process.env.LAKEBASE_SCHEMA}.voucher_requests
                        SET status = 'Rejected', rejected_at = current_timestamp, denial_reason = $1
                        WHERE id = $2
                    `;
                    await pgClient.query(sql, [reason, req_id]);
                } else {
                    throw reviewedByErr; // Re-throw if it's a different error
                }
            }
            const updatedRequest = await getFullRequestDetails(pgClient, req_id);

            if (emailContent) {
                const recipients = [updatedRequest.user_email, updatedRequest.personal_email].filter(Boolean);
                if (recipients.length > 0) {
                    const subject = `Update on your Certification Voucher Request: ${updatedRequest.cert_type}`;
                    await sendEmail(subject, recipients.join(', '), emailContent);
                }
            }
            res.json(updatedRequest);
        } catch (err) {
            console.error(`[Error] /api/reject-request (Lakebase): ${err.message}`);
            res.status(500).json({ error: 'Failed to reject request.' });
        } finally {
            if (pgClient) pgClient.release();
        }
    });

    app.post('/api/generate-approval-email', async (req, res) => {
        const { employeeName, certificationName } = req.body;
        const prompt = `
            Generate a professional and encouraging email to an employee about their approved certification request.
            **Instructions:**
            1. Address the employee by name: ${employeeName}.
            2. Congratulate them on the approval for the "${certificationName}" certification.
            3. Inform them that the L&D team will provide the voucher code and details in a separate email once they are available.
            4. Encourage them to prepare for the exam in the meantime. Sign off as "The L&D Team".
            5. Output plain text only.
        `;
        try {
            const response = await ai.models.generateContent({ model: geminiModel, contents: prompt });
            res.json({ email: response.text });
        } catch (error) {
            res.status(500).json({ error: 'Failed to generate email.' });
        }
    });

    app.post('/api/generate-denial-email', async (req, res) => {
        const { employeeName, certificationName, reason } = req.body;
        const prompt = `
            Generate a professional and polite email to an employee about their denied certification request.
            **Instructions:**
            1. Address the employee by name: ${employeeName}.
            2. Inform them their request for "${certificationName}" has been denied.
            3. State the reason: "${reason}".
            4. Maintain a respectful tone. Sign off as "The L&D Team".
            5. Output plain text only.
        `;
        try {
            const response = await ai.models.generateContent({ model: geminiModel, contents: prompt });
            res.json({ email: response.text });
        } catch (error) {
            res.status(500).json({ error: 'Failed to generate email.' });
        }
    });

    app.post('/api/generate-fulfillment-email', async (req, res) => {
        const { employeeName, certificationName, voucherId } = req.body;
        const prompt = `
            Generate a professional and celebratory email to an employee notifying them that their voucher request has been fulfilled.
            **Instructions:**
            1. Address the employee by name: ${employeeName}.
            2. Congratulate them for the "${certificationName}" certification voucher.
            3. Clearly state the voucher code/ID: ${voucherId}.
            4. Encourage them to schedule their exam soon.
            5. Sign off as "The L&D Team".
            6. Output plain text only.
        `;
        try {
            const response = await ai.models.generateContent({ model: geminiModel, contents: prompt });
            res.json({ email: response.text });
        } catch (error) {
            res.status(500).json({ error: 'Failed to generate fulfillment email.' });
        }
    });
};

# Certification Portal - Quick Reference Cheat Sheet

## 🎯 One-Line Answers to Common Questions

### **Web Scraping**
**Q: How does web scraping work?**  
**A**: Playwright headless browser navigates to Databricks profile, scrolls to load all credentials, extracts titles/dates/IDs, fetches expiry dates from detail pages, stores in DB using MERGE.

### **Email Triggering**
**Q: How are emails triggered?**  
**A**: When request submitted → L&D notification + employee acknowledgment. When approved → Celebratory email with voucher code. Uses Nodemailer with Gmail SMTP (non-blocking).

### **Databricks Connection**
**Q: How do we connect to Databricks?**  
**A**: `@databricks/sql` package → Connect to SQL Warehouse → Open session → Execute SQL → Use MERGE for upserts → Close session.

### **API Keys**
**Q: How are API keys used?**  
**A**: Gemini API key in `.env` for AI extraction. Databricks token for DB access. Gmail App Password for emails. All validated on startup.

### **Token Usage**
**Q: How many tokens per PDF?**  
**A**: ~1000-1500 tokens average (500-2000 input + 50-100 output). Cost: ~$0.0001-0.0002 per extraction. Very cost-effective.

### **LLM Calls**
**Q: How is Gemini called?**  
**A**: `@google/genai` SDK → `gemini-2.5-flash` model → Send base64 file + prompt → Get structured JSON response → Parse and validate.

### **SQL Tables**
**Q: How are tables managed?**  
**A**: `EmployeeDetails` (master), `credentials` (all certs), `voucher_requests` (lifecycle), `voucher_codes` (inventory), `v_credentials` (view with dynamic status).

---

## 🔢 Key Numbers

- **Scraping Time**: 30-60 seconds per profile
- **AI Extraction**: 2-5 seconds per PDF
- **Tokens per PDF**: ~1000-1500
- **Cost per Extraction**: ~$0.0001-0.0002
- **Accuracy**: >95%
- **Email Delivery**: Non-blocking, async
- **Database Queries**: <1 second

---

## 🗄️ Database Schema Quick Reference

```sql
-- EmployeeDetails (Master)
Emp_Code | Employee_Name | Employee_EmailID | Designation

-- credentials (All Certifications)
credential_id | username | emp_code | full_name | credential_title | issued_on | expiry_date

-- voucher_requests (Request Lifecycle)
id | user_id | cert_type | cert_provider | status | requested_at | voucher_id | ...

-- voucher_codes (Inventory)
Credential_Name | Voucher_Code | Expiry_Date | status

-- v_credentials (View - Dynamic Status)
SELECT *, 
  CASE 
    WHEN expiry_date = 'Does not expire' THEN 'Active'
    WHEN CAST(expiry_date AS DATE) >= CURRENT_DATE() THEN 'Active'
    ELSE 'Expired'
  END AS status
FROM credentials
```

---

## 🔄 Key Workflows

### **Voucher Request Flow**
```
Employee Request → DB Insert → Email (L&D + Employee) → Admin Review → 
Approve/Reject → Email to Employee → (If Approved) Auto-assign Voucher
```

### **Credential Upload Flow**
```
Upload File/URL → Base64 Conversion → Gemini AI Extraction → 
Validate Data → MERGE into DB → Return to Employee
```

### **Web Scraping Flow**
```
Profile URL → Playwright Browser → Navigate → Scroll → Extract Tiles → 
Fetch Expiry Dates → MERGE into DB → Return Credentials
```

---

## 📧 Email Templates Summary

1. **L&D Notification**: HTML with request details
2. **Employee Acknowledgment**: Plain text confirmation
3. **Approval Email**: 6 celebration templates (randomly selected)
4. **Rejection Email**: AI-generated professional message

---

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind
- **Backend**: Node.js + Express + Playwright + Nodemailer
- **Database**: Databricks SQL Warehouse (Delta Lake)
- **AI**: Google Gemini Flash (`gemini-2.5-flash`)
- **Email**: Gmail SMTP via Nodemailer

---

## 🔐 Security Measures

- ✅ Email domain validation (@celebaltech.com)
- ✅ Parameterized SQL queries (no injection)
- ✅ API keys in `.env` (not in code)
- ✅ Rate limiting (100 req/15min)
- ✅ Helmet.js security headers
- ✅ CORS configured
- ✅ Error handling (no sensitive data leaks)

---

## 📊 Status Calculation Logic

```javascript
if (expiry_date === 'Does not expire' || expiry_date === null) {
  status = 'Active'
} else if (new Date(expiry_date) >= new Date()) {
  status = 'Active'
} else {
  status = 'Expired'
}
```

---

## 🎯 Demo Talking Points

1. **Business Value**: Standardizes requests, reduces manual work 80%
2. **Innovation**: AI extraction, automated scraping, dynamic status
3. **Scalability**: Handles hundreds of employees, thousands of credentials
4. **Cost-Effective**: Very low operational cost (Gemini Flash)
5. **User-Friendly**: Self-service, real-time tracking, gamification
6. **Automated**: Email notifications, status updates, voucher assignment
7. **Data Export**: CSV downloads for Employee Directory and Credential Directory

---

## 💡 Key Differentiators

1. **AI-Powered**: Automatic certificate extraction from images
2. **Automated Scraping**: Pull credentials from Databricks profiles
3. **Dynamic Status**: Always up-to-date (calculated, not stored)
4. **Self-Service**: Employees can register and upload independently
5. **Gamification**: Leaderboard encourages certification pursuit
6. **Bulk Operations**: CSV uploads for mass data entry
7. **Data Export**: CSV downloads for reporting and analysis

---

## 🚨 Troubleshooting Quick Fixes

**Issue**: Scraping fails  
**Fix**: Check Playwright installation, verify URL format, check browser logs

**Issue**: AI extraction fails  
**Fix**: Verify API key, check file format (PDF/PNG/JPG), review error logs

**Issue**: Emails not sending  
**Fix**: Verify Gmail App Password (not regular password), check SMTP settings

**Issue**: Database connection fails  
**Fix**: Verify Databricks token, check warehouse ID, confirm schema exists

**Issue**: Status shows incorrectly  
**Fix**: Check `v_credentials` view, verify expiry_date format, ensure date comparison logic

---

## 📝 Code Locations Quick Reference

- **Web Scraping**: `backend-scraper/scraper.js`
- **Email Service**: `backend-scraper/voucher.js` → `sendEmail()`
- **AI Extraction**: `backend-scraper/server.js` → `/api/extract-from-file`
- **Database Connection**: `backend-scraper/server.js` → `getDbClient()`
- **Voucher Workflow**: `backend-scraper/voucher.js` → `/api/request-voucher`
- **Bulk Upload**: `backend-scraper/bulkupload.js`
- **Frontend API**: `services/api.ts`
- **Employee View**: `components/EmployeeView.tsx`
- **Admin Dashboard**: `components/Admin.tsx`

---

## 🎤 Presentation Flow

1. **Overview** (2 min) - Purpose, features, value
2. **Employee Demo** (5 min) - Login, view, request, upload
3. **Scraping Demo** (3 min) - Show automated extraction
4. **Admin Demo** (5 min) - Directory, requests, approval
5. **Technical Deep Dive** (5 min) - Architecture, code, flows
6. **Q&A** (5 min) - Address questions

---

**Keep this handy during your presentation! 📋**


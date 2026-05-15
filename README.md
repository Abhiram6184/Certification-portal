
# Employee Certification Portal

A comprehensive portal for employees to view their acquired certifications via live scraping, browse a catalog of available certifications, and request/track new ones.

## Features

- **Employee View:**
  - Live scraping of Databricks credentials.
  - View acquired, available, and requested certifications.
  - Request new certification vouchers.
  - Upload new certificates using AI-powered data extraction (Gemini) from a file or a public URL.
- **Admin View:**
  - Dashboard to view all certification requests.
  - Approve or deny requests with AI-generated email notifications.
  - Assign vouchers to approved requests.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)

## Setup Instructions

Follow these steps to get the project running on your local machine.

1.  **Clone the Repository**
    ```bash
    git clone <repository_url>
    cd <repository_directory>
    ```

2.  **Configure Backend Environment Variables**

    Navigate to the `backend-scraper` directory and create a `.env` file from the example:
    ```bash
    cd backend-scraper
    cp .env.example .env
    cd ..
    ```
    Open `backend-scraper/.env` and fill in your Databricks and Gemini API details. The `API_KEY` is required for all AI features.
    ```env
    PORT=4001
    # Your Google Gemini API Key (required for certificate extraction and email generation)
    API_KEY=your_gemini_api_key_here

    # Databricks connection details
    DATABRICKS_HOST=your_databricks_host
    DATABRICKS_WAREHOUSE_ID=your_warehouse_id
    DATABRICKS_TOKEN=your_databricks_token
    DATABRICKS_SCHEMA=your_schema_name

    # Nodemailer (Gmail) configuration for sending automated emails
    MAIL_USER=your_gmail_address@gmail.com
    MAIL_PASS=your_gmail_app_password
    
    # The email address of the L&D team that receives voucher request notifications
    LND_EMAIL=l&d_team_email@example.com
    ```
    
    > **IMPORTANT: Gmail `MAIL_PASS` Configuration**
    > If you are using a Gmail account with **2-Factor Authentication (2FA) enabled**, you **CANNOT** use your regular account password for `MAIL_PASS`.
    > You must generate a special 16-character **"App Password"** from your Google Account security settings.
    > 
    > *   **How to create an App Password:** [**Follow Google's official guide here**](https://support.google.com/accounts/answer/185833).
    > *   When creating it, select "Mail" as the app and "Windows Computer" (or your OS) as the device.
    > *   Copy the generated 16-character password (without spaces) and paste it as the value for `MAIL_PASS`.
    > 
    > Using your regular password with 2FA will result in an `Invalid login: 535-5.7.8` error.

3.  **Install Dependencies**
    From the root directory, run `npm install` to install dependencies for both the frontend and the backend workspace. This command will also automatically download the necessary web browsers for the Playwright scraping service, which may take a few minutes.
    ```bash
    npm install
    ```

## Running the Application

Once the setup is complete, you can start the development server.

1.  **Start Frontend and Backend**
    Run the `dev` script from the root directory. This will start the Vite frontend server (usually on port 5173) and the Express backend server (on port 4001).
    ```bash
    npm run dev
    ```

2.  **Access the Application**
    Open your web browser and navigate to the URL provided by Vite (e.g., `http://localhost:5173`).

---

## Troubleshooting

If you encounter issues, check the following:

#### **Error: "Unexpected token '<',..." or API calls failing**

-   **Symptom:** When you upload a file or perform an action, you see a JSON parsing error in the browser console. This happens because the frontend expected data from the API but received an HTML page instead.
-   **Solution:** This project uses a Vite proxy to route API calls from the frontend to the backend. This should work automatically when you run `npm run dev`. Ensure both the Vite (frontend) and Node (backend) servers start without errors in your terminal.

#### **Error: "Backend AI service is not configured. API_KEY is missing."**

-   **Symptom:** Trying to upload a certificate fails with a message about the API key.
-   **Solution:** This means the backend server could not find your Gemini API key.
    1.  **Check the Backend Logs:** When you run `npm run dev`, look for the "Backend Configuration Status" output in your terminal. It will explicitly state whether the `API_KEY` was loaded.
    2.  **Verify your `.env` file:**
        -   Ensure the file is named exactly `.env` (not `.env.example` or `.env.txt`).
        -   Make sure it is located inside the `backend-scraper` directory.
        -   Check that the key is spelled correctly: `API_KEY=...`
        -   Make sure you have saved the file after adding your key.
    3.  **Restart the Server:** If you make changes to the `.env` file, you must stop (`Ctrl+C`) and restart the `npm run dev` command for them to take effect.

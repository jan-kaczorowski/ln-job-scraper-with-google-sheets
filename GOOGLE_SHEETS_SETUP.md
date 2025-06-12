# Google Sheets Integration Setup

This guide explains how to set up Google Sheets integration for the LinkedIn Jobs Scraper.

## Prerequisites

1. A Google Cloud Platform account
2. A Google Sheet where you want to store the data
3. Service account credentials

## Setup Steps

### 1. Create a Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click on it and press "Enable"

4. Create a service account:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Give it a name (e.g., "linkedin-scraper")
   - Grant it the role "Basic" > "Editor"
   - Click "Done"

5. Create a key for the service account:
   - Click on the service account you just created
   - Go to the "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose JSON format
   - Save the file as `google_service_account.json` in the project root

### 2. Set up your Google Sheet

1. Create a new Google Sheet or use an existing one
2. Copy the Sheet ID from the URL:
   - The URL looks like: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`
   - Copy the SHEET_ID part

3. Share the sheet with your service account:
   - Open the sheet
   - Click "Share" button
   - Add the service account email (found in your `google_service_account.json` file)
   - Give it "Editor" permission
   - Click "Send"

### 3. Usage

With Docker:
```bash
./run_docker.sh -k "ruby on rails" --google-sheet "YOUR_SHEET_ID"
```

Without Docker:
```bash
node linkedin_scraper_playwright.js -k "ruby on rails" --google-sheet "YOUR_SHEET_ID"
```

### 4. Google Sheet Structure

The scraper will automatically create headers in the first row if they don't exist:
- **created_at**: Timestamp when the job was scraped
- **offer_id**: Unique identifier (format: LN-XXXXXX where X is the LinkedIn job ID)
- **job_title**: Title of the job position
- **company**: Company name
- **url**: Direct link to the job posting (trimmed to format: https://www.linkedin.com/jobs/view/ID/)
- **markdown_content**: Full job description in markdown format
- **status**: Always set to "pending" (you can update this manually)

### 5. Alternative: Application Default Credentials

If you're running this on Google Cloud Platform (GCP), you can use Application Default Credentials instead:

1. Don't create the `google_service_account.json` file
2. Ensure your GCP instance has the Google Sheets API scope
3. The scraper will automatically use the instance's credentials

## Troubleshooting

1. **"Failed to initialize Google Sheets"**
   - Check that `google_service_account.json` exists and is valid
   - Verify the Google Sheets API is enabled

2. **"Error appending to sheet"**
   - Ensure the service account has edit access to the sheet
   - Verify the sheet ID is correct
   - Check that the sheet exists and is not deleted

3. **"Request had insufficient authentication scopes"**
   - The service account needs the `https://www.googleapis.com/auth/spreadsheets` scope
   - This should be automatic with the provided setup

## Data Management Tips

- The scraper always appends new data; it doesn't check for duplicates
- You can add additional columns after column G for your own tracking
- Use Google Sheets filters and sorting to manage the data
- Consider creating a second sheet for processed jobs
- The offer_id column makes it easy to identify and track specific jobs
const { google } = require('googleapis');
const fs = require('fs').promises;

class GoogleSheetsIntegration {
  constructor() {
    this.sheets = null;
    this.auth = null;
  }

  async initialize() {
    try {
      // Try to load service account credentials
      const credsPath = 'google_service_account.json';
      if (await this.fileExists(credsPath)) {
        console.log('Using service account authentication...');
        const creds = JSON.parse(await fs.readFile(credsPath, 'utf8'));
        
        this.auth = new google.auth.GoogleAuth({
          credentials: creds,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
      } else {
        // Try to use Application Default Credentials
        console.log('No service account found, trying Application Default Credentials...');
        this.auth = new google.auth.GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
      }
      
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Sheets:', error.message);
      return false;
    }
  }

  async fileExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async appendToSheet(spreadsheetId, data) {
    try {
      // Get spreadsheet info to find the first sheet
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
      });
      
      const firstSheet = spreadsheet.data.sheets[0];
      const sheetName = firstSheet.properties.title;
      
      console.log(`Appending to sheet: ${sheetName}`);
      
      // Check if headers exist
      const range = `${sheetName}!A1:E1`;
      const existingData = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      
      // If no headers, add them
      if (!existingData.data.values || existingData.data.values.length === 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: 'RAW',
          requestBody: {
            values: [['created_at', 'job_title', 'url', 'markdown_content', 'status']],
          },
        });
      }
      
      // Append data
      const appendRange = `${sheetName}!A:E`;
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: appendRange,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: data,
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('Error appending to sheet:', error.message);
      throw error;
    }
  }

  formatJobForSheet(job) {
    const created_at = new Date().toISOString();
    const { title, url, markdown } = job;
    const status = 'pending';
    
    return [created_at, title, url, markdown, status];
  }
}

module.exports = GoogleSheetsIntegration;
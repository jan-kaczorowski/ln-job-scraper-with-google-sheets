const fs = require('fs').promises;
const path = require('path');
const GoogleSheetsIntegration = require('../google_sheets');

// Import scrapers
const LinkedInScraper = require('./scrapers/linkedin-scraper');
const HiringCafeScraper = require('./scrapers/hiringcafe-scraper');

class ScraperManager {
  constructor(options) {
    this.options = options;
    this.scrapers = {
      linkedin: LinkedInScraper,
      hiringcafe: HiringCafeScraper
    };
  }

  async run() {
    const { site, outputDir, googleSheet } = this.options;
    
    // Validate site
    if (!this.scrapers[site]) {
      throw new Error(`Unknown site: ${site}. Available sites: ${Object.keys(this.scrapers).join(', ')}`);
    }
    
    // Create scraper instance
    const ScraperClass = this.scrapers[site];
    const scraper = new ScraperClass(this.options);
    
    console.log(`Starting ${scraper.siteName} scraper...`);
    console.log('-'.repeat(50));
    
    // Run the scraper
    const jobs = await scraper.scrape(this.options);
    
    if (jobs.length === 0) {
      console.log('No jobs found.');
      return;
    }
    
    console.log(`\nFound ${jobs.length} jobs. Saving...`);
    
    // Save jobs to files
    const savedFiles = [];
    const sheetsData = [];
    
    for (const job of jobs) {
      try {
        const filepath = await scraper.saveToFile(job, outputDir);
        savedFiles.push(filepath);
        
        // Collect data for Google Sheets
        if (googleSheet) {
          sheetsData.push(job);
        }
      } catch (error) {
        console.error(`Error saving job ${job.title}:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`Saved ${savedFiles.length} jobs to ${outputDir}/`);
    
    // Send to Google Sheets if enabled
    if (googleSheet && sheetsData.length > 0) {
      await this.sendToGoogleSheets(scraper, sheetsData, googleSheet);
    }
  }

  async sendToGoogleSheets(scraper, jobs, sheetId) {
    console.log('\nSending data to Google Sheets...');
    const sheets = new GoogleSheetsIntegration();
    
    try {
      const initialized = await sheets.initialize();
      if (initialized) {
        // Format data for sheets using the base scraper method
        const rows = jobs.map(job => scraper.formatForSheets(job));
        
        // Append to sheet
        await sheets.appendToSheet(sheetId, rows);
        console.log(`Successfully sent ${rows.length} jobs to Google Sheet!`);
      } else {
        console.error('Failed to initialize Google Sheets integration');
      }
    } catch (error) {
      console.error('Error sending to Google Sheets:', error.message);
    }
  }
}

module.exports = ScraperManager;
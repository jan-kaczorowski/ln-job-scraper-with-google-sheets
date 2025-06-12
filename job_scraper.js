#!/usr/bin/env node

const { program } = require('commander');
const ScraperManager = require('./src/scraper-manager');

// Parse command line options
program
  .requiredOption('-s, --site <site>', 'Site to scrape (linkedin, hiringcafe)')
  .option('-k, --keywords <keywords>', 'Search keywords')
  .option('-o, --output-dir <dir>', 'Output directory', 'scraped_jobs')
  .option('-n, --max-jobs <number>', 'Maximum number of jobs to scrape', '10')
  .option('--google-sheet <id>', 'Google Sheet ID to send data to')
  .option('--headful', 'Run in headful mode (shows browser)')
  
  // LinkedIn specific options
  .option('--filters <params>', 'LinkedIn filter parameters')
  .option('-t, --time-range <range>', 'LinkedIn time range filter', 'r604800')
  .option('-w, --work-type <type>', 'LinkedIn work type filter', '2')
  .option('--no-active-filter', "Don't filter for active listings only")
  
  // HiringCafe specific options
  .option('-d, --departments <departments>', 'HiringCafe departments (comma-separated)')
  
  .parse();

const options = program.opts();

// Validate required options based on site
async function validateAndRun() {
  const { site, keywords } = options;
  
  // Site-specific validation
  if (site === 'linkedin' && !keywords) {
    console.error('Error: Keywords are required for LinkedIn scraping');
    process.exit(1);
  }
  
  if (site === 'hiringcafe' && !keywords && !options.departments) {
    console.error('Error: Either keywords or departments are required for HiringCafe scraping');
    process.exit(1);
  }
  
  try {
    const manager = new ScraperManager(options);
    await manager.run();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Show help if no arguments
if (process.argv.length === 2) {
  program.help();
}

// Run the scraper
validateAndRun().catch(console.error);
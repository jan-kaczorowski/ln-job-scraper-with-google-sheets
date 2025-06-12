#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');

// Parse command line options
program
  .requiredOption('-k, --keywords <keywords>', 'Search keywords')
  .option('-o, --output-dir <dir>', 'Output directory', 'scraped_jobs')
  .option('--headful', 'Run in headful mode (shows browser)')
  .option('-n, --max-jobs <number>', 'Maximum number of jobs to scrape', '10')
  .option('--no-active-filter', "Don't filter for active listings only")
  .option('-t, --time-range <range>', 'Time range filter', 'r604800')
  .option('-w, --work-type <type>', 'Work type filter', '2')
  .option('--filters <params>', 'Custom filter parameters')
  .parse();

const options = program.opts();

// Load credentials
async function loadCredentials() {
  try {
    const content = await fs.readFile('linkedin_creds.json', 'utf8');
    // Parse the non-standard JSON format
    const match = content.match(/\{username:\s*"([^"]+)",\s*password:\s*"([^"]+)"\}/);
    if (match) {
      return { username: match[1], password: match[2] };
    }
  } catch (error) {
    console.log('Warning: linkedin_creds.json not found or invalid');
  }
  return null;
}

// Sanitize filename
function sanitizeFilename(text) {
  return text.replace(/[<>:"/\\|?*]/g, '').trim().substring(0, 100) || 'untitled';
}

// Format date
function formatDate() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

// Convert HTML to Markdown
function htmlToMarkdown(html) {
  // Remove comments and CDATA
  html = html.replace(/<!--.*?-->/gs, '');
  html = html.replace(/<!\[CDATA\[.*?\]\]>/gs, '');
  
  // Remove unwanted elements
  const unwantedPatterns = [
    /<(script|style|noscript|button|svg|form|input|select|textarea)[^>]*>.*?<\/\1>/gis,
    /<(script|style|noscript|button|svg|form|input|select|textarea)[^>]*\/>/gi,
    /role="button"/gi,
    /class="[^"]*button[^"]*"/gi,
    /class="[^"]*social[^"]*"/gi
  ];
  
  unwantedPatterns.forEach(pattern => {
    html = html.replace(pattern, '');
  });
  
  // Convert specific HTML elements to Markdown
  const conversions = [
    // Headers
    { from: /<h1[^>]*>(.*?)<\/h1>/gi, to: '\n# $1\n' },
    { from: /<h2[^>]*>(.*?)<\/h2>/gi, to: '\n## $1\n' },
    { from: /<h3[^>]*>(.*?)<\/h3>/gi, to: '\n### $1\n' },
    { from: /<h4[^>]*>(.*?)<\/h4>/gi, to: '\n#### $1\n' },
    { from: /<h5[^>]*>(.*?)<\/h5>/gi, to: '\n##### $1\n' },
    { from: /<h6[^>]*>(.*?)<\/h6>/gi, to: '\n###### $1\n' },
    
    // Text formatting
    { from: /<(strong|b)[^>]*>(.*?)<\/\1>/gi, to: '**$2**' },
    { from: /<(em|i)[^>]*>(.*?)<\/\1>/gi, to: '*$2*' },
    { from: /<code[^>]*>(.*?)<\/code>/gi, to: '`$1`' },
    { from: /<pre[^>]*>(.*?)<\/pre>/gis, to: '\n```\n$1\n```\n' },
    
    // Lists
    { from: /<li[^>]*>(.*?)<\/li>/gi, to: '- $1\n' },
    { from: /<ul[^>]*>/gi, to: '\n' },
    { from: /<\/ul>/gi, to: '\n' },
    { from: /<ol[^>]*>/gi, to: '\n' },
    { from: /<\/ol>/gi, to: '\n' },
    
    // Paragraphs and breaks
    { from: /<p[^>]*>(.*?)<\/p>/gi, to: '\n$1\n' },
    { from: /<br[^>]*>/gi, to: '\n' },
    { from: /<hr[^>]*>/gi, to: '\n---\n' },
    
    // Links
    { from: /<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, to: '[$2]($1)' },
    
    // Images
    { from: /<img[^>]+alt="([^"]+)"[^>]+src="([^"]+)"[^>]*>/gi, to: '![$1]($2)' },
    { from: /<img[^>]+src="([^"]+)"[^>]+alt="([^"]+)"[^>]*>/gi, to: '![$2]($1)' },
    { from: /<img[^>]+src="([^"]+)"[^>]*>/gi, to: '![Image]($1)' },
    
    // Remove remaining tags
    { from: /<[^>]+>/g, to: '' }
  ];
  
  conversions.forEach(({ from, to }) => {
    html = html.replace(from, to);
  });
  
  // Clean up multiple blank lines
  html = html.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // Decode HTML entities
  html = html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  
  return html.trim();
}

// Main scraping function
async function scrapeLinkedIn() {
  console.log('LinkedIn Jobs Scraper (Playwright)');
  console.log('Keywords:', options.keywords);
  console.log('Output directory:', options.outputDir);
  console.log('Max jobs:', options.maxJobs);
  console.log('-'.repeat(50));
  
  // Create output directory
  await fs.mkdir(options.outputDir, { recursive: true });
  
  // Load credentials
  const credentials = await loadCredentials();
  
  // Launch browser
  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: !options.headful,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    // Login if credentials available
    if (credentials) {
      console.log('Logging in to LinkedIn...');
      
      // Go to main page first
      await page.goto('https://www.linkedin.com');
      await page.waitForTimeout(2000);
      
      // Go to login page
      await page.goto('https://www.linkedin.com/login');
      
      // Fill login form
      await page.fill('input[name="session_key"]', credentials.username);
      await page.fill('input[name="session_password"]', credentials.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
      
      // Check if login successful
      if (page.url().includes('/login')) {
        console.log('Login failed - check credentials');
      } else {
        console.log('Login successful!');
      }
    } else {
      console.log('No credentials found - proceeding without login');
    }
    
    // Build search URL
    const encodedKeywords = encodeURIComponent(options.keywords);
    let url = `https://www.linkedin.com/jobs/search/?keywords=${encodedKeywords}&geoId=91000000`;
    
    if (options.filters) {
      url += `&${options.filters}`;
    } else {
      if (options.activeFilter !== false) url += '&f_AL=true';
      if (options.timeRange) url += `&f_TPR=${options.timeRange}`;
      if (options.workType) url += `&f_WT=${options.workType}`;
    }
    
    url += '&origin=JOB_SEARCH_PAGE_JOB_FILTER&refresh=true';
    
    console.log('Navigating to:', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for job listings
    console.log('Waiting for job listings...');
    await page.waitForTimeout(5000);
    
    // Try to dismiss popups
    try {
      await page.click('button[aria-label="Dismiss"]', { timeout: 2000 });
    } catch (e) {
      // Popup might not exist
    }
    
    // Find job links with multiple strategies
    let jobLinks = [];
    const selectors = [
      '.job-card-container__link',
      'a[data-tracking-control-name*="jobcard"]',
      '.jobs-search-results__list-item a',
      'div[data-job-id] a'
    ];
    
    for (const selector of selectors) {
      jobLinks = await page.$$(selector);
      if (jobLinks.length > 0) {
        console.log(`Found jobs using selector: ${selector}`);
        break;
      }
    }
    
    if (jobLinks.length === 0) {
      console.log('No job links found. Trying to wait for dynamic content...');
      try {
        await page.waitForSelector('.job-card-container__link', { timeout: 10000 });
        jobLinks = await page.$$('.job-card-container__link');
      } catch (e) {
        console.log('Still no job links found after waiting');
      }
    }
    
    console.log(`Found ${jobLinks.length} job listings`);
    
    const maxJobs = Math.min(jobLinks.length, parseInt(options.maxJobs));
    const savedJobs = [];
    
    for (let i = 0; i < maxJobs; i++) {
      try {
        console.log(`\nProcessing job ${i + 1}/${maxJobs}`);
        
        // Re-find job links to avoid stale references
        jobLinks = await page.$$('.job-card-container__link');
        if (i >= jobLinks.length) break;
        
        // Click job link
        await jobLinks[i].click();
        
        // Wait for details to load
        await page.waitForSelector('div.jobs-search__job-details--wrapper', { timeout: 10000 });
        await page.waitForTimeout(2000);
        
        // Get job details
        const jobDetails = await page.$('div.jobs-search__job-details--wrapper');
        if (!jobDetails) {
          console.log(`Could not find details for job ${i + 1}`);
          continue;
        }
        
        // Get job title
        let jobTitle = `job_${i + 1}`;
        const titleElement = await jobDetails.$('h1');
        if (titleElement) {
          jobTitle = await titleElement.textContent();
        }
        
        console.log('Job title:', jobTitle.trim());
        
        // Get HTML content
        const jobHtml = await jobDetails.innerHTML();
        
        // Convert to Markdown
        const markdown = htmlToMarkdown(jobHtml);
        
        // Save to file
        const filename = `${sanitizeFilename(jobTitle)}_${formatDate()}.md`;
        const filepath = path.join(options.outputDir, filename);
        
        const content = `# ${jobTitle.trim()}\n\n` +
          `*Scraped on: ${new Date().toLocaleString()}*\n\n` +
          `*Keywords: ${options.keywords}*\n\n` +
          `---\n\n` +
          markdown;
        
        await fs.writeFile(filepath, content, 'utf8');
        console.log('Saved to:', filepath);
        savedJobs.push(filepath);
        
        // Small delay between jobs
        await page.waitForTimeout(1000);
        
      } catch (error) {
        console.error(`Error processing job ${i + 1}:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`Scraping completed! Saved ${savedJobs.length} jobs to ${options.outputDir}/`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await browser.close();
  }
}

// Run the scraper
scrapeLinkedIn().catch(console.error);
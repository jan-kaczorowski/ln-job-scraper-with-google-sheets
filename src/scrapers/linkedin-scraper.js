const { chromium } = require('playwright');
const BaseScraper = require('./base-scraper');

class LinkedInScraper extends BaseScraper {
  constructor(options) {
    super(options);
    this.siteName = 'LinkedIn';
    this.sitePrefix = 'LN';
    this.credentials = null;
  }

  async initialize() {
    // Load LinkedIn credentials
    try {
      const fs = require('fs').promises;
      const content = await fs.readFile('linkedin_creds.json', 'utf8');
      const match = content.match(/\{username:\s*"([^"]+)",\s*password:\s*"([^"]+)"\}/);
      if (match) {
        this.credentials = { username: match[1], password: match[2] };
      }
    } catch (error) {
      console.log('Warning: linkedin_creds.json not found or invalid');
    }
  }

  async login(page) {
    if (!this.credentials) return false;
    
    console.log('Logging in to LinkedIn...');
    
    // Go to main page first
    await page.goto('https://www.linkedin.com');
    await page.waitForTimeout(2000);
    
    // Go to login page
    await page.goto('https://www.linkedin.com/login');
    
    // Fill login form
    await page.fill('input[name="session_key"]', this.credentials.username);
    await page.fill('input[name="session_password"]', this.credentials.password);
    
    // Submit form
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Check if login successful
    if (page.url().includes('/login')) {
      console.log('Login failed - check credentials');
      return false;
    }
    
    console.log('Login successful!');
    return true;
  }

  buildSearchUrl(params) {
    const { keywords, filters } = params;
    const encodedKeywords = encodeURIComponent(keywords);
    let url = `https://www.linkedin.com/jobs/search/?keywords=${encodedKeywords}&geoId=91000000`;
    
    if (filters) {
      url += `&${filters}`;
    } else {
      // Default filters
      url += '&f_AL=true&f_TPR=r604800&f_WT=2';
    }
    
    url += '&origin=JOB_SEARCH_PAGE_JOB_FILTER&refresh=true';
    return url;
  }

  htmlToMarkdown(html) {
    // Remove HTML comments and CDATA sections
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
    
    // Convert HTML elements to Markdown
    const conversions = [
      { from: /<h1[^>]*>(.*?)<\/h1>/gi, to: '\n# $1\n' },
      { from: /<h2[^>]*>(.*?)<\/h2>/gi, to: '\n## $1\n' },
      { from: /<h3[^>]*>(.*?)<\/h3>/gi, to: '\n### $1\n' },
      { from: /<h4[^>]*>(.*?)<\/h4>/gi, to: '\n#### $1\n' },
      { from: /<(strong|b)[^>]*>(.*?)<\/\1>/gi, to: '**$2**' },
      { from: /<(em|i)[^>]*>(.*?)<\/\1>/gi, to: '*$2*' },
      { from: /<li[^>]*>(.*?)<\/li>/gi, to: '- $1\n' },
      { from: /<p[^>]*>(.*?)<\/p>/gi, to: '\n$1\n' },
      { from: /<br[^>]*>/gi, to: '\n' },
      { from: /<hr[^>]*>/gi, to: '\n---\n' },
      { from: /<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, to: '[$2]($1)' },
      { from: /<[^>]+>/g, to: '' }
    ];
    
    conversions.forEach(({ from, to }) => {
      html = html.replace(from, to);
    });
    
    // Clean up
    html = html.replace(/\n\s*\n\s*\n/g, '\n\n');
    html = html
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
    
    return html.trim();
  }

  async scrape(params) {
    await this.initialize();
    
    const browser = await chromium.launch({
      headless: !this.options.headful,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const jobs = [];
    
    try {
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      
      const page = await context.newPage();
      
      // Login if credentials available
      if (this.credentials) {
        await this.login(page);
      }
      
      // Navigate to search page
      const url = this.buildSearchUrl(params);
      console.log('Navigating to:', url);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(5000);
      
      // Find job links
      let jobLinks = await page.$$('.job-card-container__link');
      if (!jobLinks.length) {
        jobLinks = await page.$$('a[data-tracking-control-name*="jobcard"]');
      }
      
      console.log(`Found ${jobLinks.length} job listings`);
      
      const maxJobs = Math.min(jobLinks.length, parseInt(params.maxJobs || 10));
      
      for (let i = 0; i < maxJobs; i++) {
        try {
          console.log(`Processing job ${i + 1}/${maxJobs}`);
          
          // Re-find links to avoid stale references
          jobLinks = await page.$$('.job-card-container__link');
          if (i >= jobLinks.length) break;
          
          // Get URL before clicking
          let jobUrl = await jobLinks[i].getAttribute('href');
          if (jobUrl && !jobUrl.startsWith('http')) {
            jobUrl = 'https://www.linkedin.com' + jobUrl;
          }
          
          // Click job
          await jobLinks[i].click();
          await page.waitForSelector('div.jobs-search__job-details--wrapper', { timeout: 10000 });
          await page.waitForTimeout(2000);
          
          // Get current URL and extract job ID
          const currentUrl = page.url();
          let jobId = '';
          const jobIdMatch = currentUrl.match(/\/jobs\/view\/(\d+)/);
          if (jobIdMatch) {
            jobId = jobIdMatch[1];
            jobUrl = `https://www.linkedin.com/jobs/view/${jobId}/`;
          }
          
          // Get job details
          const jobDetails = await page.$('div.jobs-search__job-details--wrapper');
          if (!jobDetails) continue;
          
          // Extract title
          let title = `job_${i + 1}`;
          const titleElement = await jobDetails.$('h1');
          if (titleElement) {
            title = await titleElement.textContent();
          }
          
          // Extract company
          let company = '';
          try {
            const companyElement = await jobDetails.$('div.job-details-jobs-unified-top-card__company-name > a') ||
                                  await jobDetails.$('div.job-details-jobs-unified-top-card__company-name');
            if (companyElement) {
              company = await companyElement.textContent();
              company = company.trim();
            }
          } catch (e) {
            console.log('Could not extract company name');
          }
          
          // Get HTML and convert to markdown
          const jobHtml = await jobDetails.innerHTML();
          const description = this.htmlToMarkdown(jobHtml);
          
          jobs.push({
            title: title.trim(),
            company: company || 'N/A',
            url: jobUrl,
            offerId: this.generateOfferId(jobId),
            description
          });
          
          await page.waitForTimeout(1000);
          
        } catch (error) {
          console.error(`Error processing job ${i + 1}:`, error.message);
        }
      }
      
    } catch (error) {
      console.error('Fatal error:', error);
    } finally {
      await browser.close();
    }
    
    return jobs;
  }
}

module.exports = LinkedInScraper;
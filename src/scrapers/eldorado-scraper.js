const { chromium } = require('playwright');
const BaseScraper = require('./base-scraper');

class EldoradoScraper extends BaseScraper {
  constructor(options) {
    super(options);
    this.siteName = 'Eldorado';
    this.sitePrefix = 'ED';
    this.baseUrl = 'https://czyjesteldorado.pl';
  }

  buildSearchUrl(params) {
    const { keywords } = params;
    const query = encodeURIComponent(keywords || '');
    return `${this.baseUrl}/search?q=${query}&sort=relevance&exact=0`;
  }

  htmlToMarkdown(html) {
    // Remove comments and unwanted content
    html = html.replace(/<!--.*?-->/gs, '');
    html = html.replace(/<!\[CDATA\[.*?\]\]>/gs, '');
    
    // Remove unwanted elements
    const unwantedPatterns = [
      /<(script|style|noscript|button|svg|form|input|select|textarea)[^>]*>.*?<\/\1>/gis,
      /<(script|style|noscript|button|svg|form|input|select|textarea)[^>]*\/>/gi,
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
      { from: /<ul[^>]*>/gi, to: '\n' },
      { from: /<\/ul>/gi, to: '\n' },
      { from: /<ol[^>]*>/gi, to: '\n' },
      { from: /<\/ol>/gi, to: '\n' },
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

  extractJobIdFromUrl(url) {
    // Extract job ID from Eldorado URL
    // Example: https://czyjesteldorado.pl/offer/12345/job-title
    const match = url.match(/\/offer\/(\d+)/);
    return match ? match[1] : url.split('/').filter(p => p).pop();
  }

  async scrape(params) {
    const browser = await chromium.launch({
      headless: !this.options.headful,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const jobs = [];
    
    try {
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'pl-PL'
      });
      
      const page = await context.newPage();
      
      // Navigate to search page
      const url = this.buildSearchUrl(params);
      console.log('Navigating to:', url);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);
      
      // Wait for job listings
      console.log('Waiting for job listings...');
      await page.waitForSelector('div.offer-list', { timeout: 30000 });
      
      // Find all offer rows
      const offerRows = await page.$$('div.offer-list div.offer-row');
      console.log(`Found ${offerRows.length} job listings`);
      
      const maxJobs = Math.min(offerRows.length, parseInt(params.maxJobs || 10));
      
      // First, collect all job URLs and basic info
      const jobLinks = [];
      for (let i = 0; i < maxJobs; i++) {
        try {
          const row = offerRows[i];
          
          // Get the href attribute from the div
          const href = await row.getAttribute('href');
          if (!href) continue;
          
          // Build full URL
          const jobUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
          
          // Try to get job title from the row
          let title = `job_${i + 1}`;
          try {
            const titleElement = await row.$('h2, h3, .job-title, .offer-title, [class*="title"]');
            if (titleElement) {
              title = await titleElement.textContent();
              title = title.trim();
            }
          } catch (e) {
            console.log('Could not extract title from row');
          }
          
          // Try to get company name from the row
          let company = '';
          try {
            const companyElement = await row.$('.company-name, .employer, [class*="company"]');
            if (companyElement) {
              company = await companyElement.textContent();
              company = company.trim();
            }
          } catch (e) {
            console.log('Could not extract company from row');
          }
          
          jobLinks.push({ url: jobUrl, title, company });
          
        } catch (error) {
          console.error(`Error collecting job link ${i + 1}:`, error.message);
        }
      }
      
      // Now visit each job page
      for (let i = 0; i < jobLinks.length; i++) {
        try {
          const { url: jobUrl, title: initialTitle, company: initialCompany } = jobLinks[i];
          console.log(`\nProcessing job ${i + 1}/${jobLinks.length}: ${jobUrl}`);
          
          // Navigate to job detail page
          await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(2000);
          
          // Wait for job details
          await page.waitForSelector('div.col-12', { timeout: 10000 });
          
          // Get job details
          const jobDetails = await page.$('div.col-12');
          if (!jobDetails) {
            console.log('Could not find job details');
            continue;
          }
          
          // Try to get better title from detail page
          let title = initialTitle;
          try {
            const titleElement = await page.$('h1, h2.job-title, .offer-title');
            if (titleElement) {
              const detailTitle = await titleElement.textContent();
              if (detailTitle) title = detailTitle.trim();
            }
          } catch (e) {
            console.log('Using title from listing');
          }
          
          // Try to get company from detail page if not found earlier
          let company = initialCompany;
          if (!company) {
            try {
              const companyElement = await page.$('.company-name, .employer-name, [class*="company"]');
              if (companyElement) {
                company = await companyElement.textContent();
                company = company.trim();
              }
            } catch (e) {
              console.log('Could not extract company name');
            }
          }
          
          // Get HTML content and convert to markdown
          const jobHtml = await jobDetails.innerHTML();
          const description = this.htmlToMarkdown(jobHtml);
          
          // Extract job ID from URL
          const jobId = this.extractJobIdFromUrl(jobUrl);
          
          jobs.push({
            title: title || `Job ${i + 1}`,
            company: company || 'N/A',
            url: jobUrl,
            offerId: this.generateOfferId(jobId),
            description
          });
          
          // Small delay between jobs
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

module.exports = EldoradoScraper;
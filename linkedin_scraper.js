#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const TurndownService = require('turndown');

// Initialize markdown converter
const turndownService = new TurndownService();

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Usage: node linkedin_scraper.js "search keywords"');
    process.exit(1);
}

const keywords = args[0];
const outputDir = args[1] || 'scraped_jobs';

// Sanitize filename
function sanitizeFilename(text) {
    return text.replace(/[<>:"/\\|?*]/g, '').trim().substring(0, 100) || 'untitled';
}

// Format date
function formatDate() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

async function scrapeLinkedInJobs() {
    console.log('Starting LinkedIn job scraper...');
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    // Launch browser
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Build URL
        const encodedKeywords = encodeURIComponent(keywords);
        const url = `https://www.linkedin.com/jobs/search/?currentJobId=4230610778&geoId=91000000&keywords=${encodedKeywords}&origin=JOB_SEARCH_PAGE_JOB_FILTER&refresh=true`;
        
        console.log(`Navigating to: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Wait a bit for dynamic content
        await page.waitForTimeout(5000);
        
        // Try to dismiss any popups
        try {
            await page.click('button[aria-label="Dismiss"]');
            await page.waitForTimeout(1000);
        } catch (e) {
            // Popup might not exist
        }
        
        // Wait for job listings
        console.log('Waiting for job listings...');
        await page.waitForSelector('.job-card-container__link', { timeout: 30000 });
        
        // Get all job links
        const jobLinks = await page.$$('.job-card-container__link');
        console.log(`Found ${jobLinks.length} job listings`);
        
        const savedJobs = [];
        const maxJobs = Math.min(jobLinks.length, 10); // Limit to 10 jobs
        
        for (let i = 0; i < maxJobs; i++) {
            try {
                console.log(`Processing job ${i + 1}/${maxJobs}`);
                
                // Click on job link
                await jobLinks[i].click();
                
                // Wait for job details to load
                await page.waitForSelector('div.jobs-search__job-details--wrapper', { timeout: 10000 });
                await page.waitForTimeout(2000); // Let content fully load
                
                // Get job details
                const jobDetails = await page.$('div.jobs-search__job-details--wrapper');
                if (!jobDetails) {
                    console.log(`Could not find details for job ${i + 1}`);
                    continue;
                }
                
                // Get job title
                let jobTitle = `job_${i + 1}`;
                try {
                    const titleElement = await jobDetails.$('h1');
                    if (titleElement) {
                        jobTitle = await titleElement.evaluate(el => el.textContent.trim());
                    }
                } catch (e) {
                    console.log('Could not extract job title');
                }
                
                // Get HTML content
                const jobHtml = await jobDetails.evaluate(el => el.innerHTML);
                
                // Convert to markdown
                const markdown = turndownService.turndown(jobHtml);
                
                // Save to file
                const filename = `${sanitizeFilename(jobTitle)}_${formatDate()}.md`;
                const filepath = path.join(outputDir, filename);
                
                const content = `# ${jobTitle}\n\n` +
                    `*Scraped on: ${new Date().toLocaleString()}*\n\n` +
                    `*Keywords: ${keywords}*\n\n` +
                    `---\n\n` +
                    markdown;
                
                await fs.writeFile(filepath, content, 'utf8');
                console.log(`Saved: ${filepath}`);
                savedJobs.push(filepath);
                
                // Small delay between jobs
                await page.waitForTimeout(1000);
                
            } catch (error) {
                console.error(`Error processing job ${i + 1}:`, error.message);
            }
        }
        
        console.log(`\nScraping completed! Saved ${savedJobs.length} jobs to ${outputDir}/`);
        
    } catch (error) {
        console.error('Fatal error:', error);
    } finally {
        await browser.close();
    }
}

// Run the scraper
scrapeLinkedInJobs().catch(console.error);
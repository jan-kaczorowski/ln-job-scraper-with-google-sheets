#!/usr/bin/env python3
"""
LinkedIn Jobs Scraper using Playwright
Scrapes job listings from LinkedIn and saves them as markdown files
"""

import asyncio
import argparse
import logging
import os
from datetime import datetime
from urllib.parse import quote
from pathlib import Path
import re
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
from markdownify import markdownify as md

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class LinkedInJobsScraper:
    def __init__(self, keywords, output_dir="scraped_jobs"):
        self.keywords = keywords
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.base_url = "https://www.linkedin.com/jobs/search/"
        
    def build_url(self):
        """Build the LinkedIn jobs search URL with encoded keywords"""
        encoded_keywords = quote(self.keywords)
        return f"{self.base_url}?currentJobId=4230610778&geoId=91000000&keywords={encoded_keywords}&origin=JOB_SEARCH_PAGE_JOB_FILTER&refresh=true"
    
    def sanitize_filename(self, text):
        """Sanitize text to be used as a filename"""
        # Remove special characters and limit length
        text = re.sub(r'[<>:"/\\|?*]', '', text)
        text = text.strip()[:100]  # Limit to 100 chars
        return text or "untitled"
    
    async def scrape_jobs(self):
        """Main scraping function"""
        logger.info("Starting Playwright...")
        
        playwright = await async_playwright().start()
        
        try:
            logger.info("Launching browser...")
            # Launch browser
            browser = await playwright.chromium.launch(
                headless=False,  # Set to True for headless mode
                args=['--disable-blink-features=AutomationControlled']
            )
            
            # Create page directly from browser
            page = await browser.new_page()
            
            # Set viewport
            await page.set_viewport_size({"width": 1920, "height": 1080})
            
            # Navigate to LinkedIn jobs page
            url = self.build_url()
            logger.info(f"Navigating to: {url}")
            
            try:
                await page.goto(url, wait_until='domcontentloaded', timeout=60000)
            except Exception as e:
                logger.error(f"Failed to navigate to URL: {e}")
                await browser.close()
                await playwright.stop()
                return
            
            # Wait for page to stabilize
            await asyncio.sleep(5)
            
            # Check if we need to handle any popups or login prompts
            try:
                # Try to close any popups
                close_button = await page.query_selector('button[aria-label="Dismiss"]')
                if close_button:
                    await close_button.click()
                    await asyncio.sleep(1)
            except:
                pass
            
            # Wait for job listings to load
            job_links = []
            try:
                await page.wait_for_selector('.job-card-container__link', timeout=30000)
                job_links = await page.query_selector_all('.job-card-container__link')
            except PlaywrightTimeout:
                logger.warning("Primary selector not found, trying alternatives...")
                # Try alternative selectors
                selectors = [
                    'a[data-tracking-control-name="public_jobs_jserp-result_search-card"]',
                    '.jobs-search-results__list-item a',
                    '.job-card-list__title'
                ]
                
                for selector in selectors:
                    try:
                        await page.wait_for_selector(selector, timeout=10000)
                        job_links = await page.query_selector_all(selector)
                        if job_links:
                            logger.info(f"Found jobs using selector: {selector}")
                            break
                    except:
                        continue
            
            if not job_links:
                logger.error("No job listings found. The page structure might have changed.")
                await browser.close()
                await playwright.stop()
                return
            
            logger.info(f"Found {len(job_links)} job listings")
            
            scraped_jobs = []
            
            for index, link in enumerate(job_links[:10]):  # Limit to first 10 jobs for testing
                try:
                    logger.info(f"Processing job {index + 1}/{min(len(job_links), 10)}")
                    
                    # Click the job link
                    await link.click()
                    
                    # Wait for job details to load
                    details_loaded = False
                    details_selectors = [
                        'div.jobs-search__job-details--wrapper',
                        'section.jobs-search__job-details',
                        'div[data-job-details-container]'
                    ]
                    
                    job_details = None
                    for selector in details_selectors:
                        try:
                            await page.wait_for_selector(selector, timeout=5000)
                            job_details = await page.query_selector(selector)
                            if job_details:
                                details_loaded = True
                                break
                        except:
                            continue
                    
                    if not details_loaded or not job_details:
                        logger.warning(f"Could not load details for job {index + 1}")
                        continue
                    
                    # Give it a moment to fully load
                    await asyncio.sleep(2)
                    
                    # Get the job details HTML
                    job_html = await job_details.inner_html()
                    
                    # Get job title for filename
                    job_title = f"job_{index + 1}"
                    title_selectors = ['h1', 'h2.jobs-unified-top-card__job-title', '.jobs-unified-top-card__job-title']
                    
                    for selector in title_selectors:
                        job_title_element = await job_details.query_selector(selector)
                        if job_title_element:
                            try:
                                job_title = await job_title_element.inner_text()
                                break
                            except:
                                continue
                    
                    # Convert HTML to Markdown
                    markdown_content = md(job_html, heading_style="ATX")
                    
                    # Save to file
                    filename = f"{self.sanitize_filename(job_title)}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
                    filepath = self.output_dir / filename
                    
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(f"# {job_title}\n\n")
                        f.write(f"*Scraped on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*\n\n")
                        f.write(f"*Keywords: {self.keywords}*\n\n")
                        f.write("---\n\n")
                        f.write(markdown_content)
                    
                    logger.info(f"Saved job to: {filepath}")
                    scraped_jobs.append(str(filepath))
                    
                    # Small delay between jobs to avoid being too aggressive
                    await asyncio.sleep(1)
                    
                except Exception as e:
                    logger.error(f"Error processing job {index + 1}: {str(e)}")
                    continue
            
            logger.info(f"Scraping completed. Saved {len(scraped_jobs)} jobs to {self.output_dir}")
            
            # Close browser
            await browser.close()
            
        except Exception as e:
            logger.error(f"Critical error during scraping: {str(e)}")
        finally:
            await playwright.stop()


async def main():
    parser = argparse.ArgumentParser(description='Scrape LinkedIn jobs and save as markdown files')
    parser.add_argument('keywords', type=str, help='Job search keywords (e.g., "ruby on rails")')
    parser.add_argument('--output-dir', type=str, default='scraped_jobs', 
                       help='Output directory for markdown files (default: scraped_jobs)')
    
    args = parser.parse_args()
    
    scraper = LinkedInJobsScraper(args.keywords, args.output_dir)
    await scraper.scrape_jobs()


if __name__ == "__main__":
    asyncio.run(main())
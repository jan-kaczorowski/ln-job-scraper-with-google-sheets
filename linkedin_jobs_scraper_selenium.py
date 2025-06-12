#!/usr/bin/env python3
"""
LinkedIn Jobs Scraper using Selenium
Scrapes job listings from LinkedIn and saves them as markdown files
"""

import time
import argparse
import logging
import os
from datetime import datetime
from urllib.parse import quote
from pathlib import Path
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
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
    
    def scrape_jobs(self):
        """Main scraping function"""
        logger.info("Setting up Chrome driver...")
        
        # Setup Chrome options
        chrome_options = webdriver.ChromeOptions()
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # Create driver
        driver = webdriver.Chrome(options=chrome_options)
        driver.set_window_size(1920, 1080)
        
        try:
            # Navigate to LinkedIn jobs page
            url = self.build_url()
            logger.info(f"Navigating to: {url}")
            driver.get(url)
            
            # Wait for page to load
            time.sleep(5)
            
            # Try to close any popups
            try:
                dismiss_button = driver.find_element(By.XPATH, "//button[@aria-label='Dismiss']")
                dismiss_button.click()
                time.sleep(1)
            except:
                pass
            
            # Wait for job listings to load
            job_links = []
            try:
                WebDriverWait(driver, 30).until(
                    EC.presence_of_element_located((By.CLASS_NAME, "job-card-container__link"))
                )
                job_links = driver.find_elements(By.CLASS_NAME, "job-card-container__link")
            except TimeoutException:
                logger.warning("Primary selector not found, trying alternatives...")
                # Try alternative selectors
                selectors = [
                    (By.CSS_SELECTOR, 'a[data-tracking-control-name="public_jobs_jserp-result_search-card"]'),
                    (By.CSS_SELECTOR, '.jobs-search-results__list-item a'),
                    (By.CSS_SELECTOR, '.job-card-list__title')
                ]
                
                for by_type, selector in selectors:
                    try:
                        WebDriverWait(driver, 10).until(
                            EC.presence_of_element_located((by_type, selector))
                        )
                        job_links = driver.find_elements(by_type, selector)
                        if job_links:
                            logger.info(f"Found jobs using selector: {selector}")
                            break
                    except:
                        continue
            
            if not job_links:
                logger.error("No job listings found. The page structure might have changed.")
                return
            
            logger.info(f"Found {len(job_links)} job listings")
            
            scraped_jobs = []
            
            for index in range(min(len(job_links), 10)):  # Limit to first 10 jobs
                try:
                    logger.info(f"Processing job {index + 1}/{min(len(job_links), 10)}")
                    
                    # Re-find the links to avoid stale element reference
                    job_links = driver.find_elements(By.CLASS_NAME, "job-card-container__link")
                    if index >= len(job_links):
                        break
                    
                    # Click the job link
                    driver.execute_script("arguments[0].click();", job_links[index])
                    
                    # Wait for job details to load
                    job_details = None
                    details_selectors = [
                        (By.CSS_SELECTOR, 'div.jobs-search__job-details--wrapper'),
                        (By.CSS_SELECTOR, 'section.jobs-search__job-details'),
                        (By.CSS_SELECTOR, 'div[data-job-details-container]')
                    ]
                    
                    for by_type, selector in details_selectors:
                        try:
                            WebDriverWait(driver, 5).until(
                                EC.presence_of_element_located((by_type, selector))
                            )
                            job_details = driver.find_element(by_type, selector)
                            break
                        except:
                            continue
                    
                    if not job_details:
                        logger.warning(f"Could not load details for job {index + 1}")
                        continue
                    
                    # Give it a moment to fully load
                    time.sleep(2)
                    
                    # Get the job details HTML
                    job_html = job_details.get_attribute('innerHTML')
                    
                    # Get job title for filename
                    job_title = f"job_{index + 1}"
                    title_selectors = [
                        (By.TAG_NAME, 'h1'),
                        (By.CSS_SELECTOR, 'h2.jobs-unified-top-card__job-title'),
                        (By.CSS_SELECTOR, '.jobs-unified-top-card__job-title')
                    ]
                    
                    for by_type, selector in title_selectors:
                        try:
                            title_element = job_details.find_element(by_type, selector)
                            job_title = title_element.text
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
                    
                    # Small delay between jobs
                    time.sleep(1)
                    
                except Exception as e:
                    logger.error(f"Error processing job {index + 1}: {str(e)}")
                    continue
            
            logger.info(f"Scraping completed. Saved {len(scraped_jobs)} jobs to {self.output_dir}")
            
        except Exception as e:
            logger.error(f"Critical error during scraping: {str(e)}")
        finally:
            driver.quit()


def main():
    parser = argparse.ArgumentParser(description='Scrape LinkedIn jobs and save as markdown files')
    parser.add_argument('keywords', type=str, help='Job search keywords (e.g., "ruby on rails")')
    parser.add_argument('--output-dir', type=str, default='scraped_jobs', 
                       help='Output directory for markdown files (default: scraped_jobs)')
    
    args = parser.parse_args()
    
    scraper = LinkedInJobsScraper(args.keywords, args.output_dir)
    scraper.scrape_jobs()


if __name__ == "__main__":
    main()
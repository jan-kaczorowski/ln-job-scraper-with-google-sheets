/**
 * Base class for all job scrapers
 * Provides common functionality for saving to files and Google Sheets
 */
class BaseScraper {
  constructor(options) {
    this.options = options;
    this.siteName = 'Unknown';
    this.sitePrefix = 'UN';
  }

  /**
   * Generate offer ID in format PREFIX-ID
   * @param {string} jobId - The job ID from the site
   * @returns {string} Formatted offer ID
   */
  generateOfferId(jobId) {
    return `${this.sitePrefix}-${jobId}`;
  }

  /**
   * Sanitize filename for saving
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized filename
   */
  sanitizeFilename(text) {
    return text.replace(/[<>:"/\\|?*]/g, '')
      .trim()
      .substring(0, 100)
      .replace(/\s+/g, '_') || 'untitled';
  }

  /**
   * Format date for filename
   * @returns {string} Formatted date
   */
  formatDate() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  }

  /**
   * Convert job data to markdown format
   * @param {Object} job - Job data object
   * @returns {string} Markdown content
   */
  formatToMarkdown(job) {
    const { title, company, url, offerId, description } = job;
    
    return `# ${title}\n\n` +
      `*Scraped on: ${new Date().toLocaleString()}*\n\n` +
      `*Source: ${this.siteName}*\n\n` +
      `*OfferID: ${offerId}*\n\n` +
      `*Company: ${company || 'N/A'}*\n\n` +
      `*URL: ${url}*\n\n` +
      `---\n\n` +
      description;
  }

  /**
   * Save job to markdown file
   * @param {Object} job - Job data
   * @param {string} outputDir - Output directory
   * @returns {Promise<string>} File path
   */
  async saveToFile(job, outputDir) {
    const fs = require('fs').promises;
    const path = require('path');
    
    await fs.mkdir(outputDir, { recursive: true });
    
    const filename = `${this.sanitizeFilename(job.title)}_${this.formatDate()}.md`;
    const filepath = path.join(outputDir, filename);
    const content = this.formatToMarkdown(job);
    
    await fs.writeFile(filepath, content, 'utf8');
    console.log(`Saved to: ${filepath}`);
    
    return filepath;
  }

  /**
   * Format job data for Google Sheets
   * @param {Object} job - Job data
   * @returns {Array} Row data for sheets
   */
  formatForSheets(job) {
    const created_at = new Date().toISOString();
    const { offerId, title, company, url, description } = job;
    const status = 'pending';
    
    return [created_at, offerId, title, company || 'N/A', url, description, status];
  }

  /**
   * Abstract method - must be implemented by child classes
   * @param {Object} params - Scraping parameters
   * @returns {Promise<Array>} Array of job objects
   */
  async scrape(params) {
    throw new Error('scrape() method must be implemented by child class');
  }
}

module.exports = BaseScraper;
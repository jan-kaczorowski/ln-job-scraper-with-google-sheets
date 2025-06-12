const fetch = require('node-fetch');
const BaseScraper = require('./base-scraper');

class HiringCafeScraper extends BaseScraper {
  constructor(options) {
    super(options);
    this.siteName = 'HiringCafe';
    this.sitePrefix = 'HC';
    this.apiUrl = 'https://hiring.cafe/api/search-jobs';
  }

  htmlToMarkdown(html) {
    // Similar to LinkedIn scraper but can be customized for HiringCafe
    html = html.replace(/<!--.*?-->/gs, '');
    html = html.replace(/<!\[CDATA\[.*?\]\]>/gs, '');
    
    const conversions = [
      { from: /<h1[^>]*>(.*?)<\/h1>/gi, to: '\n# $1\n' },
      { from: /<h2[^>]*>(.*?)<\/h2>/gi, to: '\n## $1\n' },
      { from: /<h3[^>]*>(.*?)<\/h3>/gi, to: '\n### $1\n' },
      { from: /<(strong|b)[^>]*>(.*?)<\/\1>/gi, to: '**$2**' },
      { from: /<(em|i)[^>]*>(.*?)<\/\1>/gi, to: '*$2*' },
      { from: /<li[^>]*>(.*?)<\/li>/gi, to: '- $1\n' },
      { from: /<ul[^>]*>/gi, to: '\n' },
      { from: /<\/ul>/gi, to: '\n' },
      { from: /<p[^>]*>(.*?)<\/p>/gi, to: '\n$1\n' },
      { from: /<br[^>]*>/gi, to: '\n' },
      { from: /<hr[^>]*>/gi, to: '\n---\n' },
      { from: /<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, to: '[$2]($1)' },
      { from: /<[^>]+>/g, to: '' }
    ];
    
    conversions.forEach(({ from, to }) => {
      html = html.replace(from, to);
    });
    
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

  buildSearchPayload(params) {
    const { keywords, departments, maxJobs } = params;
    
    // Build search state based on parameters
    const searchState = {
      searchQuery: keywords || '',
      departments: departments ? departments.split(',').map(d => d.trim()) : [],
      locations: [{
        formatted_address: "Poland",
        types: ["country"],
        geometry: { location: { lat: "52.1792", lon: "21.0011" } },
        id: "user_country",
        address_components: [{ long_name: "Poland", short_name: "PL", types: ["country"] }],
        options: { flexible_regions: ["anywhere_in_continent", "anywhere_in_world"] }
      }],
      workplaceTypes: ["Remote", "Hybrid", "Onsite"],
      defaultToUserLocation: true,
      physicalEnvironments: ["Office", "Outdoor", "Vehicle", "Industrial", "Customer-Facing"],
      commitmentTypes: ["Full Time", "Part Time", "Contract", "Internship", "Temporary", "Seasonal", "Volunteer"],
      seniorityLevel: ["No Prior Experience Required", "Entry Level", "Mid Level", "Senior Level"],
      roleTypes: ["Individual Contributor", "People Manager"],
      sortBy: "default"
    };
    
    return {
      size: parseInt(maxJobs) || 10,
      page: 0,
      searchState
    };
  }

  async scrape(params) {
    const payload = this.buildSearchPayload(params);
    
    console.log(`Searching HiringCafe for: ${params.keywords}`);
    if (params.departments) {
      console.log(`Departments: ${params.departments}`);
    }
    
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const jobs = [];
      
      console.log(`Found ${data.results?.length || 0} jobs`);
      
      for (const result of (data.results || [])) {
        try {
          const jobInfo = result.job_information || {};
          const processedData = result.v5_processed_job_data || {};
          const companyData = result.v5_processed_company_data || {};
          
          // Extract job ID from the result ID
          const jobId = result.id.split('___').pop();
          
          // Build job URL
          const jobUrl = result.apply_url || `https://hiring.cafe/job/${jobId}`;
          
          // Convert HTML description to markdown
          const description = this.htmlToMarkdown(jobInfo.description || '');
          
          jobs.push({
            title: jobInfo.title || processedData.core_job_title || 'Untitled',
            company: companyData.name || processedData.company_name || 'Unknown Company',
            url: jobUrl,
            offerId: this.generateOfferId(jobId),
            description
          });
          
        } catch (error) {
          console.error('Error processing job:', error.message);
        }
      }
      
      return jobs;
      
    } catch (error) {
      console.error('Error fetching from HiringCafe:', error);
      return [];
    }
  }
}

module.exports = HiringCafeScraper;
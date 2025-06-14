# Universal Job Scraper

A dockerized, modular web scraper for multiple job sites using Playwright and Node.js. Currently supports LinkedIn, HiringCafe, and Eldorado, with an extensible architecture for adding more sites. Scrapes job postings, converts them to Markdown, and optionally sends data to Google Sheets.

## Features

- 🌐 Multi-site support (LinkedIn, HiringCafe, Eldorado)
- 🔍 Flexible search by keywords and filters
- 📝 Converts job descriptions to clean Markdown format
- 🔐 Supports LinkedIn login for better access
- 📊 Optional Google Sheets integration
- 🐳 Fully dockerized for easy deployment
- 🎯 Site-specific filtering options
- 🆔 Generates unique OfferIDs per site (LN-xxx, HC-xxx, ED-xxx)
- 🔌 Extensible architecture for adding new sites

## Quick Start

### Prerequisites

- Docker installed on your system
- LinkedIn credentials in `linkedin_creds.json`
- (Optional) Google service account for Sheets integration

### Setup

1. Clone the repository
2. For LinkedIn: Create `linkedin_creds.json`:
   ```json
   {username: "your-email@example.com", password: "your-password"}
   ```
3. Build the Docker image:
   ```bash
   ./build_docker.sh
   ```

### Usage

#### LinkedIn Scraping
```bash
# Basic search
./run_scraper.sh -s linkedin -k "ruby on rails"

# With filters
./run_scraper.sh -s linkedin -k "python developer" -n 20 -t r86400 -w 2

# With Google Sheets
./run_scraper.sh -s linkedin -k "data scientist" --google-sheet "YOUR_SHEET_ID"
```

#### HiringCafe Scraping
```bash
# Search by keywords
./run_scraper.sh -s hiringcafe -k "director"

# Search by department
./run_scraper.sh -s hiringcafe -d "Information Technology,Engineering"

# Combined search
./run_scraper.sh -s hiringcafe -k "manager" -d "Sales" -n 20
```

#### Eldorado Scraping
```bash
# Basic search
./run_scraper.sh -s eldorado -k "developer"

# With Google Sheets
./run_scraper.sh -s eldorado -k "ruby on rails" --google-sheet "YOUR_SHEET_ID"
```

## Options

### Common Options
- `-s, --site` - Site to scrape (required: linkedin, hiringcafe, eldorado)
- `-k, --keywords` - Search keywords
- `-n, --max-jobs` - Maximum jobs to scrape (default: 10)
- `-o, --output-dir` - Output directory (default: scraped_jobs)
- `--google-sheet` - Google Sheet ID for data export

### LinkedIn Options
- `-t, --time-range` - Time filter: r86400 (24h), r604800 (week), r2592000 (month)
- `-w, --work-type` - Work type: 1 (on-site), 2 (remote), 3 (hybrid)
- `--filters` - Custom LinkedIn filter parameters
- `--no-active-filter` - Include inactive listings
- `--headful` - Show browser window

### HiringCafe Options
- `-d, --departments` - Filter by departments (comma-separated)

### Eldorado Options
- No site-specific options (uses common keywords parameter)

## Output

### Markdown Files

Jobs are saved in the `scraped_jobs` directory with metadata including:
- Scraped timestamp
- Source site
- OfferID (format: LN-XXXXXX for LinkedIn, HC-XXXXXX for HiringCafe, ED-XXXXXX for Eldorado)
- Company name
- Direct job URL
- Full job description in Markdown

### Google Sheets

When enabled, data is exported with columns:
- created_at
- offer_id
- job_title
- company
- url
- markdown_content
- status

## Architecture

The scraper uses a modular architecture:
- `BaseScraper` - Abstract base class with common functionality
- Site-specific scrapers inherit from BaseScraper
- `ScraperManager` - Orchestrates scraping and output
- Unified output format across all sites

### Adding New Sites

To add a new job site:
1. Create a new scraper in `src/scrapers/`
2. Inherit from `BaseScraper`
3. Implement the `scrape()` method
4. Register in `ScraperManager`

## Documentation

- [Docker Setup & Usage](README_DOCKER.md)
- [Google Sheets Integration](GOOGLE_SHEETS_SETUP.md)

## LinkedIn parameter flags

```

f_E=5 – Director-level positions

f_F=sale,mgmt – Sales and Management functions

f_JT=F – Full-time roles only

f_AL=true – Only actively hiring companies

f_EA=true – Easy Apply enabled, makr this false or remove for company website applications

f_JIYN=true – Shows jobs where you have connections (still working out how to display only 2nd level connections as that seems to be the $$ ticket to engagement messages)

f_VJ=true – Only verified jobs (for those that need to feel secure bout bogus job postings, linkedin verfiies the human who created the job post and marks it as verified)

f_TPR=r14400 – Posted within the last 4 hours

f_WT=1,2,3 – On-site, hybrid, remote work types

sortBy=DD – Sort by date (newest first)

distance=25 – Search radius of 25 miles

geoId=103644278 – United States

keywords=Director%20Sales%20Operations – Search for Sales-related roles


```



## License

MIT

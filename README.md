# LinkedIn Jobs Scraper

A dockerized web scraper for LinkedIn job listings using Playwright and Node.js. Scrapes job postings, converts them to Markdown, and optionally sends data to Google Sheets.

## Features

- 🔍 Scrapes LinkedIn job listings based on keywords
- 📝 Converts job descriptions to clean Markdown format
- 🔐 Supports LinkedIn login for better access
- 📊 Optional Google Sheets integration
- 🐳 Fully dockerized for easy deployment
- 🎯 Advanced filtering options (time range, work type, etc.)
- 🆔 Generates unique OfferIDs for tracking

## Quick Start

### Prerequisites

- Docker installed on your system
- LinkedIn credentials in `linkedin_creds.json`
- (Optional) Google service account for Sheets integration

### Setup

1. Clone the repository
2. Create `linkedin_creds.json`:
   ```json
   {username: "your-email@example.com", password: "your-password"}
   ```
3. Build the Docker image:
   ```bash
   ./build_docker.sh
   ```

### Usage

Basic usage:
```bash
./run_docker.sh -k "ruby on rails"
```

With options:
```bash
./run_docker.sh -k "python developer" -n 20 -t r86400 -w 2
```

With Google Sheets:
```bash
./run_docker.sh -k "data scientist" --google-sheet "YOUR_SHEET_ID"
```

## Options

- `-k, --keywords` - Search keywords (required)
- `-n, --max-jobs` - Maximum jobs to scrape (default: 10)
- `-t, --time-range` - Time filter: r86400 (24h), r604800 (week), r2592000 (month)
- `-w, --work-type` - Work type: 1 (on-site), 2 (remote), 3 (hybrid)
- `--filters` - Custom LinkedIn filter parameters
- `--google-sheet` - Google Sheet ID for data export

## Output

### Markdown Files

Jobs are saved in the `scraped_jobs` directory with metadata including:
- Scraped timestamp
- OfferID (format: LN-XXXXXX)
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

## Documentation

- [Docker Setup & Usage](README_DOCKER.md)
- [Google Sheets Integration](GOOGLE_SHEETS_SETUP.md)

## License

MIT
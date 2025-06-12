# LinkedIn Jobs Scraper - Dockerized Playwright Version

This is a dockerized version of the LinkedIn jobs scraper using Playwright.

## Prerequisites

- Docker installed on your system
- `linkedin_creds.json` file with your LinkedIn credentials

## Setup

1. Build the Docker image:
```bash
./build_docker.sh
```

## Usage

### Option 1: Using the run script (recommended)

```bash
# Basic usage (remote jobs from last week)
./run_docker.sh -k "ruby on rails"

# With custom options
./run_docker.sh -k "ruby on rails" -n 20 -t r86400  # Last 24 hours, 20 jobs max
./run_docker.sh -k "python developer" -w 3           # Hybrid jobs
./run_docker.sh -k "data scientist" --headful        # Run with visible browser

# Custom filters
./run_docker.sh -k "ruby on rails" --filters "f_AL=true&f_TPR=r604800&f_WT=2&f_E=2"
```

### Option 2: Using docker-compose

Edit `docker-compose.yml` to change the command, then:
```bash
docker-compose run --rm scraper
```

### Option 3: Using docker directly

```bash
docker run -it --rm --ipc=host \
  -v $(pwd)/scraped_jobs:/app/scraped_jobs \
  -v $(pwd)/linkedin_creds.json:/app/linkedin_creds.json:ro \
  linkedin-scraper -k "ruby on rails" -n 10
```

## Options

- `-k, --keywords` - Search keywords (required)
- `-o, --output-dir` - Output directory (default: scraped_jobs)
- `-n, --max-jobs` - Maximum jobs to scrape (default: 10)
- `--headful` - Run in headful mode (shows browser)
- `-t, --time-range` - Time range filter:
  - `r86400` - Last 24 hours
  - `r604800` - Last week (default)
  - `r2592000` - Last month
- `-w, --work-type` - Work type filter:
  - `1` - On-site
  - `2` - Remote (default)
  - `3` - Hybrid
- `--filters` - Custom filter parameters
- `--no-active-filter` - Don't filter for active listings only

## Output

Scraped jobs are saved as Markdown files in the `scraped_jobs` directory.

## Troubleshooting

1. If the container can't access credentials:
   - Ensure `linkedin_creds.json` exists in the current directory
   - Check file permissions

2. For headful mode on Linux/macOS:
   - You may need to configure X11 forwarding
   - Uncomment the X11 volumes in docker-compose.yml

3. If scraping fails:
   - Try running in headful mode to see what's happening
   - Check if LinkedIn has changed their page structure
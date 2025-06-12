#!/bin/bash

# Universal Job Scraper - Docker Runner
# Usage: ./run_scraper.sh -s SITE [options]

# Function to show help
show_help() {
  echo "Usage: $0 -s SITE [options]"
  echo ""
  echo "Required:"
  echo "  -s, --site          Site to scrape (linkedin, hiringcafe)"
  echo ""
  echo "Common options:"
  echo "  -k, --keywords      Search keywords"
  echo "  -o, --output-dir    Output directory (default: scraped_jobs)"
  echo "  -n, --max-jobs      Maximum jobs to scrape (default: 10)"
  echo "  --google-sheet      Google Sheet ID for data export"
  echo ""
  echo "LinkedIn options:"
  echo "  --headful           Run in headful mode (shows browser)"
  echo "  -t, --time-range    Time range: r86400 (24h), r604800 (week), r2592000 (month)"
  echo "  -w, --work-type     Work type: 1 (on-site), 2 (remote), 3 (hybrid)"
  echo "  --filters           Custom filter parameters"
  echo "  --no-active-filter  Don't filter for active listings only"
  echo ""
  echo "HiringCafe options:"
  echo "  -d, --departments   Departments (comma-separated, e.g., 'IT,Engineering')"
  echo ""
  echo "Examples:"
  echo "  # LinkedIn scraping"
  echo "  $0 -s linkedin -k 'ruby on rails' -n 20"
  echo ""
  echo "  # HiringCafe scraping"
  echo "  $0 -s hiringcafe -k 'director' -d 'Information Technology'"
  echo ""
  echo "  # With Google Sheets"
  echo "  $0 -s linkedin -k 'python' --google-sheet 'SHEET_ID'"
}

# Default values
SITE=""
KEYWORDS=""
OUTPUT_DIR="scraped_jobs"
MAX_JOBS="10"
HEADFUL=""
TIME_RANGE=""
WORK_TYPE=""
FILTERS=""
NO_ACTIVE=""
GOOGLE_SHEET=""
DEPARTMENTS=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -s|--site)
      SITE="$2"
      shift 2
      ;;
    -k|--keywords)
      KEYWORDS="$2"
      shift 2
      ;;
    -o|--output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    -n|--max-jobs)
      MAX_JOBS="$2"
      shift 2
      ;;
    --headful)
      HEADFUL="--headful"
      shift
      ;;
    -t|--time-range)
      TIME_RANGE="$2"
      shift 2
      ;;
    -w|--work-type)
      WORK_TYPE="$2"
      shift 2
      ;;
    --filters)
      FILTERS="$2"
      shift 2
      ;;
    --no-active-filter)
      NO_ACTIVE="--no-active-filter"
      shift
      ;;
    --google-sheet)
      GOOGLE_SHEET="$2"
      shift 2
      ;;
    -d|--departments)
      DEPARTMENTS="$2"
      shift 2
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# Validate required options
if [ -z "$SITE" ]; then
  echo "Error: Site is required. Use -s or --site option."
  echo ""
  show_help
  exit 1
fi

# Validate site-specific requirements
if [ "$SITE" = "linkedin" ] && [ -z "$KEYWORDS" ]; then
  echo "Error: Keywords are required for LinkedIn scraping."
  exit 1
fi

if [ "$SITE" = "hiringcafe" ] && [ -z "$KEYWORDS" ] && [ -z "$DEPARTMENTS" ]; then
  echo "Error: Either keywords or departments are required for HiringCafe scraping."
  exit 1
fi

# Build Docker command
echo "Running job scraper for $SITE..."

# Build args array
ARGS=()
ARGS+=("-s" "$SITE")

if [ -n "$KEYWORDS" ]; then
  ARGS+=("-k" "$KEYWORDS")
fi

ARGS+=("-o" "/app/$OUTPUT_DIR")
ARGS+=("-n" "$MAX_JOBS")

if [ -n "$HEADFUL" ]; then
  ARGS+=("--headful")
fi

if [ -n "$TIME_RANGE" ]; then
  ARGS+=("-t" "$TIME_RANGE")
fi

if [ -n "$WORK_TYPE" ]; then
  ARGS+=("-w" "$WORK_TYPE")
fi

if [ -n "$FILTERS" ]; then
  ARGS+=("--filters" "$FILTERS")
fi

if [ -n "$NO_ACTIVE" ]; then
  ARGS+=("--no-active-filter")
fi

if [ -n "$GOOGLE_SHEET" ]; then
  ARGS+=("--google-sheet" "$GOOGLE_SHEET")
fi

if [ -n "$DEPARTMENTS" ]; then
  ARGS+=("-d" "$DEPARTMENTS")
fi

echo "Command: node job_scraper.js ${ARGS[@]}"

# Run the Docker container
docker run -it --rm \
  --ipc=host \
  -v "$(pwd)/scraped_jobs:/app/scraped_jobs" \
  -v "$(pwd)/linkedin_creds.json:/app/linkedin_creds.json:ro" \
  -v "$(pwd)/google_service_account.json:/app/google_service_account.json:ro" \
  job-scraper \
  "${ARGS[@]}"
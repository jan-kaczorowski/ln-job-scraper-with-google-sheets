#!/bin/bash

# LinkedIn Jobs Scraper - Docker Runner
# Usage: ./run_docker.sh -k "keywords" [options]

# Default values
KEYWORDS=""
OUTPUT_DIR="scraped_jobs"
MAX_JOBS="10"
HEADFUL=""
TIME_RANGE="r604800"
WORK_TYPE="2"
FILTERS=""
NO_ACTIVE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
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
    -h|--help)
      echo "Usage: $0 -k 'keywords' [options]"
      echo "Options:"
      echo "  -k, --keywords       Search keywords (required)"
      echo "  -o, --output-dir     Output directory (default: scraped_jobs)"
      echo "  -n, --max-jobs       Maximum jobs to scrape (default: 10)"
      echo "  --headful           Run in headful mode (shows browser)"
      echo "  -t, --time-range    Time range: r86400 (24h), r604800 (week), r2592000 (month)"
      echo "  -w, --work-type     Work type: 1 (on-site), 2 (remote), 3 (hybrid)"
      echo "  --filters           Custom filter parameters"
      echo "  --no-active-filter  Don't filter for active listings only"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Check if keywords provided
if [ -z "$KEYWORDS" ]; then
  echo "Error: Keywords are required. Use -k or --keywords option."
  echo "Example: $0 -k 'ruby on rails'"
  exit 1
fi

# Build Docker command with proper argument handling
echo "Running LinkedIn scraper in Docker..."

# Build args array
ARGS=()
ARGS+=("-k" "$KEYWORDS")
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

echo "Command: node linkedin_scraper_playwright.js ${ARGS[@]}"

# Run the Docker container
docker run -it --rm \
  --ipc=host \
  -v "$(pwd)/scraped_jobs:/app/scraped_jobs" \
  -v "$(pwd)/linkedin_creds.json:/app/linkedin_creds.json:ro" \
  linkedin-scraper \
  node linkedin_scraper_playwright.js "${ARGS[@]}"
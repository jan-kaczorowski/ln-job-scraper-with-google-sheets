#!/bin/bash

# Simple LinkedIn Jobs Scraper using curl and basic tools
# Usage: ./scrape_linkedin.sh "search keywords"

if [ $# -eq 0 ]; then
    echo "Usage: $0 \"search keywords\""
    exit 1
fi

KEYWORDS="$1"
OUTPUT_DIR="${2:-scraped_jobs}"
ENCODED_KEYWORDS=$(echo "$KEYWORDS" | sed 's/ /%20/g')

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "LinkedIn Jobs Scraper"
echo "Keywords: $KEYWORDS"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Base URL for LinkedIn jobs
BASE_URL="https://www.linkedin.com/jobs/search/?keywords=${ENCODED_KEYWORDS}&location=Worldwide"

echo "Fetching jobs page..."

# Download the main jobs page
TEMP_FILE="/tmp/linkedin_jobs_$$.html"
curl -s -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
     -H "Accept: text/html,application/xhtml+xml" \
     -H "Accept-Language: en-US,en;q=0.9" \
     "$BASE_URL" > "$TEMP_FILE"

# Extract job IDs and titles using grep and sed
echo "Extracting job listings..."

# Find job cards and extract data
grep -o 'data-entity-urn="urn:li:jobPosting:[0-9]*"' "$TEMP_FILE" | sed 's/.*:\([0-9]*\).*/\1/' | head -10 > /tmp/job_ids_$$.txt

# Counter for jobs
JOB_COUNT=0

# Process each job ID
while IFS= read -r JOB_ID; do
    if [ -n "$JOB_ID" ]; then
        JOB_COUNT=$((JOB_COUNT + 1))
        echo "Processing job $JOB_COUNT (ID: $JOB_ID)..."
        
        # Create a simple markdown file with job info
        TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
        FILENAME="${OUTPUT_DIR}/job_${JOB_ID}_${TIMESTAMP}.md"
        
        # Write basic markdown structure
        cat > "$FILENAME" << EOF
# LinkedIn Job - ID: $JOB_ID

*Scraped on: $(date)*

*Keywords: $KEYWORDS*

---

## Job Information

- Job ID: $JOB_ID
- Source: LinkedIn Jobs
- Search Keywords: $KEYWORDS

## Job Link

View this job on LinkedIn: https://www.linkedin.com/jobs/view/$JOB_ID/

---

*Note: For full job details, please visit the LinkedIn page directly.*

EOF
        
        echo "Saved to: $FILENAME"
        
        # Small delay to be respectful
        sleep 1
    fi
done < /tmp/job_ids_$$.txt

# Cleanup
rm -f "$TEMP_FILE" /tmp/job_ids_$$.txt

echo ""
echo "Scraping completed! Found and saved $JOB_COUNT jobs to $OUTPUT_DIR/"
echo ""
echo "Note: This simple scraper only captures job IDs and creates placeholder files."
echo "For full job descriptions, you'll need to visit each job link on LinkedIn."
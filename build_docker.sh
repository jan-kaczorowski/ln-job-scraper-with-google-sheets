#!/bin/bash

echo "Building Job Scraper Docker image..."

# Build the Docker image
docker build -t job-scraper .

echo ""
echo "Build complete! Usage examples:"
echo ""
echo "# LinkedIn scraping:"
echo "./run_scraper.sh -s linkedin -k 'ruby on rails'"
echo ""
echo "# HiringCafe scraping:"
echo "./run_scraper.sh -s hiringcafe -k 'director' -d 'Information Technology'"
echo ""
echo "# With Google Sheets:"
echo "./run_scraper.sh -s linkedin -k 'python' --google-sheet 'YOUR_SHEET_ID'"
echo ""
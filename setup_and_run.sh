#!/bin/bash

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

echo "Setup complete! You can now run the scraper with:"
echo "python linkedin_jobs_scraper.py \"your keywords here\""
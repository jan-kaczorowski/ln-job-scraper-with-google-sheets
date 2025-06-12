#!/bin/bash

echo "Setting up Ruby LinkedIn scraper..."

# Check if bundler is installed
if ! command -v bundle &> /dev/null; then
    echo "Installing bundler..."
    gem install bundler
fi

# Install dependencies
echo "Installing Ruby gems..."
bundle install

# Check if chromedriver is installed
if ! command -v chromedriver &> /dev/null; then
    echo ""
    echo "ChromeDriver not found. Please install it:"
    echo "  macOS: brew install --cask chromedriver"
    echo "  Linux: sudo apt-get install chromium-chromedriver"
    echo ""
fi

echo ""
echo "Setup complete! Usage:"
echo ""
echo "  # Basic usage (default: remote jobs from last week):"
echo "  ruby linkedin_scraper.rb -k 'ruby on rails'"
echo ""
echo "  # Run in headful mode (shows browser):"
echo "  ruby linkedin_scraper.rb -k 'ruby on rails' --headful"
echo ""
echo "  # Filter options:"
echo "  ruby linkedin_scraper.rb -k 'ruby on rails' -t r86400              # Last 24 hours"
echo "  ruby linkedin_scraper.rb -k 'ruby on rails' -w 1                   # On-site jobs"
echo "  ruby linkedin_scraper.rb -k 'ruby on rails' -w 3                   # Hybrid jobs"
echo "  ruby linkedin_scraper.rb -k 'ruby on rails' --no-active-filter     # Include inactive listings"
echo ""
echo "  # Custom filters:"
echo "  ruby linkedin_scraper.rb -k 'ruby on rails' --filters 'f_AL=true&f_TPR=r604800&f_WT=2&f_E=2'"
echo ""
echo "  # See all options:"
echo "  ruby linkedin_scraper.rb -h"
echo ""
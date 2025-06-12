# Use official Playwright image - latest stable
FROM mcr.microsoft.com/playwright:v1.48.0-noble

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY job_scraper.js .
COPY google_sheets.js .
COPY src/ ./src/
COPY linkedin_creds.json* ./
COPY google_service_account.json* ./

# Create output directory
RUN mkdir -p scraped_jobs

# Run as non-root user for security
USER pwuser

# Default command
ENTRYPOINT ["node", "job_scraper.js"]
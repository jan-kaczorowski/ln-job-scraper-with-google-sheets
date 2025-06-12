#!/bin/bash

echo "Building LinkedIn Scraper Docker image..."

# Build the Docker image
docker build -t linkedin-scraper .

echo ""
echo "Build complete! Usage examples:"
echo ""
echo "# Using run script:"
echo "./run_docker.sh -k 'ruby on rails'"
echo ""
echo "# Using docker-compose:"
echo "docker-compose run --rm scraper -k 'ruby on rails'"
echo ""
echo "# Using docker directly:"
echo "docker run -it --rm --ipc=host -v \$(pwd)/scraped_jobs:/app/scraped_jobs -v \$(pwd)/linkedin_creds.json:/app/linkedin_creds.json:ro linkedin-scraper -k 'ruby on rails'"
echo ""
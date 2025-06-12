Write me a script that would:

1. Open browser on `https://www.linkedin.com/jobs/search/?currentJobId=4230610778&geoId=91000000&keywords=ruby%20on%20rails&origin=JOB_SEARCH_PAGE_JOB_FILTER&refresh=true`

2. clicks every link (<a> tag) with class `job-card-container__link` That will make content of a job offer to appear in `div.jobs-search__job-details--wrapper` 

3. scrape contents of that div and convert it to markdown

4. proceed to the next such link from item 2.

5. Dump all the contents converted to markdown to local markdown files

Additional requirements:

- use python
- use playwright
- make keywords from the URL mentioned in item 1, a command line param


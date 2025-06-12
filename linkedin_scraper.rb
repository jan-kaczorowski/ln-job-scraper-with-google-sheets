#!/usr/bin/env ruby

require 'capybara'
require 'capybara/dsl'
require 'selenium-webdriver'
require 'fileutils'
require 'optparse'
require 'erb'
require 'json'
require 'nokogiri'

# Parse command line options
options = {
  keywords: nil,
  output_dir: 'scraped_jobs',
  headless: true,
  max_jobs: 10,
  active_listings: true,
  time_range: 'r604800',  # last week
  work_type: '2'  # remote
}

OptionParser.new do |opts|
  opts.banner = "Usage: ruby linkedin_scraper.rb [options]"
  
  opts.on("-k", "--keywords KEYWORDS", "Search keywords (required)") do |k|
    options[:keywords] = k
  end
  
  opts.on("-o", "--output DIR", "Output directory (default: scraped_jobs)") do |o|
    options[:output_dir] = o
  end
  
  opts.on("--headful", "Run in headful mode (shows browser)") do
    options[:headless] = false
  end
  
  opts.on("--headless", "Run in headless mode (default)") do
    options[:headless] = true
  end
  
  opts.on("-n", "--max-jobs N", Integer, "Maximum number of jobs to scrape (default: 10)") do |n|
    options[:max_jobs] = n
  end
  
  opts.on("--no-active-filter", "Don't filter for active listings only") do
    options[:active_listings] = false
  end
  
  opts.on("-t", "--time-range RANGE", "Time range filter (default: r604800)",
          "Options: r86400 (24h), r604800 (week), r2592000 (month)") do |t|
    options[:time_range] = t
  end
  
  opts.on("-w", "--work-type TYPE", "Work type filter (default: 2 for remote)",
          "Options: 1 (on-site), 2 (remote), 3 (hybrid)") do |w|
    options[:work_type] = w
  end
  
  opts.on("--filters PARAMS", "Custom filter parameters (e.g., 'f_AL=true&f_TPR=r604800')") do |f|
    options[:custom_filters] = f
  end
  
  opts.on("-h", "--help", "Show this help message") do
    puts opts
    exit
  end
end.parse!

# Check for required keywords
if options[:keywords].nil? || options[:keywords].empty?
  puts "Error: Keywords are required. Use -k or --keywords option."
  puts "Example: ruby linkedin_scraper.rb -k 'ruby on rails'"
  exit 1
end

# Include Capybara DSL
include Capybara::DSL

# Configure Capybara with Selenium Chrome
Capybara.register_driver :selenium_chrome do |app|
  chrome_options = Selenium::WebDriver::Chrome::Options.new
  
  # Check environment variables too
  headful = !options[:headless] || 
            ['1', 'true'].include?(ENV['HEADFUL'].to_s.downcase) || 
            ['0', 'false'].include?(ENV['HEADLESS'].to_s.downcase)
  
  unless headful
    chrome_options.add_argument('--headless=new')  # Use new headless mode
  end
  
  chrome_options.add_argument('--no-sandbox')
  chrome_options.add_argument('--disable-gpu')
  chrome_options.add_argument('--disable-dev-shm-usage')
  chrome_options.add_argument('--disable-blink-features=AutomationControlled')
  chrome_options.add_argument('--window-size=1920,1080')
  
  # User agent to appear more like a regular browser
  user_agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  chrome_options.add_argument("--user-agent=#{user_agent}")
  
  # Additional options for better headless behavior
  chrome_options.add_argument('--disable-web-security')
  chrome_options.add_argument('--disable-features=IsolateOrigins,site-per-process')
  chrome_options.add_preference('credentials_enable_service', false)
  chrome_options.add_preference('profile.password_manager_enabled', false)
  
  # Don't wait for pending navigation
  chrome_options.add_preference('pageLoadStrategy', 'eager')
  
  Capybara::Selenium::Driver.new(app, browser: :chrome, options: chrome_options)
end

# Set current driver
Capybara.current_driver = :selenium_chrome
Capybara.default_max_wait_time = 10

class LinkedInScraper
  include Capybara::DSL
  
  def initialize(options)
    @keywords = options[:keywords]
    @output_dir = options[:output_dir]
    @max_jobs = options[:max_jobs]
    @options = options
    @base_url = "https://www.linkedin.com/jobs/search/"
    @credentials = load_credentials
    
    # Create output directory
    FileUtils.mkdir_p(@output_dir)
  end
  
  def load_credentials
    creds_file = 'linkedin_creds.json'
    if File.exist?(creds_file)
      content = File.read(creds_file)
      # Parse the non-standard JSON format
      if content =~ /\{username:\s*"([^"]+)",\s*password:\s*"([^"]+)"\}/
        { 'username' => $1, 'password' => $2 }
      else
        puts "Warning: Could not parse credentials file"
        nil
      end
    else
      puts "Warning: linkedin_creds.json not found"
      nil
    end
  end
  
  def login_to_linkedin
    return false unless @credentials
    
    puts "Logging in to LinkedIn..."
    
    # First go to main page to establish session
    visit 'https://www.linkedin.com'
    sleep 2
    
    # Now go to login page
    visit 'https://www.linkedin.com/login'
    
    # Wait for login form
    unless has_field?('session_key', wait: 10)
      puts "Login form not found"
      return false
    end
    
    # Fill in credentials
    fill_in 'session_key', with: @credentials['username']
    fill_in 'session_password', with: @credentials['password']
    
    # Click sign in button
    click_button 'Sign in'
    
    # Wait for login to complete - check if we're redirected away from login page
    sleep 3
    
    # Check if login was successful by looking for common elements on logged-in pages
    if current_url.include?('/login') || has_text?('Wrong email or password', wait: 2)
      puts "Login failed - check credentials"
      return false
    end
    
    puts "Login successful!"
    true
  end
  
  def scrape
    puts "LinkedIn Jobs Scraper"
    puts "Keywords: #{@keywords}"
    puts "Output directory: #{@output_dir}"
    puts "Max jobs: #{@max_jobs}"
    puts "-" * 50
    
    begin
      # Login first
      unless login_to_linkedin
        puts "Skipping login - proceeding without authentication"
        puts "Note: You may have limited access to job details"
      end
      sleep 2
      # Build URL with encoded keywords
      encoded_keywords = ERB::Util.url_encode(@keywords)
      url = "#{@base_url}?keywords=#{encoded_keywords}&geoId=91000000"
      
      # Add filter parameters
      if @options[:custom_filters]
        # Use custom filters if provided
        url += "&#{@options[:custom_filters]}"
      else
        # Build filters from individual options
        url += "&f_AL=true" if @options[:active_listings]
        url += "&f_TPR=#{@options[:time_range]}" if @options[:time_range]
        url += "&f_WT=#{@options[:work_type]}" if @options[:work_type]
      end
      
      url += "&origin=JOB_SEARCH_PAGE_JOB_FILTER&refresh=true"
      
      puts "Navigating to: #{url}"
      visit url
      
      # Wait for page to load
      sleep 5
      
      # Try to dismiss any popups
      begin
        if has_css?('button[aria-label="Dismiss"]', wait: 2)
          find('button[aria-label="Dismiss"]').click
          sleep 1
        end
      rescue
        # Popup might not exist
      end
      
      # Wait for job listings
      puts "Waiting for job listings..."
      
      # Try multiple selectors
      job_links = nil
      selectors = [
        '.job-card-container__link',
        'a[data-tracking-control-name*="jobcard"]',
        '.jobs-search-results__list-item a',
        '.job-card-list__title a'
      ]
      
      selectors.each do |selector|
        if has_css?(selector, wait: 5)
          job_links = all(selector)
          if job_links.any?
            puts "Found #{job_links.count} jobs using selector: #{selector}"
            break
          end
        end
      end
      
      if job_links.nil? || job_links.empty?
        puts "No job listings found. The page structure might have changed."
        return
      end
      
      # Limit jobs to process
      jobs_to_process = [job_links.count, @max_jobs].min
      saved_jobs = []
      
      jobs_to_process.times do |i|
        begin
          puts "\nProcessing job #{i + 1}/#{jobs_to_process}"
          
          # Re-find links to avoid stale element references
          job_links = all(selectors.first)
          next if i >= job_links.count
          
          # Get the job URL before clicking
          job_url = ''
          begin
            job_url = job_links[i][:href]
            job_url = "https://www.linkedin.com#{job_url}" unless job_url.start_with?('http')
          rescue
            puts "Could not get job URL"
          end
          
          # Click the job link
          job_links[i].click
          
          # Get current URL after navigation (might be different)
          sleep 1
          current_url = current_url
          job_url = current_url if current_url.include?('/jobs/view/')
          
          # Wait for job details to load
          details_loaded = false
          details_element = nil
          
          details_selectors = [
            'div.jobs-search__job-details--wrapper',
            'section.jobs-search__job-details',
            'div[data-job-details]',
            '.job-view-layout'
          ]
          
          details_selectors.each do |selector|
            if has_css?(selector, wait: 5)
              details_element = find(selector)
              details_loaded = true
              break
            end
          end
          
          unless details_loaded
            puts "Could not load details for job #{i + 1}"
            next
          end
          
          # Give it a moment to fully load
          sleep 2
          
          # Extract job title
          job_title = "job_#{i + 1}"
          title_selectors = ['h1', 'h2.jobs-unified-top-card__job-title', '.jobs-unified-top-card__job-title']
          
          title_selectors.each do |selector|
            if details_element.has_css?(selector)
              job_title = details_element.find(selector).text.strip
              break
            end
          end
          
          puts "Job title: #{job_title}"
          
          # Get the HTML content
          job_html = details_element['innerHTML']
          
          # Convert HTML to clean Markdown
          markdown_content = html_to_markdown(job_html)
          
          # Save to file
          timestamp = Time.now.strftime('%Y%m%d_%H%M%S')
          filename = "#{sanitize_filename(job_title)}_#{timestamp}.md"
          filepath = File.join(@output_dir, filename)
          
          File.open(filepath, 'w') do |f|
            f.puts "# #{job_title}"
            f.puts
            f.puts "*Scraped on: #{Time.now.strftime('%Y-%m-%d %H:%M:%S')}*"
            f.puts
            f.puts "*Keywords: #{@keywords}*"
            f.puts
            f.puts "*URL: #{job_url}*"
            f.puts
            f.puts "---"
            f.puts
            f.puts markdown_content
          end
          
          puts "Saved to: #{filepath}"
          saved_jobs << filepath
          
          # Small delay between jobs
          sleep 1
          
        rescue StandardError => e
          puts "Error processing job #{i + 1}: #{e.message}"
          puts e.backtrace.first(5).join("\n") if ENV['DEBUG']
        end
      end
      
      puts "\n" + "=" * 50
      puts "Scraping completed!"
      puts "Saved #{saved_jobs.count} jobs to #{@output_dir}/"
      
    rescue StandardError => e
      puts "\nFatal error: #{e.message}"
      puts e.backtrace.first(10).join("\n") if ENV['DEBUG']
    ensure
      # Clean up - quit the browser
      Capybara.current_session.driver.quit
    end
  end
  
  private
  
  def html_to_markdown(html)
    # Remove HTML comments and CDATA sections
    html = html.gsub(/<!--.*?-->/m, '')
    html = html.gsub(/<!\[CDATA\[.*?\]\]>/m, '')
    
    doc = Nokogiri::HTML(html)
    
    # Remove all comment nodes that might still exist
    doc.xpath('//comment()').remove
    doc.xpath('//text()[normalize-space(.)=""]').remove  # Remove empty text nodes
    
    # Remove unwanted elements first
    unwanted_selectors = [
      'button', 'svg', 'script', 'style', 'noscript', 'iframe',
      'object', 'embed', 'form', 'input', 'select', 'textarea',
      '[role="button"]', '.artdeco-button', '.social-actions',
      '.share-box', 'template', 'nav'
    ]
    
    unwanted_selectors.each do |selector|
      doc.css(selector).remove
    end
    
    # Process the document recursively
    markdown_lines = []
    process_node(doc.at('body') || doc, markdown_lines)
    
    # Clean up the result
    result = markdown_lines.join("\n")
    
    # Remove multiple consecutive blank lines
    result.gsub!(/\n\s*\n\s*\n/, "\n\n")
    
    # Remove leading/trailing whitespace
    result.strip
  end
  
  def process_node(node, lines, list_level = 0)
    return if node.nil?
    
    case node.type
    when Nokogiri::XML::Node::TEXT_NODE
      text = node.text.strip
      lines << text unless text.empty?
    when Nokogiri::XML::Node::ELEMENT_NODE
      case node.name.downcase
      when 'h1'
        lines << "\n# #{node.text.strip}\n"
      when 'h2'
        lines << "\n## #{node.text.strip}\n"
      when 'h3'
        lines << "\n### #{node.text.strip}\n"
      when 'h4'
        lines << "\n#### #{node.text.strip}\n"
      when 'h5'
        lines << "\n##### #{node.text.strip}\n"
      when 'h6'
        lines << "\n###### #{node.text.strip}\n"
      when 'p', 'div', 'section', 'article'
        # Process children
        text_content = extract_text_content(node).strip
        if !text_content.empty?
          lines << "\n#{text_content}\n"
        else
          node.children.each { |child| process_node(child, lines, list_level) }
        end
      when 'ul', 'ol'
        lines << "\n" if list_level == 0
        node.css('> li').each_with_index do |li, index|
          prefix = node.name == 'ol' ? "#{index + 1}. " : "- "
          indent = "  " * list_level
          li_text = extract_text_content(li).strip
          lines << "#{indent}#{prefix}#{li_text}"
          
          # Handle nested lists
          li.css('> ul, > ol').each do |nested_list|
            process_node(nested_list, lines, list_level + 1)
          end
        end
        lines << "\n" if list_level == 0
      when 'strong', 'b'
        lines << "**#{node.text.strip}**"
      when 'em', 'i'
        lines << "*#{node.text.strip}*"
      when 'code'
        lines << "`#{node.text.strip}`"
      when 'pre'
        lines << "\n```\n#{node.text.strip}\n```\n"
      when 'blockquote'
        quote_lines = extract_text_content(node).strip.split("\n")
        quote_lines.each { |line| lines << "> #{line}" }
        lines << "\n"
      when 'a'
        href = node['href']
        text = node.text.strip
        if href && !href.empty? && !text.empty?
          lines << "[#{text}](#{href})"
        elsif !text.empty?
          lines << text
        end
      when 'img'
        alt = node['alt'] || 'Image'
        src = node['src']
        lines << "![#{alt}](#{src})" if src
      when 'br'
        lines << "\n"
      when 'hr'
        lines << "\n---\n"
      else
        # For other elements, just process children
        node.children.each { |child| process_node(child, lines, list_level) }
      end
    end
  end
  
  def extract_text_content(node)
    # Extract text content while preserving some inline formatting
    text = ""
    node.children.each do |child|
      case child.type
      when Nokogiri::XML::Node::TEXT_NODE
        text += child.text
      when Nokogiri::XML::Node::ELEMENT_NODE
        case child.name.downcase
        when 'strong', 'b'
          text += "**#{child.text.strip}**"
        when 'em', 'i'
          text += "*#{child.text.strip}*"
        when 'code'
          text += "`#{child.text.strip}`"
        when 'a'
          href = child['href']
          link_text = child.text.strip
          if href && !href.empty? && !link_text.empty?
            text += "[#{link_text}](#{href})"
          else
            text += link_text
          end
        when 'br'
          text += "\n"
        else
          text += extract_text_content(child)
        end
      end
    end
    text
  end
  
  def sanitize_filename(text)
    text.gsub(/[<>:\"\/\\|?*]/, '')
      .strip[0..100]
      .gsub(/\s+/, '_') || 'untitled'
  end
end

# Run the scraper
scraper = LinkedInScraper.new(options)
scraper.scrape
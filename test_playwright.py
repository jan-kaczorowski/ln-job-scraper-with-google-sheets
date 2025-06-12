#!/usr/bin/env python3
"""Test if Playwright is working correctly"""

import asyncio
from playwright.async_api import async_playwright

async def test_playwright():
    print("Testing Playwright installation...")
    
    try:
        playwright = await async_playwright().start()
        print("✓ Playwright started successfully")
        
        print("Launching browser...")
        browser = await playwright.chromium.launch(
            headless=False,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        print("✓ Browser launched successfully")
        
        print("Creating new page...")
        page = await browser.new_page()
        print("✓ Page created successfully")
        
        print("Navigating to example.com...")
        await page.goto("https://example.com")
        print("✓ Navigation successful")
        
        print("Waiting 3 seconds...")
        await asyncio.sleep(3)
        
        print("Closing browser...")
        await browser.close()
        print("✓ Browser closed successfully")
        
        await playwright.stop()
        print("✓ Playwright stopped successfully")
        
        print("\nAll tests passed! Playwright is working correctly.")
        
    except Exception as e:
        print(f"\n✗ Error occurred: {type(e).__name__}: {str(e)}")
        print("\nPossible solutions:")
        print("1. Run: playwright install chromium")
        print("2. Check if you have the correct Python version (3.7+)")
        print("3. Try reinstalling playwright: pip uninstall playwright && pip install playwright")

if __name__ == "__main__":
    asyncio.run(test_playwright())
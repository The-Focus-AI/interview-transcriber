import { chromium } from 'playwright';
import { writeFileSync, statSync } from 'fs';
import * as path from 'path';

function toNetscapeCookieFormat(cookies: any[]): string {
  // Netscape header
  let output = '# Netscape HTTP Cookie File\n';
  for (const cookie of cookies) {
    // domain, include initial dot if hostOnly is false
    const domain = cookie.domain.startsWith('.') ? cookie.domain : (cookie.domain || '');
    // TRUE if cookie is valid for subdomains
    const includeSubdomains = cookie.domain && cookie.domain.startsWith('.') ? 'TRUE' : 'FALSE';
    // path
    const path = cookie.path || '/';
    // secure
    const secure = cookie.secure ? 'TRUE' : 'FALSE';
    // expiration (in seconds); 0 for session cookies
    const expires = (cookie.expires && cookie.expires > 0) ? Math.floor(cookie.expires) : 0;
    // name and value
    const name = cookie.name || '';
    const value = cookie.value || '';
    output += `${domain}\t${includeSubdomains}\t${path}\t${secure}\t${expires}\t${name}\t${value}\n`;
  }
  return output;
}

function getCookieAge(cookiePath: string): string {
  try {
    const stats = statSync(cookiePath);
    const ageMs = Date.now() - stats.mtime.getTime();
    const ageMinutes = Math.floor(ageMs / (1000 * 60));
    const ageHours = Math.floor(ageMinutes / 60);
    const ageDays = Math.floor(ageHours / 24);
    
    if (ageDays > 0) {
      return `${ageDays} day(s)`;
    } else if (ageHours > 0) {
      return `${ageHours} hour(s)`;
    } else {
      return `${ageMinutes} minute(s)`;
    }
  } catch {
    return 'unknown';
  }
}

(async () => {
  const headless = (process.env.HEADLESS || 'true').toLowerCase() !== 'false';
  const outputPath = process.env.COOKIE_OUTPUT_PATH || 'cookies.txt';
  
  console.log(`🍪 Starting YouTube cookie extraction...`);
  console.log(`📁 Output path: ${outputPath}`);
  
  // Check if existing cookie file exists and log its age
  try {
    if (require('fs').existsSync(outputPath)) {
      const age = getCookieAge(outputPath);
      console.log(`📅 Existing cookie file age: ${age}`);
    } else {
      console.log(`📅 No existing cookie file found`);
    }
  } catch (error) {
    console.log(`📅 Could not check existing cookie file: ${error}`);
  }

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log(`🌐 Navigating to YouTube...`);
    await page.goto('https://www.youtube.com');
    await page.waitForTimeout(3000);

    console.log(`🔍 Performing search to trigger cookie collection...`);
    // Use the search bar to look up 'gandam style'
    await page.waitForSelector('input[name="search_query"]', { timeout: 10000 });
    await page.fill('input[name="search_query"]', 'gandam style');
    // Click the search button
    await page.click('button[aria-label="Search"]');
    // Wait for search results to appear instead of navigation
    await page.waitForSelector('ytd-item-section-renderer', { timeout: 10000 });
    await page.waitForTimeout(2000);

    const cookies = await context.cookies('https://www.youtube.com');
    console.log(`🍪 Collected ${cookies.length} cookies from YouTube`);
    
    const netscapeCookies = toNetscapeCookieFormat(cookies);
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (dir !== '.') {
      require('fs').mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(outputPath, netscapeCookies);
    console.log(`✅ Cookies written to ${outputPath} in Netscape format`);
    console.log(`📅 Cookie file created at: ${new Date().toISOString()}`);
    
  } catch (error) {
    console.error(`❌ Error during cookie extraction: ${error}`);
    throw error;
  } finally {
    await browser.close();
  }
})(); 

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

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

(async () => {
  const headless = (process.env.HEADLESS || 'true').toLowerCase() !== 'false';
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://www.youtube.com');
  await page.waitForTimeout(3000);

  // Use the search bar to look up 'gandam style'
  await page.waitForSelector('input[name="search_query"]', { timeout: 10000 });
  await page.fill('input[name="search_query"]', 'gandam style');
  // Click the search button
  await page.click('button[aria-label="Search"]');
  // Wait for search results to appear instead of navigation
  await page.waitForSelector('ytd-item-section-renderer', { timeout: 10000 });
  await page.waitForTimeout(2000);

  // Output the HTML to a file for inspection (optional, can be removed later)
  // const html = await page.content();
  // writeFileSync('youtube-home.html', html);
  // console.log('YouTube homepage HTML written to youtube-home.html');

  const cookies = await context.cookies('https://www.youtube.com');
  const netscapeCookies = toNetscapeCookieFormat(cookies);
  
  // Use environment variable for output path, fallback to cookies.txt
  const outputPath = process.env.COOKIE_OUTPUT_PATH || 'cookies.txt';
  writeFileSync(outputPath, netscapeCookies);
  console.log(`Cookies written to ${outputPath} in Netscape format`);
  await browser.close();
})(); 

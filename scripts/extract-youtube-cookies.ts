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
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://www.youtube.com');
  await page.waitForTimeout(5000);
  const cookies = await context.cookies('https://www.youtube.com');
  const netscapeCookies = toNetscapeCookieFormat(cookies);
  writeFileSync('cookies.txt', netscapeCookies);
  console.log('Cookies written to cookies.txt in Netscape format');
  await browser.close();
})(); 
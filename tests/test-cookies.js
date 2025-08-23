#!/usr/bin/env node

// Simple test script to verify cookie functionality
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testCookies() {
  console.log('🧪 Testing cookie functionality...\n');
  
  // Test 1: Check if cookie file exists and show age
  const cookiePaths = ['/data/cookies.txt', './cookies.txt'];
  let cookieFound = false;
  
  for (const cookiePath of cookiePaths) {
    try {
      if (fs.existsSync(cookiePath)) {
        const stats = fs.statSync(cookiePath);
        const ageMs = Date.now() - stats.mtime.getTime();
        const ageMinutes = Math.floor(ageMs / (1000 * 60));
        const ageHours = Math.floor(ageMinutes / 60);
        const ageDays = Math.floor(ageHours / 24);
        
        let ageStr;
        if (ageDays > 0) {
          ageStr = `${ageDays} day(s)`;
        } else if (ageHours > 0) {
          ageStr = `${ageHours} hour(s)`;
        } else {
          ageStr = `${ageMinutes} minute(s)`;
        }
        
        console.log(`✅ Found cookie file: ${cookiePath}`);
        console.log(`📅 Cookie age: ${ageStr}`);
        console.log(`🕐 Last modified: ${stats.mtime.toISOString()}`);
        cookieFound = true;
        break;
      }
    } catch (error) {
      console.log(`❌ Error checking ${cookiePath}: ${error.message}`);
    }
  }
  
  if (!cookieFound) {
    console.log('❌ No cookie file found');
  }
  
  console.log('\n🔧 Environment variables:');
  console.log(`YTDLP_COOKIE_MAX_AGE_MINUTES: ${process.env.YTDLP_COOKIE_MAX_AGE_MINUTES || '60 (default)'}`);
  console.log(`YTDLP_DISABLE_COOKIE_REFRESH: ${process.env.YTDLP_DISABLE_COOKIE_REFRESH || 'false (default)'}`);
  console.log(`COOKIE_OUTPUT_PATH: ${process.env.COOKIE_OUTPUT_PATH || 'cookies.txt (default)'}`);
  
  console.log('\n📋 Test completed!');
}

testCookies().catch(console.error);

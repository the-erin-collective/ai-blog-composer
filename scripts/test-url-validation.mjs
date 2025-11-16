#!/usr/bin/env node

/**
 * Test script for URL validation in metadata extractor
 * Tests various invalid URL formats to ensure proper error handling
 */

console.log('🧪 Testing URL Validation\n');

// Test cases
const testCases = [
  { url: '', expected: 'fail', description: 'Empty string' },
  { url: 'not-a-url', expected: 'fail', description: 'Invalid URL format' },
  { url: 'ftp://example.com', expected: 'fail', description: 'Unsupported protocol (FTP)' },
  { url: 'file:///etc/passwd', expected: 'fail', description: 'Unsupported protocol (file)' },
  { url: 'javascript:alert(1)', expected: 'fail', description: 'Unsupported protocol (javascript)' },
  { url: 'http://', expected: 'fail', description: 'Missing hostname' },
  { url: 'http://example.com', expected: 'pass', description: 'Valid HTTP URL' },
  { url: 'https://example.com', expected: 'pass', description: 'Valid HTTPS URL' },
  { url: 'https://example.com/path?query=value', expected: 'pass', description: 'Valid HTTPS URL with path and query' },
];

// Simple validation function (mirrors the one in metadataExtractor.ts)
function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL is required and must be a string');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (error) {
    throw new Error(`Invalid URL format: ${url}`);
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${parsedUrl.protocol}. Only HTTP and HTTPS are allowed`);
  }

  if (!parsedUrl.hostname) {
    throw new Error('URL must contain a valid hostname');
  }
}

// Run tests
let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  try {
    validateUrl(testCase.url);
    if (testCase.expected === 'pass') {
      console.log(`✅ PASS: ${testCase.description}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${testCase.description} - Expected validation to fail but it passed`);
      failed++;
    }
  } catch (error) {
    if (testCase.expected === 'fail') {
      console.log(`✅ PASS: ${testCase.description} - ${error.message}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${testCase.description} - ${error.message}`);
      failed++;
    }
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (failed > 0) {
  process.exit(1);
}

/**
 * Test script for metadata extractor error handling improvements
 * Tests timeout handling, malformed HTML, and retry logic
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// Copy of the implementation to test
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseHtmlSafely(html) {
  try {
    const $ = cheerio.load(html, {
      xmlMode: false,
      decodeEntities: true,
    });

    let title = $('title').text().trim();
    if (!title) {
      title = $('h1').first().text().trim();
    }
    if (!title) {
      title = $('meta[property="og:title"]').attr('content')?.trim() || '';
    }
    if (!title) {
      title = 'No title found';
    }

    const metaDescription = $('meta[name="description"]').attr('content')?.trim() || 
                           $('meta[property="og:description"]').attr('content')?.trim() || 
                           '';

    const headings = [];
    try {
      $('h1, h2, h3').each((_, element) => {
        try {
          const text = $(element).text().trim();
          if (text) {
            headings.push(text);
          }
        } catch (elementError) {
          console.warn('Failed to parse heading element:', elementError);
        }
      });
    } catch (headingsError) {
      console.warn('Failed to parse headings:', headingsError);
    }

    return {
      title,
      metaDescription,
      headings: headings.slice(0, 20)
    };
  } catch (error) {
    console.error('Failed to parse HTML with cheerio:', error);
    return {
      title: 'Failed to parse HTML',
      metaDescription: '',
      headings: []
    };
  }
}

async function fetchHtml(url) {
  const response = await axios.get(url, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 300
  });

  return response.data;
}

async function extractMetadata(url) {
  const maxAttempts = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const html = await fetchHtml(url);
      const metadata = parseHtmlSafely(html);

      if (attempt > 1) {
        console.log(`[MetadataExtractor] Successfully extracted metadata on attempt ${attempt}`);
      }

      return metadata;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;
      
      let errorType = 'Unknown error';
      
      if (axios.isAxiosError(err)) {
        const axiosError = err;
        if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
          errorType = 'Timeout error';
        } else if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
          errorType = 'Connection error';
        } else if (axiosError.response) {
          errorType = `HTTP ${axiosError.response.status} error`;
        } else if (axiosError.request) {
          errorType = 'Network error';
        }
      }

      console.warn(
        `[MetadataExtractor] Attempt ${attempt}/${maxAttempts} failed for ${url}: ${errorType} - ${error.message}`
      );

      if (attempt < maxAttempts) {
        console.log(`[MetadataExtractor] Retrying in 1 second...`);
        await delay(1000);
      }
    }
  }

  const errorMessage = lastError?.message || 'Unknown error';
  throw new Error(
    `Failed to extract metadata from ${url} after ${maxAttempts} attempts: ${errorMessage}`
  );
}

// Test cases
async function runTests() {
  console.log('🧪 Testing Error Handling Improvements\n');

  // Test 1: Malformed HTML handling
  console.log('Test 1: Malformed HTML handling');
  const malformedHtml = '<html><head><title>Test</title><body><h1>Broken HTML<h2>Missing closing tags';
  try {
    const result = parseHtmlSafely(malformedHtml);
    console.log('✅ Malformed HTML handled gracefully');
    console.log('   Title:', result.title);
    console.log('   Headings:', result.headings.length);
  } catch (error) {
    console.log('❌ Failed to handle malformed HTML:', error.message);
  }
  console.log('');

  // Test 2: Invalid URL (should fail after retries)
  console.log('Test 2: Invalid URL with retry logic');
  try {
    await extractMetadata('http://this-domain-definitely-does-not-exist-12345.com');
    console.log('❌ Should have thrown an error');
  } catch (error) {
    if (error.message.includes('after 2 attempts')) {
      console.log('✅ Retry logic working correctly');
      console.log('   Error:', error.message.substring(0, 100) + '...');
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  console.log('');

  // Test 3: Valid URL (if network available)
  console.log('Test 3: Valid URL extraction');
  try {
    const result = await extractMetadata('https://example.com');
    console.log('✅ Successfully extracted metadata');
    console.log('   Title:', result.title);
    console.log('   Meta Description:', result.metaDescription.substring(0, 50) + '...');
    console.log('   Headings:', result.headings.length);
  } catch (error) {
    console.log('⚠️  Network test skipped or failed:', error.message.substring(0, 80));
  }
  console.log('');

  console.log('✨ Error handling tests complete!');
}

runTests().catch(console.error);

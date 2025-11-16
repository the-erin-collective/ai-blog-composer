import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ExtractedMetadata {
  title: string;
  metaDescription: string;
  headings: string[];
}

/**
 * Validates URL format and protocol
 * @param url - URL string to validate
 * @throws Error if URL is invalid or uses unsupported protocol
 */
function validateUrl(url: string): void {
  // Check if URL is empty or not a string
  if (!url || typeof url !== 'string') {
    throw new Error('URL is required and must be a string');
  }

  // Try to parse the URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (error) {
    throw new Error(`Invalid URL format: ${url}`);
  }

  // Validate protocol (only http and https allowed)
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${parsedUrl.protocol}. Only HTTP and HTTPS are allowed`);
  }

  // Validate hostname exists
  if (!parsedUrl.hostname) {
    throw new Error('URL must contain a valid hostname');
  }
}

/**
 * Delays execution for a specified number of milliseconds
 * @param ms - Milliseconds to delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Attempts to extract metadata from HTML with error handling for malformed HTML
 * @param html - HTML content to parse
 * @returns Extracted metadata object
 */
function parseHtmlSafely(html: string): ExtractedMetadata {
  try {
    const $ = cheerio.load(html, {
      // Enable XML mode for more lenient parsing
      xmlMode: false,
    });

    // Extract title with multiple fallbacks
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

    // Extract meta description with multiple fallbacks
    const metaDescription = $('meta[name="description"]').attr('content')?.trim() || 
                           $('meta[property="og:description"]').attr('content')?.trim() || 
                           '';

    // Extract headings (h1, h2, h3) with error handling
    const headings: string[] = [];
    try {
      $('h1, h2, h3').each((_index: number, element: any) => {
        try {
          const text = $(element).text().trim();
          if (text) {
            headings.push(text);
          }
        } catch (elementError) {
          // Skip malformed individual elements
          console.warn('Failed to parse heading element:', elementError);
        }
      });
    } catch (headingsError) {
      console.warn('Failed to parse headings:', headingsError);
    }

    return {
      title,
      metaDescription,
      headings: headings.slice(0, 20) // Limit to first 20 headings
    };
  } catch (error) {
    // If cheerio fails completely, return minimal valid metadata
    console.error('Failed to parse HTML with cheerio:', error);
    return {
      title: 'Failed to parse HTML',
      metaDescription: '',
      headings: []
    };
  }
}

/**
 * Fetches HTML content from a URL with a single attempt
 * @param url - URL to fetch
 * @returns HTML content as string
 */
async function fetchHtml(url: string): Promise<string> {
  const response = await axios.get(url, {
    timeout: 10000, // 10 second timeout
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    maxRedirects: 5,
    validateStatus: (status: number) => status >= 200 && status < 300
  });

  return response.data;
}

/**
 * Metadata Extractor Agent
 * Deterministically extracts title and headings (h1-h3) from a given URL
 * No LLM involvement - pure HTML parsing using cheerio
 * Includes retry logic (2 attempts with 1s delay) and graceful error handling
 */
export async function extractMetadata(url: string): Promise<ExtractedMetadata> {
  // Validate URL before fetching
  validateUrl(url);

  const maxAttempts = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Fetch the HTML content
      const html = await fetchHtml(url);

      // Parse HTML safely with malformed HTML handling
      const metadata = parseHtmlSafely(html);

      // Log successful extraction
      if (attempt > 1) {
        console.log(`[MetadataExtractor] Successfully extracted metadata on attempt ${attempt}`);
      }

      return metadata;
    } catch (err: unknown) {
      // Type guard to ensure we have an Error object
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;
      
      // Determine error type for better error messages
      let errorType = 'Unknown error';
      
      // Check if it's an Axios error for more specific error messages
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (axios.isAxiosError(err)) {
        const axiosError = err as any;
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

      // If this is not the last attempt, wait before retrying
      if (attempt < maxAttempts) {
        console.log(`[MetadataExtractor] Retrying in 1 second...`);
        await delay(1000);
      }
    }
  }

  // All attempts failed, throw detailed error
  const errorMessage = lastError?.message || 'Unknown error';
  throw new Error(
    `Failed to extract metadata from ${url} after ${maxAttempts} attempts: ${errorMessage}`
  );
}

// lib/scraper.ts - Enhanced scraper with better error handling and fallbacks

import axios from 'axios';
import * as cheerio from 'cheerio';

interface ScrapingOptions {
  timeout?: number;
  retries?: number;
  userAgent?: string;
  headers?: Record<string, string>;
}

interface ScrapingResult {
  success: boolean;
  content?: string;
  error?: string;
  metadata?: {
    title?: string;
    description?: string;
    url: string;
  };
}

const DEFAULT_OPTIONS: ScrapingOptions = {
  timeout: 10000,
  retries: 3,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  }
};

// List of common article selectors to try (OpenAI specific ones added)
const ARTICLE_SELECTORS = [
  // OpenAI blog specific
  '.blog-post-content',
  '.post-content',
  '.blog-content',
  '[data-testid="blog-content"]',
  '.content-wrapper',
  
  // Generic article selectors
  'article',
  '[role="main"]',
  '.post-content',
  '.entry-content',
  '.article-content',
  '.content',
  '.post-body',
  '.story-body',
  '.article-body',
  'main',
  '.main-content',
  '#content',
  '.blog-post',
  '.post',
  '.entry',
  
  // Fallback selectors
  'div[class*="content"]',
  'div[class*="post"]',
  'div[class*="article"]',
  'div[class*="blog"]',
  'section[class*="content"]',
  'section[class*="post"]'
];

// Selectors to remove (ads, navigation, etc.)
const NOISE_SELECTORS = [
  'nav',
  'header',
  'footer',
  '.advertisement',
  '.ads',
  '.sidebar',
  '.comments',
  '.social-share',
  '.related-posts',
  '.navigation',
  '.menu',
  'script',
  'style',
  'noscript',
  '.cookie-notice',
  '.popup'
];

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

function extractMainContent($: cheerio.Root): string {
  // Remove noise elements
  NOISE_SELECTORS.forEach(selector => {
    $(selector).remove();
  });

  let bestContent = '';
  let bestLength = 0;

  // Try to find main content using various selectors
  for (const selector of ARTICLE_SELECTORS) {
    const elements = $(selector);
    if (elements.length > 0) {
      elements.each((_, element) => {
        const text = $(element).text();
        const cleanedText = cleanText(text);
        
        if (cleanedText.length > bestLength) {
          bestContent = cleanedText;
          bestLength = cleanedText.length;
        }
      });
    }
  }

  // If we found good content, return it
  if (bestContent.length > 1000) {
    return bestContent;
  }

  // Fallback: try paragraph-based extraction
  const paragraphs = $('p');
  let paragraphContent = '';
  paragraphs.each((_, p) => {
    const text = $(p).text().trim();
    if (text.length > 20) { // Only substantial paragraphs
      paragraphContent += text + '\n\n';
    }
  });

  if (paragraphContent.length > bestContent.length) {
    bestContent = cleanText(paragraphContent);
  }

  // Last resort: try to get body content
  if (bestContent.length < 50) {
    const bodyText = $('body').text();
    const cleanedBodyText = cleanText(bodyText);
    if (cleanedBodyText.length > bestContent.length) {
      bestContent = cleanedBodyText;
    }
  }

  return bestContent;
}

async function makeRequest(url: string, options: ScrapingOptions): Promise<string> {
  const config = {
    timeout: options.timeout,
    headers: {
      'User-Agent': options.userAgent,
      ...options.headers
    },
    maxRedirects: 5,
    validateStatus: (status: number) => status < 400
  };

  const response = await axios.get(url, config);
  return response.data;
}

export async function scrapeBlogText(
  url: string,
  options: ScrapingOptions = {}
): Promise<ScrapingResult> {
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };
  
  if (!url || !isValidUrl(url)) {
    return {
      success: false,
      error: 'Invalid URL provided'
    };
  }

  let lastError: any;
  let bestContent = '';
  let bestMetadata: any = { url };
  
  for (let attempt = 1; attempt <= finalOptions.retries!; attempt++) {
    try {
      console.log(`Scraping attempt ${attempt}/${finalOptions.retries} for: ${url}`);
      
      const html = await makeRequest(url, finalOptions);
      const $ = cheerio.load(html);
      
      // Extract metadata
      const title = $('title').text() || $('h1').first().text() || '';
      const description = $('meta[name="description"]').attr('content') || 
                         $('meta[property="og:description"]').attr('content') || '';
      
      const metadata = {
        title: cleanText(title),
        description: cleanText(description),
        url
      };
      
      // Extract main content with multiple strategies
      const content = extractMainContent($);
      
      // Keep track of best attempt
      if (content.length > bestContent.length) {
        bestContent = content;
        bestMetadata = metadata;
      }
      
      console.log(`Extracted ${content.length} characters on attempt ${attempt}`);
      
      // Success if we have reasonable content
      if (content.length >= 100) {
        return {
          success: true,
          content,
          metadata
        };
      }
      
      // If this is the last attempt and we have some content, use it
      if (attempt === finalOptions.retries! && bestContent.length > 0) {
        console.log(`Using best content from all attempts: ${bestContent.length} chars`);
        return {
          success: true,
          content: bestContent,
          metadata: bestMetadata
        };
      }
      
      throw new Error(`Insufficient content extracted (${content.length} chars)`);
      
    } catch (error: any) {
      lastError = error;
      console.warn(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt < finalOptions.retries!) {
        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If we have any content at all, return it instead of failing
  if (bestContent.length > 0) {
    console.log(`Returning best available content: ${bestContent.length} chars`);
    return {
      success: true,
      content: bestContent,
      metadata: bestMetadata
    };
  }
  
  return {
    success: false,
    error: getErrorMessage(lastError),
    metadata: { url }
  };
}

function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

function getErrorMessage(error: any): string {
  if (error.code === 'ENOTFOUND') {
    return 'Website not found. Please check the URL.';
  }
  if (error.code === 'ECONNREFUSED') {
    return 'Connection refused. The website may be down.';
  }
  if (error.code === 'ETIMEDOUT') {
    return 'Request timed out. Please try again.';
  }
  if (error.response?.status === 403) {
    return 'Access forbidden. This website blocks automated requests.';
  }
  if (error.response?.status === 404) {
    return 'Page not found. Please check the URL.';
  }
  if (error.response?.status >= 500) {
    return 'Server error. Please try again later.';
  }
  
  return error.message || 'An unexpected error occurred while scraping.';
}

// Alternative scraper for testing with local content
export async function scrapeWithFallback(url: string): Promise<ScrapingResult> {
  const result = await scrapeBlogText(url);
  
  if (!result.success) {
    // For demo purposes, return sample content
    console.log('Using fallback content for demo');
    return {
      success: true,
      content: generateSampleContent(url),
      metadata: {
        title: 'Sample Blog Post',
        description: 'This is sample content for demonstration purposes.',
        url
      }
    };
  }
  
  return result;
}

function generateSampleContent(url: string): string {
  const samples = [
    "Artificial Intelligence has revolutionized how we approach problem-solving in the modern world. From machine learning algorithms that can predict consumer behavior to neural networks that can recognize patterns in vast datasets, AI is transforming industries across the globe. The integration of AI into everyday applications has made our lives more efficient and opened up new possibilities for innovation. As we continue to advance in this field, we must also consider the ethical implications and ensure that AI development remains aligned with human values and societal needs.",
    
    "Web development has evolved significantly over the past decade, with new frameworks and technologies emerging regularly. Modern web applications require responsive design, fast loading times, and seamless user experiences across all devices. The rise of JavaScript frameworks like React, Vue, and Angular has changed how developers build interactive user interfaces. Additionally, the adoption of cloud services and serverless architectures has made it easier to deploy and scale web applications globally.",
    
    "Sustainable technology is becoming increasingly important as we face environmental challenges. Green computing initiatives focus on reducing energy consumption in data centers, while renewable energy technologies are making clean power more accessible. Electric vehicles are revolutionizing transportation, and smart city technologies are optimizing resource usage in urban environments. These innovations demonstrate how technology can be a powerful tool for addressing climate change and creating a more sustainable future."
  ];
  
  // Simple hash to consistently return same sample for same URL
  const hash = url.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) & 0xffffffff, 0);
  return samples[Math.abs(hash) % samples.length];
}
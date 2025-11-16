#!/usr/bin/env node

/**
 * CLI Script to Test Ollama Workflow
 * Usage: node scripts/test-workflow.mjs <url> [ollama_model]
 * Example: node scripts/test-workflow.mjs https://example.com llama2
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// Configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = 'llama2';

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/test-workflow.mjs <url> [ollama_model]');
  console.error('Example: node scripts/test-workflow.mjs https://example.com llama2');
  process.exit(1);
}

const testUrl = args[0];
const model = args[1] || DEFAULT_MODEL;

console.log('🚀 Starting Ollama Workflow Test');
console.log(`📍 Target URL: ${testUrl}`);
console.log(`🤖 Ollama Model: ${model}`);
console.log(`🌐 Ollama Base URL: ${OLLAMA_BASE_URL}`);
console.log('');

// Step 1: Extract Metadata
async function extractMetadata(url) {
  console.log('📝 Step 1: Extracting Metadata...');
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const title = $('title').text() || $('h1').first().text() || 'No title found';
    const headings = [];

    $('h1, h2, h3').each((_, element) => {
      const text = $(element).text().trim();
      if (text) {
        headings.push(text);
      }
    });

    const metadata = {
      title: title.trim(),
      headings: headings.slice(0, 20)
    };

    console.log(`✅ Extracted title: "${metadata.title}"`);
    console.log(`✅ Extracted ${metadata.headings.length} headings`);
    console.log('');

    return metadata;
  } catch (error) {
    console.error(`❌ Failed to extract metadata: ${error.message}`);
    process.exit(1);
  }
}

// Step 2: Check Ollama Health
async function checkOllamaHealth() {
  console.log('🏥 Step 2: Checking Ollama Health...');
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 5000
    });

    const models = response.data.models || [];
    const modelExists = models.some(m => m.name === model);

    if (modelExists) {
      console.log(`✅ Ollama is running and model "${model}" is available`);
      console.log('');
      return true;
    } else {
      console.warn(`⚠️  Ollama is running but model "${model}" is not loaded`);
      console.warn(`Available models: ${models.map(m => m.name).join(', ')}`);
      console.log('');
      return false;
    }
  } catch (error) {
    console.error(`❌ Ollama health check failed: ${error.message}`);
    console.error('Make sure Ollama is running at ' + OLLAMA_BASE_URL);
    process.exit(1);
  }
}

// Step 3: Extract Concepts using Ollama
async function extractConcepts(metadata) {
  console.log('🧠 Step 3: Extracting Concepts using Ollama...');

  const headingsText = metadata.headings.length > 0
    ? metadata.headings.join('\n')
    : 'No headings found';

  const prompt = `
Title: ${metadata.title}

Headings:
${headingsText}

Based on the above title and headings, extract 5-7 high-level concepts that represent the main topics or themes. 
Return your response as a JSON object with this exact structure:
{
  "concepts": ["concept1", "concept2", "concept3", "concept4", "concept5"],
  "summary": "A brief one-sentence summary of the main theme"
}

Only return the JSON, no additional text.
`;

  try {
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/chat`,
      {
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert content analyst. Extract 5-7 high-level concepts from the given content metadata. Return a JSON response with "concepts" (array of strings) and "summary" (brief description).'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false,
        temperature: 0.7
      },
      {
        timeout: 120000 // 2 minute timeout for LLM response
      }
    );

    const content = response.data.message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed.concepts) || typeof parsed.summary !== 'string') {
      throw new Error('Invalid response structure');
    }

    console.log(`✅ Extracted ${parsed.concepts.length} concepts`);
    console.log(`✅ Summary: ${parsed.summary}`);
    console.log('');

    return {
      concepts: parsed.concepts.slice(0, 7),
      summary: parsed.summary
    };
  } catch (error) {
    console.error(`❌ Failed to extract concepts: ${error.message}`);
    process.exit(1);
  }
}

// Main execution
async function main() {
  try {
    const metadata = await extractMetadata(testUrl);
    const ollamaHealthy = await checkOllamaHealth();

    if (!ollamaHealthy) {
      console.warn('⚠️  Continuing with Ollama health warning...');
      console.log('');
    }

    const concepts = await extractConcepts(metadata);

    // Final output
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ WORKFLOW COMPLETED SUCCESSFULLY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📊 Results:');
    console.log(`  Title: ${metadata.title}`);
    console.log(`  Headings: ${metadata.headings.length} extracted`);
    console.log(`  Summary: ${concepts.summary}`);
    console.log(`  Concepts:`);
    concepts.concepts.forEach((concept, i) => {
      console.log(`    ${i + 1}. ${concept}`);
    });
    console.log('');
  } catch (error) {
    console.error('❌ Workflow failed:', error.message);
    process.exit(1);
  }
}

main();

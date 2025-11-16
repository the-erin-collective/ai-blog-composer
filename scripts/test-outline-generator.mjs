#!/usr/bin/env node

/**
 * CLI Script to Test Outline Generator
 * Usage: node scripts/test-outline-generator.mjs [ollama_model]
 * Example: node scripts/test-outline-generator.mjs llama2
 */

import axios from 'axios';

// Configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = 'llama2';

// Parse command line arguments
const args = process.argv.slice(2);
const model = args[0] || DEFAULT_MODEL;

console.log('🚀 Starting Outline Generator Test');
console.log(`🤖 Ollama Model: ${model}`);
console.log(`🌐 Ollama Base URL: ${OLLAMA_BASE_URL}`);
console.log('');

// Test data: sample concepts from a hypothetical article
const testConcepts = [
  'Web development best practices',
  'Modern JavaScript frameworks',
  'Performance optimization techniques',
  'Responsive design principles',
  'SEO fundamentals'
];

// Check Ollama Health
async function checkOllamaHealth() {
  console.log('🏥 Checking Ollama Health...');
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

// Generate Outline using Ollama
async function generateOutline(concepts) {
  console.log('📝 Generating Article Outline...');
  console.log(`Input concepts: ${concepts.length}`);
  concepts.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  console.log('');

  const conceptsList = concepts.map((c, i) => `${i + 1}. ${c}`).join('\n');

  const prompt = `
Create a comprehensive article outline based on the following concepts:

${conceptsList}

Requirements:
- Create an engaging, SEO-optimized article title
- Include 2-3 key points for the introduction
- Create 3-5 main sections with descriptive headings
- Each section should have 3-5 key points to cover
- Include 2-3 key points for the conclusion
- Follow proper heading hierarchy (H1 for title, H2 for sections)
- Incorporate SEO best practices (keyword placement, logical flow)
- Ensure comprehensive coverage of all concepts

Return your response as a JSON object with this exact structure:
{
  "title": "Article Title Here",
  "introduction": [
    "Introduction point 1",
    "Introduction point 2",
    "Introduction point 3"
  ],
  "sections": [
    {
      "heading": "Section 1 Heading",
      "keyPoints": [
        "Key point 1",
        "Key point 2",
        "Key point 3"
      ]
    },
    {
      "heading": "Section 2 Heading",
      "keyPoints": [
        "Key point 1",
        "Key point 2",
        "Key point 3"
      ]
    }
  ],
  "conclusion": [
    "Conclusion point 1",
    "Conclusion point 2"
  ]
}

Only return the JSON, no additional text.
`;

  try {
    console.log('⏳ Waiting for Ollama response (this may take 30-60 seconds)...');
    
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/chat`,
      {
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert content strategist and SEO specialist. Create structured article outlines that follow SEO best practices, proper heading hierarchy, and logical flow. Return responses in valid JSON format only.'
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
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!parsed.title || typeof parsed.title !== 'string') {
      throw new Error('Outline must have a valid title');
    }

    if (!Array.isArray(parsed.introduction) || parsed.introduction.length === 0) {
      throw new Error('Outline must have an introduction with at least one point');
    }

    if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      throw new Error('Outline must have at least one section');
    }

    if (!Array.isArray(parsed.conclusion) || parsed.conclusion.length === 0) {
      throw new Error('Outline must have a conclusion with at least one point');
    }

    // Validate each section
    for (const section of parsed.sections) {
      if (!section.heading || typeof section.heading !== 'string') {
        throw new Error('Each section must have a valid heading');
      }

      if (!Array.isArray(section.keyPoints) || section.keyPoints.length === 0) {
        throw new Error('Each section must have at least one key point');
      }
    }

    console.log('✅ Outline generated and validated successfully');
    console.log('');

    return parsed;
  } catch (error) {
    console.error(`❌ Failed to generate outline: ${error.message}`);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Main execution
async function main() {
  try {
    const ollamaHealthy = await checkOllamaHealth();

    if (!ollamaHealthy) {
      console.warn('⚠️  Continuing with Ollama health warning...');
      console.log('');
    }

    const outline = await generateOutline(testConcepts);

    // Display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ OUTLINE GENERATION COMPLETED SUCCESSFULLY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`📰 Title: ${outline.title}`);
    console.log('');
    console.log('📖 Introduction:');
    outline.introduction.forEach((point, i) => {
      console.log(`  ${i + 1}. ${point}`);
    });
    console.log('');
    console.log('📑 Sections:');
    outline.sections.forEach((section, i) => {
      console.log(`  ${i + 1}. ${section.heading}`);
      section.keyPoints.forEach((point, j) => {
        console.log(`     ${j + 1}. ${point}`);
      });
      console.log('');
    });
    console.log('🎯 Conclusion:');
    outline.conclusion.forEach((point, i) => {
      console.log(`  ${i + 1}. ${point}`);
    });
    console.log('');
    console.log('✅ All validation checks passed:');
    console.log('  ✓ Title present');
    console.log(`  ✓ Introduction has ${outline.introduction.length} points`);
    console.log(`  ✓ ${outline.sections.length} sections with proper structure`);
    console.log(`  ✓ Conclusion has ${outline.conclusion.length} points`);
    console.log('');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();

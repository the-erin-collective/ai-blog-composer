#!/usr/bin/env node

/**
 * CLI Script to Test Draft Generator
 * Usage: node scripts/test-draft-generator.mjs [ollama_model]
 * Example: node scripts/test-draft-generator.mjs llama2
 */

import axios from 'axios';

// Configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = 'llama2';

// Parse command line arguments
const args = process.argv.slice(2);
const model = args[0] || DEFAULT_MODEL;

console.log('🚀 Starting Draft Generator Test');
console.log(`🤖 Ollama Model: ${model}`);
console.log(`🌐 Ollama Base URL: ${OLLAMA_BASE_URL}`);
console.log('');

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

async function testDraftGenerator() {

  // Sample outline (from outline generator output)
  const sampleOutline = {
    title: "The Future of Artificial Intelligence in Healthcare",
    introduction: [
      "Overview of AI's growing role in healthcare",
      "Key benefits and transformative potential",
      "Current state of AI adoption in medical settings"
    ],
    sections: [
      {
        heading: "AI-Powered Diagnostic Tools",
        keyPoints: [
          "Machine learning algorithms for disease detection",
          "Image analysis and radiology applications",
          "Early detection and accuracy improvements"
        ]
      },
      {
        heading: "Personalized Treatment Plans",
        keyPoints: [
          "AI-driven patient data analysis",
          "Customized medication and therapy recommendations",
          "Predictive analytics for treatment outcomes"
        ]
      },
      {
        heading: "Challenges and Ethical Considerations",
        keyPoints: [
          "Data privacy and security concerns",
          "Bias in AI algorithms",
          "Regulatory and compliance requirements"
        ]
      }
    ],
    conclusion: [
      "Summary of AI's transformative impact",
      "Future outlook and emerging trends"
    ]
  };

  console.log('📝 Generating Article Draft...');
  console.log(`Outline title: ${sampleOutline.title}`);
  console.log('');

  // Format sections for the prompt
  const sectionsText = sampleOutline.sections
    .map((section, index) => {
      const keyPointsList = section.keyPoints.map(point => `  - ${point}`).join('\n');
      return `Section ${index + 1}: ${section.heading}\nKey points to cover:\n${keyPointsList}`;
    })
    .join('\n\n');

  const tone = 'Professional and informative';

  const prompt = `
Write a complete, high-quality article based on the following outline:

TITLE: ${sampleOutline.title}

INTRODUCTION:
${sampleOutline.introduction.map(point => `- ${point}`).join('\n')}

MAIN SECTIONS:
${sectionsText}

CONCLUSION:
${sampleOutline.conclusion.map(point => `- ${point}`).join('\n')}

Tone and Style: ${tone}

Requirements:
- Write a complete article with introduction, body sections, and conclusion
- Each section should have 2-4 well-developed paragraphs (150-250 words per section)
- Maintain consistent tone and style throughout
- Use clear, engaging language that flows naturally
- Ensure the content is original and distinct from any source material
- Target a minimum of 800 words total
- Create an SEO-optimized meta description (150-160 characters)
- Follow the outline structure closely but expand with rich detail and examples
- Use transitions between sections for smooth flow
- Write in a way that provides value and insight to readers

Return your response as a JSON object with this exact structure:
{
  "title": "Article Title Here",
  "metaDescription": "Compelling meta description for SEO (150-160 characters)",
  "bodyParagraphs": [
    "Introduction paragraph 1...",
    "Introduction paragraph 2...",
    "Section 1 paragraph 1...",
    "Section 1 paragraph 2...",
    "Section 2 paragraph 1...",
    "Section 2 paragraph 2...",
    "Conclusion paragraph 1...",
    "Conclusion paragraph 2..."
  ]
}

Important: Each paragraph should be a complete, well-developed paragraph (3-6 sentences). The bodyParagraphs array should contain ALL paragraphs in order from introduction through conclusion.

Only return the JSON, no additional text.
`;

  try {
    console.log('⏳ Waiting for Ollama response (this may take 60-120 seconds)...');
    
    const startTime = Date.now();
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/chat`,
      {
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert content writer specializing in creating high-quality, original, SEO-optimized articles. Write engaging, well-structured content that maintains consistent tone and style throughout. Ensure all content is structurally and conceptually distinct from any source material. Return responses in valid JSON format only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false,
        temperature: 0.8
      },
      {
        timeout: 180000 // 3 minute timeout for LLM response
      }
    );

    const content = response.data.message.content;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const draft = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!draft.title || typeof draft.title !== 'string' || draft.title.trim().length === 0) {
      throw new Error('Draft must have a valid title');
    }

    if (!draft.metaDescription || typeof draft.metaDescription !== 'string' || draft.metaDescription.trim().length === 0) {
      throw new Error('Draft must have a valid meta description');
    }

    if (!Array.isArray(draft.bodyParagraphs) || draft.bodyParagraphs.length === 0) {
      throw new Error('Draft must have at least one body paragraph');
    }

    // Validate each paragraph
    for (let i = 0; i < draft.bodyParagraphs.length; i++) {
      const paragraph = draft.bodyParagraphs[i];
      if (typeof paragraph !== 'string' || paragraph.trim().length === 0) {
        throw new Error(`Body paragraph at index ${i} must be a non-empty string`);
      }
    }

    // Calculate word count
    const allText = draft.bodyParagraphs.join(' ');
    const words = allText.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    // Validate minimum word count (500 words)
    if (wordCount < 500) {
      throw new Error(`Draft must have at least 500 words, but only has ${wordCount} words`);
    }

    console.log('✅ Draft generated and validated successfully');
    console.log('');

    // Display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ DRAFT GENERATION COMPLETED SUCCESSFULLY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`📰 Title: ${draft.title}`);
    console.log('');
    console.log(`📝 Meta Description: ${draft.metaDescription}`);
    console.log('');
    console.log(`📊 Statistics:`);
    console.log(`  • Duration: ${duration}s`);
    console.log(`  • Word Count: ${wordCount}`);
    console.log(`  • Number of Paragraphs: ${draft.bodyParagraphs.length}`);
    console.log('');
    console.log('📖 First Paragraph Preview:');
    console.log(draft.bodyParagraphs[0].substring(0, 300) + '...');
    console.log('');
    console.log('✅ All validation checks passed:');
    console.log('  ✓ Title present');
    console.log('  ✓ Meta description present');
    console.log(`  ✓ ${draft.bodyParagraphs.length} body paragraphs`);
    console.log(`  ✓ Word count: ${wordCount} words`);
    
    if (wordCount < 500) {
      console.log(`  ⚠️  Warning: Word count (${wordCount}) is below minimum requirement of 500 words`);
    } else {
      console.log(`  ✓ Word count meets minimum requirement (${wordCount} >= 500)`);
    }
    console.log('');

  } catch (error) {
    console.error(`❌ Failed to generate draft: ${error.message}`);
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

    await testDraftGenerator();

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();

import { OllamaClient, OllamaMessage } from './ollamaClient';
import { OutlineOutput } from './outlineGenerator';

/**
 * Input interface for draft generation
 * Contains the outline structure and optional tone guidance
 */
export interface DraftInput {
  outline: OutlineOutput;
  tone?: string;
}

/**
 * Output interface for generated draft
 * Contains the complete article with title, meta description, body paragraphs, and word count
 */
export interface DraftOutput {
  title: string;
  metaDescription: string;
  bodyParagraphs: string[];
  wordCount: number;
}

/**
 * Draft Generator Agent
 * Uses Ollama LLM to generate complete article drafts from structured outlines
 * Produces high-quality, original long-form content with consistent tone and style
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
export class DraftGenerator {
  private ollamaClient: OllamaClient;

  constructor(ollamaClient: OllamaClient) {
    this.ollamaClient = ollamaClient;
  }

  /**
   * Generate a complete article draft from a structured outline
   * @param input - Contains outline and optional tone guidance
   * @returns Complete draft with title, meta description, body paragraphs, and word count
   */
  async generateDraft(input: DraftInput): Promise<DraftOutput> {
    const prompt = this.buildPrompt(input);

    const messages: OllamaMessage[] = [
      {
        role: 'system',
        content: 'You are an expert content writer specializing in creating high-quality, original, SEO-optimized articles. Write engaging, well-structured content that maintains consistent tone and style throughout. Ensure all content is structurally and conceptually distinct from any source material. Return responses in valid JSON format only.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    try {
      const response = await this.ollamaClient.chat(messages);
      return this.parseResponse(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to generate draft: ${errorMessage}`);
    }
  }

  /**
   * Build the prompt for draft generation
   * Incorporates outline structure and tone guidance
   */
  private buildPrompt(input: DraftInput): string {
    const { outline, tone } = input;

    // Format sections for the prompt
    const sectionsText = outline.sections
      .map((section, index) => {
        const keyPointsList = section.keyPoints.map(point => `  - ${point}`).join('\n');
        return `Section ${index + 1}: ${section.heading}\nKey points to cover:\n${keyPointsList}`;
      })
      .join('\n\n');

    const toneGuidance = tone 
      ? `\nTone and Style: ${tone}\n`
      : '\nTone and Style: Professional, engaging, and informative\n';

    return `
Write a complete, high-quality article based on the following outline:

TITLE: ${outline.title}

INTRODUCTION:
${outline.introduction.map(point => `- ${point}`).join('\n')}

MAIN SECTIONS:
${sectionsText}

CONCLUSION:
${outline.conclusion.map(point => `- ${point}`).join('\n')}
${toneGuidance}
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
  }

  /**
   * Parse the LLM response and extract structured draft
   * Validates the response structure and calculates word count
   */
  private parseResponse(response: string): DraftOutput {
    try {
      // Extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Calculate word count first (needed for validation)
      const wordCount = this.calculateWordCount(parsed.bodyParagraphs || []);

      // Validate the response structure (includes word count check)
      this.validateDraft(parsed);

      return {
        title: parsed.title,
        metaDescription: parsed.metaDescription,
        bodyParagraphs: parsed.bodyParagraphs,
        wordCount
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse draft response: ${errorMessage}. Raw response: ${response.substring(0, 200)}...`);
    }
  }

  /**
   * Validate that the draft has the required structure
   * Ensures title, meta description, and body paragraphs are present
   * Verifies minimum word count requirement (500 words)
   * Requirements: 6.1
   */
  private validateDraft(draft: any): void {
    // Check required fields exist
    if (!draft.title || typeof draft.title !== 'string' || draft.title.trim().length === 0) {
      throw new Error('Draft must have a valid title');
    }

    if (!draft.metaDescription || typeof draft.metaDescription !== 'string' || draft.metaDescription.trim().length === 0) {
      throw new Error('Draft must have a valid meta description');
    }

    if (!Array.isArray(draft.bodyParagraphs) || draft.bodyParagraphs.length === 0) {
      throw new Error('Draft must have at least one body paragraph');
    }

    // Validate each paragraph is a non-empty string
    for (let i = 0; i < draft.bodyParagraphs.length; i++) {
      const paragraph = draft.bodyParagraphs[i];
      if (typeof paragraph !== 'string' || paragraph.trim().length === 0) {
        throw new Error(`Body paragraph at index ${i} must be a non-empty string`);
      }
    }

    // Verify minimum word count (500 words)
    const wordCount = this.calculateWordCount(draft.bodyParagraphs);
    if (wordCount < 500) {
      throw new Error(`Draft must have at least 500 words, but only has ${wordCount} words`);
    }
  }

  /**
   * Calculate total word count from body paragraphs
   * @param bodyParagraphs - Array of paragraph strings
   * @returns Total word count
   */
  private calculateWordCount(bodyParagraphs: string[]): number {
    const allText = bodyParagraphs.join(' ');
    // Split by whitespace and filter out empty strings
    const words = allText.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length;
  }
}

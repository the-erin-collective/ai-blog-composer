import { OllamaClient, OllamaMessage } from './ollamaClient';

/**
 * Input interface for outline generation
 * Contains approved concepts from the metadata summarizer
 */
export interface OutlineInput {
  concepts: string[];
  seoGuidelines?: string;
}

/**
 * Section structure for the article outline
 */
export interface OutlineSection {
  heading: string;
  keyPoints: string[];
}

/**
 * Output interface for generated outline
 * Structured outline with introduction, sections, and conclusion
 */
export interface OutlineOutput {
  title: string;
  introduction: string[];
  sections: OutlineSection[];
  conclusion: string[];
}

/**
 * Outline Generator Agent
 * Uses Ollama LLM to generate structured article outlines from approved concepts
 * Implements SEO best practices and proper heading hierarchy
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export class OutlineGenerator {
  private ollamaClient: OllamaClient;

  constructor(ollamaClient: OllamaClient) {
    this.ollamaClient = ollamaClient;
  }

  /**
   * Generate a structured article outline from approved concepts
   * @param input - Contains concepts and optional SEO guidelines
   * @returns Structured outline with title, introduction, sections, and conclusion
   */
  async generateOutline(input: OutlineInput): Promise<OutlineOutput> {
    const prompt = this.buildPrompt(input);

    const messages: OllamaMessage[] = [
      {
        role: 'system',
        content: 'You are an expert content strategist and SEO specialist. Create structured article outlines that follow SEO best practices, proper heading hierarchy, and logical flow. Return responses in valid JSON format only.'
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
      throw new Error(`Failed to generate outline: ${errorMessage}`);
    }
  }

  /**
   * Build the prompt for outline generation
   * Incorporates concepts and SEO guidelines
   */
  private buildPrompt(input: OutlineInput): string {
    const conceptsList = input.concepts.map((c, i) => `${i + 1}. ${c}`).join('\n');
    
    const seoSection = input.seoGuidelines 
      ? `\nSEO Guidelines:\n${input.seoGuidelines}\n`
      : '';

    return `
Create a comprehensive article outline based on the following concepts:

${conceptsList}
${seoSection}
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
  }

  /**
   * Parse the LLM response and extract structured outline
   * Validates the response structure and ensures all required fields are present
   */
  private parseResponse(response: string): OutlineOutput {
    try {
      // Extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate the response structure
      this.validateOutline(parsed);

      return {
        title: parsed.title,
        introduction: parsed.introduction,
        sections: parsed.sections,
        conclusion: parsed.conclusion
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse outline response: ${errorMessage}. Raw response: ${response}`);
    }
  }

  /**
   * Validate that the outline has the required structure
   * Ensures introduction, sections, and conclusion are present
   * Requirements: 5.1, 5.4
   */
  private validateOutline(outline: any): void {
    // Check required fields exist
    if (!outline.title || typeof outline.title !== 'string') {
      throw new Error('Outline must have a valid title');
    }

    if (!Array.isArray(outline.introduction) || outline.introduction.length === 0) {
      throw new Error('Outline must have an introduction with at least one point');
    }

    if (!Array.isArray(outline.sections) || outline.sections.length === 0) {
      throw new Error('Outline must have at least one section');
    }

    if (!Array.isArray(outline.conclusion) || outline.conclusion.length === 0) {
      throw new Error('Outline must have a conclusion with at least one point');
    }

    // Validate each section has proper structure
    for (const section of outline.sections) {
      if (!section.heading || typeof section.heading !== 'string') {
        throw new Error('Each section must have a valid heading');
      }

      if (!Array.isArray(section.keyPoints) || section.keyPoints.length === 0) {
        throw new Error('Each section must have at least one key point');
      }
    }
  }
}

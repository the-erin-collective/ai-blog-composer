import { LLMClient, LLMMessage } from './llmClient';

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
 * Uses LLM to generate structured article outlines from approved concepts
 * Implements SEO best practices and proper heading hierarchy
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export class OutlineGenerator {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Generate a structured article outline from approved concepts
   * @param input - Contains concepts and optional SEO guidelines
   * @returns Structured outline with title, introduction, sections, and conclusion
   */
  async generateOutline(input: OutlineInput): Promise<OutlineOutput> {
    const prompt = this.buildPrompt(input);

    const messages: LLMMessage[] = [
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
      const response = await this.llmClient.chat(messages);
      return this.parseResponse(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Try once more with error context
      try {
        const retryMessages: LLMMessage[] = [
          ...messages,
          {
            role: 'assistant',
            content: `I encountered an error while trying to generate the outline: ${errorMessage}. Please try again and ensure the response is valid JSON with the exact structure requested.`
          },
          {
            role: 'user',
            content: 'Please regenerate the outline with the same concepts but ensure the JSON is properly formatted and complete. Remember to return only valid JSON with the exact structure requested.'
          }
        ];
        
        const retryResponse = await this.llmClient.chat(retryMessages);
        return this.parseResponse(retryResponse);
      } catch (retryError) {
        throw new Error(`Failed to generate outline after retry: ${errorMessage}`);
      }
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
      // First, try to parse the response directly if it's already valid JSON
      let parsed;
      try {
        parsed = JSON.parse(response);
      } catch (directParseError) {
        // If direct parsing fails, try to extract JSON from the response
        // Look for a JSON object that starts with { and ends with }
        const jsonStart = response.indexOf('{');
        if (jsonStart === -1) {
          throw new Error('No JSON object found in response');
        }
        
        // Try to find the matching closing brace
        let braceCount = 0;
        let jsonEnd = -1;
        for (let i = jsonStart; i < response.length; i++) {
          if (response[i] === '{') {
            braceCount++;
          } else if (response[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEnd = i;
              break;
            }
          }
        }
        
        // If we can't find a matching closing brace, try to work with what we have
        if (jsonEnd === -1) {
          // Try to parse the partial JSON we have
          const partialResponse = response.substring(jsonStart);
          try {
            parsed = JSON.parse(partialResponse);
          } catch (partialParseError) {
            throw new Error(`No matching closing brace found for JSON object. Response appears to be truncated.`);
          }
        } else {
          const jsonString = response.substring(jsonStart, jsonEnd + 1);
          parsed = JSON.parse(jsonString);
        }
      }

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
      throw new Error(`Failed to parse outline response: ${errorMessage}. Raw response: ${response.substring(0, 1000)}...`);
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
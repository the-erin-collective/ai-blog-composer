import { LLMClient, LLMMessage } from './llmClient';
import { ExtractedMetadata } from './metadataExtractor';

export interface ConceptExtractionResult {
  concepts: string[];
  summary: string;
}

/**
 * Metadata Summarizer Agent
 * Uses LLM to generate 5-7 high-level concepts from extracted metadata
 * This is the core LLM-powered step that validates LLM integration
 */
export class MetadataSummarizer {
  private llmClient: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Extract concepts from metadata using LLM
   */
  async extractConcepts(metadata: ExtractedMetadata): Promise<ConceptExtractionResult> {
    const prompt = this.buildPrompt(metadata);

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: 'You are an expert content analyst. Extract 5-7 high-level concepts from the given content metadata. Return a JSON response with "concepts" (array of strings) and "summary" (brief description).'
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
      throw new Error(`Failed to extract concepts: ${errorMessage}`);
    }
  }

  /**
   * Build the prompt for concept extraction
   */
  private buildPrompt(metadata: ExtractedMetadata): string {
    const headingsText = metadata.headings.length > 0
      ? metadata.headings.join('\n')
      : 'No headings found';

    const descriptionText = metadata.metaDescription
      ? `\nMeta Description: ${metadata.metaDescription}\n`
      : '';

    return `
Title: ${metadata.title}
${descriptionText}
Headings:
${headingsText}

Based on the above title, meta description, and headings, extract 5-7 high-level concepts that represent the main topics or themes. 
Return your response as a JSON object with this exact structure:
{
  "concepts": ["concept1", "concept2", "concept3", "concept4", "concept5"],
  "summary": "A brief one-sentence summary of the main theme"
}

Only return the JSON, no additional text.
`;
  }

  /**
   * Parse the LLM response and extract concepts
   */
  private parseResponse(response: string): ConceptExtractionResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate the response structure
      if (!Array.isArray(parsed.concepts) || typeof parsed.summary !== 'string') {
        throw new Error('Invalid response structure');
      }

      return {
        concepts: parsed.concepts.slice(0, 7), // Ensure max 7 concepts
        summary: parsed.summary
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse LLM response: ${errorMessage}. Raw response: ${response}`);
    }
  }
}
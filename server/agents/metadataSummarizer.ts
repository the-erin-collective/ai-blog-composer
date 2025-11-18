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
      
      // Try once more with error context
      try {
        const retryMessages: LLMMessage[] = [
          ...messages,
          {
            role: 'assistant',
            content: `I encountered an error while trying to extract concepts: ${errorMessage}. Please try again and ensure the response is valid JSON with the exact structure requested.`
          },
          {
            role: 'user',
            content: 'Please regenerate the concepts extraction with the same metadata but ensure the JSON is properly formatted and complete. Remember to return only valid JSON with the exact structure requested.'
          }
        ];
        
        const retryResponse = await this.llmClient.chat(retryMessages);
        return this.parseResponse(retryResponse);
      } catch (retryError) {
        throw new Error(`Failed to extract concepts after retry: ${errorMessage}`);
      }
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
      if (!Array.isArray(parsed.concepts) || typeof parsed.summary !== 'string') {
        throw new Error('Invalid response structure');
      }

      return {
        concepts: parsed.concepts.slice(0, 7), // Ensure max 7 concepts
        summary: parsed.summary
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse LLM response: ${errorMessage}. Raw response: ${response.substring(0, 1000)}...`);
    }
  }
}
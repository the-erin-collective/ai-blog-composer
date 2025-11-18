import axios, { AxiosInstance } from 'axios';
import { LLMClient, LLMMessage } from './llmClient';

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  temperature?: number;
}

export interface OpenRouterMessage extends LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: OpenRouterMessage;
  }>;
}

/**
 * OpenRouter LLM Client
 * Connects to OpenRouter API and handles LLM requests
 */
export class OpenRouterClient implements LLMClient {
  private client: AxiosInstance;
  private config: OpenRouterConfig;

  constructor(config: OpenRouterConfig) {
    this.config = {
      temperature: 0.7,
      ...config
    };

    this.client = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      timeout: 60000, // 60 second timeout for LLM responses
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'HTTP-Referer': 'http://localhost:3000', // Optional, for OpenRouter analytics
        'X-Title': 'Ollama MVP Prototype', // Optional, for OpenRouter analytics
      }
    });
  }

  /**
   * Check if the OpenRouter server is accessible and the API key is valid
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/models');
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Send a message to the OpenRouter model and get a response
   */
  async chat(messages: LLMMessage[]): Promise<string> {
    try {
      const response = await this.client.post<OpenRouterResponse>('/chat/completions', {
        model: this.config.model,
        messages,
        temperature: this.config.temperature
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`OpenRouter API request failed: ${errorMessage}`);
    }
  }
}

/**
 * Create an OpenRouter client with the provided API key
 */
export function createOpenRouterClient(apiKey: string, model: string = 'openai/gpt-3.5-turbo'): OpenRouterClient {
  return new OpenRouterClient({
    apiKey,
    model,
    temperature: 0.7
  });
}
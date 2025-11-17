import axios, { AxiosInstance } from 'axios';

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  temperature?: number;
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: OllamaMessage;
  done: boolean;
}

/**
 * Ollama LLM Client
 * Connects to a local Ollama instance and handles LLM requests
 * Uses OpenAI-compatible API format
 */
export class OllamaClient {
  private client: AxiosInstance;
  private config: OllamaConfig;

  constructor(config: OllamaConfig) {
    this.config = {
      temperature: 0.7,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 60000, // 60 second timeout for LLM responses
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Send a message to the Ollama model and get a response
   */
  /**
   * Check if the Ollama server is running and the model is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/tags');
      const models = response.data?.models || [];
      return models.some((m: any) => m.name === this.config.model);
    } catch (error) {
      console.error('[Ollama] Health check failed:', error);
      return false;
    }
  }

  /**
   * Send a message to the Ollama model and get a response
   */
  async chat(messages: OllamaMessage[]): Promise<string> {
    try {
      const response = await this.client.post<OllamaResponse>('/api/chat', {
        model: this.config.model,
        messages,
        stream: false,
        temperature: this.config.temperature
      });

      return response.data.message.content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Ollama API request failed: ${errorMessage}`);
    }
  }

  /**
   * Check if Ollama is available and the model is loaded
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/tags');
      const models = response.data.models || [];
      return models.some((m: any) => m.name === this.config.model);
    } catch {
      return false;
    }
  }
}

/**
 * Create a default Ollama client pointing to localhost:11434
 */
export function createOllamaClient(model: string = 'llama2'): OllamaClient {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  return new OllamaClient({
    baseUrl,
    model,
    temperature: 0.7
  });
}

/**
 * Common interface for LLM clients
 */
export interface LLMClient {
  /**
   * Check if the LLM service is accessible and healthy
   */
  checkHealth(): Promise<boolean>;
  
  /**
   * Send a message to the LLM and get a response
   */
  chat(messages: LLMMessage[]): Promise<string>;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
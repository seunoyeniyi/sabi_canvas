export type AIProvider = 'openai' | 'gemini' | 'claude' | 'deepseek' | 'grok';

export interface AITextRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AITextResponse {
  text: string;
  provider: AIProvider;
  model: string;
}

export interface AIProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface IAIProviderClient {
  provider: AIProvider;
  isConfigured: () => boolean;
  generateText: (request: AITextRequest) => Promise<AITextResponse>;
}

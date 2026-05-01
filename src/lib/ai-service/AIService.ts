import { ClaudeClient } from './providers/claudeClient';
import { DeepSeekClient } from './providers/deepseekClient';
import { GeminiClient } from './providers/geminiClient';
import { GrokClient } from './providers/grokClient';
import { OpenAIClient } from './providers/openaiClient';
import { getConfiguredAIProvider, getKnownProviders } from './env';
import type { AIProvider, AITextRequest, AITextResponse, IAIProviderClient } from './types';

export class AIService {
  private clients: Record<AIProvider, IAIProviderClient>;

  constructor() {
    this.clients = {
      openai: new OpenAIClient(),
      gemini: new GeminiClient(),
      claude: new ClaudeClient(),
      deepseek: new DeepSeekClient(),
      grok: new GrokClient(),
    };
  }

  getAvailableProviders(): AIProvider[] {
    return getKnownProviders().filter((provider) => this.clients[provider].isConfigured());
  }

  getActiveProvider(): AIProvider {
    const configured = getConfiguredAIProvider();
    if (this.clients[configured].isConfigured()) {
      return configured;
    }

    const fallback = this.getAvailableProviders()[0];
    if (!fallback) {
      throw new Error('No AI provider is configured. Add at least one provider API key in your env.');
    }

    return fallback;
  }

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    const provider = this.getActiveProvider();
    return this.clients[provider].generateText(request);
  }
}

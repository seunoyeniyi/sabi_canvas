import { ClaudeClient } from './providers/claudeClient';
import { DeepSeekClient } from './providers/deepseekClient';
import { GeminiClient } from './providers/geminiClient';
import { GrokClient } from './providers/grokClient';
import { OpenAIClient } from './providers/openaiClient';
import { getConfiguredAIProvider, getKnownProviders } from './env';
import { getSabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';
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

  private getProxyUrl(): string | undefined {
    const { proxy } = getSabiCanvasConfig();
    if (proxy?.aiUrl) return proxy.aiUrl;
    if (proxy?.baseUrl) return `${proxy.baseUrl.replace(/\/$/, '')}/ai/generate-text`;
    return undefined;
  }

  isProxyConfigured(): boolean {
    return Boolean(this.getProxyUrl());
  }

  getAvailableProviders(): AIProvider[] {
    if (this.isProxyConfigured()) {
      return [getConfiguredAIProvider() || 'gemini'];
    }
    return getKnownProviders().filter((provider) => this.clients[provider].isConfigured());
  }

  getActiveProvider(): AIProvider {
    if (this.isProxyConfigured()) {
      return getConfiguredAIProvider() || 'gemini';
    }

    const configured = getConfiguredAIProvider();
    if (this.clients[configured].isConfigured()) {
      return configured;
    }

    const fallback = this.getAvailableProviders()[0];
    if (!fallback) {
      throw new Error('No AI provider is configured. Add at least one provider API key in your env or configure backend proxy.');
    }

    return fallback;
  }

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    const proxyUrl = this.getProxyUrl();
    if (proxyUrl) {
      const configured = this.getActiveProvider();
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: request.prompt,
          provider: configured,
          model: request.model,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || `AI request failed (${response.status})`);
      }

      if (!payload?.text) {
        throw new Error('AI returned an empty response.');
      }

      return {
        text: payload.text,
        provider: payload.provider || configured,
        model: payload.model || request.model || 'gemini-2.5-flash-lite',
      };
    }

    const provider = this.getActiveProvider();
    return this.clients[provider].generateText(request);
  }
}

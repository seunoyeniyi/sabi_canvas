import { extractAPIErrorMessage } from '../error';
import { getProviderConfig } from '../env';
import type { AITextRequest, AITextResponse, IAIProviderClient } from '../types';

export class OpenAIClient implements IAIProviderClient {
  provider = 'openai' as const;

  isConfigured = () => {
    return Boolean(getProviderConfig(this.provider).apiKey);
  };

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    const config = getProviderConfig(this.provider);
    if (!config.apiKey) {
      throw new Error('OpenAI API key is missing. Set VITE_OPENAI_API_KEY.');
    }

    const response = await fetch(`${config.baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model ?? config.model,
        messages: [{ role: 'user', content: request.prompt }],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(extractAPIErrorMessage(payload, `OpenAI request failed (${response.status}).`));
    }

    const text = payload?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('OpenAI returned an empty response.');
    }

    return {
      text: text.trim(),
      provider: this.provider,
      model: request.model ?? config.model ?? 'gpt-4o-mini',
    };
  }
}

import { extractAPIErrorMessage } from '../error';
import { getProviderConfig } from '../env';
import type { AITextRequest, AITextResponse, IAIProviderClient } from '../types';

export class ClaudeClient implements IAIProviderClient {
  provider = 'claude' as const;

  isConfigured = () => {
    return Boolean(getProviderConfig(this.provider).apiKey);
  };

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    const config = getProviderConfig(this.provider);
    if (!config.apiKey) {
      throw new Error('Anthropic API key is missing. Set VITE_ANTHROPIC_API_KEY.');
    }

    const model = request.model ?? config.model ?? 'claude-3-5-haiku-latest';
    const response = await fetch(`${config.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: request.maxTokens ?? 512,
        temperature: request.temperature ?? 0.7,
        messages: [{ role: 'user', content: request.prompt }],
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(extractAPIErrorMessage(payload, `Claude request failed (${response.status}).`));
    }

    const segments = payload?.content;
    const text = Array.isArray(segments)
      ? segments
          .map((segment: { type?: unknown; text?: unknown }) => (segment?.type === 'text' && typeof segment.text === 'string' ? segment.text : ''))
          .join('')
          .trim()
      : '';

    if (!text) {
      throw new Error('Claude returned an empty response.');
    }

    return {
      text,
      provider: this.provider,
      model,
    };
  }
}

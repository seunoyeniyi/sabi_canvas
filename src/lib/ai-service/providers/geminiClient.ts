import { extractAPIErrorMessage } from '../error';
import { getProviderConfig } from '../env';
import type { AITextRequest, AITextResponse, IAIProviderClient } from '../types';

export class GeminiClient implements IAIProviderClient {
  provider = 'gemini' as const;

  isConfigured = () => {
    return Boolean(getProviderConfig(this.provider).apiKey);
  };

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    const config = getProviderConfig(this.provider);
    if (!config.apiKey) {
      throw new Error('Gemini API key is missing. Set VITE_GEMINI_API_KEY.');
    }

    const model = request.model ?? config.model ?? 'gemini-2.0-flash';
    const endpointBase = config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
    const endpoint = `${endpointBase}/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens,
        },
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(extractAPIErrorMessage(payload, `Gemini request failed (${response.status}).`));
    }

    const parts = payload?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts)
      ? parts.map((part: { text?: unknown }) => (typeof part?.text === 'string' ? part.text : '')).join('').trim()
      : '';

    if (!text) {
      throw new Error('Gemini returned an empty response.');
    }

    return {
      text,
      provider: this.provider,
      model,
    };
  }
}

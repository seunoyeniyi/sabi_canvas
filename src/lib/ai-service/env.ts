import { getSabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';
import type { AIProvider, AIProviderConfig } from './types';

const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  claude: 'claude-3-5-haiku-latest',
  deepseek: 'deepseek-chat',
  grok: 'grok-2-latest',
};

const PROVIDERS: AIProvider[] = ['openai', 'gemini', 'claude', 'deepseek', 'grok'];

const toProvider = (value?: string): AIProvider | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (PROVIDERS.includes(normalized as AIProvider)) {
    return normalized as AIProvider;
  }
  return undefined;
};

export const getConfiguredAIProvider = (): AIProvider => {
  const { ai } = getSabiCanvasConfig();
  return toProvider(ai?.provider) ?? 'openai';
};

export const getProviderConfig = (provider: AIProvider): AIProviderConfig => {
  const { ai } = getSabiCanvasConfig();
  const globalModel = ai?.model;

  if (provider === 'openai') {
    return {
      apiKey: ai?.openai?.apiKey,
      model: ai?.openai?.model ?? globalModel ?? DEFAULT_MODELS.openai,
      baseUrl: ai?.openai?.baseUrl,
    };
  }

  if (provider === 'gemini') {
    return {
      apiKey: ai?.gemini?.apiKey,
      model: ai?.gemini?.model ?? globalModel ?? DEFAULT_MODELS.gemini,
      baseUrl: ai?.gemini?.baseUrl,
    };
  }

  if (provider === 'claude') {
    return {
      apiKey: ai?.claude?.apiKey,
      model: ai?.claude?.model ?? globalModel ?? DEFAULT_MODELS.claude,
      baseUrl: ai?.claude?.baseUrl,
    };
  }

  if (provider === 'deepseek') {
    return {
      apiKey: ai?.deepseek?.apiKey,
      model: ai?.deepseek?.model ?? globalModel ?? DEFAULT_MODELS.deepseek,
      baseUrl: ai?.deepseek?.baseUrl,
    };
  }

  return {
    apiKey: ai?.grok?.apiKey,
    model: ai?.grok?.model ?? globalModel ?? DEFAULT_MODELS.grok,
    baseUrl: ai?.grok?.baseUrl,
  };
};

export const getKnownProviders = (): AIProvider[] => {
  return PROVIDERS;
};

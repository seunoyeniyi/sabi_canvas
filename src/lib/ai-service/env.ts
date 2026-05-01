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
  return toProvider(import.meta.env.VITE_AI_PROVIDER) ?? 'openai';
};

export const getProviderConfig = (provider: AIProvider): AIProviderConfig => {
  const globalModel = import.meta.env.VITE_AI_MODEL;

  if (provider === 'openai') {
    return {
      apiKey: import.meta.env.VITE_OPENAI_API_KEY,
      model: import.meta.env.VITE_OPENAI_MODEL ?? globalModel ?? DEFAULT_MODELS.openai,
      baseUrl: import.meta.env.VITE_OPENAI_BASE_URL,
    };
  }

  if (provider === 'gemini') {
    return {
      apiKey: import.meta.env.VITE_GEMINI_API_KEY,
      model: import.meta.env.VITE_GEMINI_MODEL ?? globalModel ?? DEFAULT_MODELS.gemini,
      baseUrl: import.meta.env.VITE_GEMINI_BASE_URL,
    };
  }

  if (provider === 'claude') {
    return {
      apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
      model: import.meta.env.VITE_ANTHROPIC_MODEL ?? globalModel ?? DEFAULT_MODELS.claude,
      baseUrl: import.meta.env.VITE_ANTHROPIC_BASE_URL,
    };
  }

  if (provider === 'deepseek') {
    return {
      apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY,
      model: import.meta.env.VITE_DEEPSEEK_MODEL ?? globalModel ?? DEFAULT_MODELS.deepseek,
      baseUrl: import.meta.env.VITE_DEEPSEEK_BASE_URL,
    };
  }

  return {
    apiKey: import.meta.env.VITE_GROK_API_KEY,
    model: import.meta.env.VITE_GROK_MODEL ?? globalModel ?? DEFAULT_MODELS.grok,
    baseUrl: import.meta.env.VITE_GROK_BASE_URL,
  };
};

export const getKnownProviders = (): AIProvider[] => {
  return PROVIDERS;
};

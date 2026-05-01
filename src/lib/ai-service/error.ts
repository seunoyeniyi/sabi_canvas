export const extractAPIErrorMessage = (payload: unknown, fallback: string): string => {
  if (!payload || typeof payload !== 'object') return fallback;

  const source = payload as Record<string, unknown>;

  const topLevelMessage = source.message;
  if (typeof topLevelMessage === 'string' && topLevelMessage.trim()) {
    return topLevelMessage;
  }

  const nestedError = source.error;
  if (nestedError && typeof nestedError === 'object') {
    const nested = nestedError as Record<string, unknown>;
    const nestedMessage = nested.message;
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
      return nestedMessage;
    }
  }

  const candidateKeys = ['detail', 'title', 'reason'];
  for (const key of candidateKeys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return fallback;
};

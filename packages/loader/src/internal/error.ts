const MESSAGE_KEYS = ['message', 'reason', 'error'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const safeJsonStringify = (value: unknown): string | undefined => {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(value, (_key, currentValue: unknown) => {
      if (typeof currentValue === 'bigint') {
        return currentValue.toString();
      }

      if (currentValue instanceof Error) {
        return {
          name: currentValue.name,
          message: currentValue.message,
          stack: currentValue.stack,
          cause: 'cause' in currentValue ? currentValue.cause : undefined,
        };
      }

      if (typeof currentValue === 'object' && currentValue !== null) {
        if (seen.has(currentValue)) {
          return '[Circular]';
        }
        seen.add(currentValue);
      }

      return currentValue;
    });
  } catch {
    return undefined;
  }
};

const extractMessageLike = (value: unknown, seen = new WeakSet<object>()): string | undefined => {
  if (typeof value === 'string') {
    return value.trim() ? value : undefined;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol'
  ) {
    return String(value);
  }

  if (typeof ErrorEvent !== 'undefined' && value instanceof ErrorEvent) {
    return value.message || extractMessageLike(value.error, seen) || undefined;
  }

  if (value instanceof AggregateError) {
    const nestedMessages = value.errors
      .map((error) => extractMessageLike(error, seen))
      .filter((message): message is string => Boolean(message));

    return [value.message, ...nestedMessages].filter(Boolean).join(': ') || undefined;
  }

  if (value instanceof Error) {
    return value.message || value.name || undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);

  for (const key of MESSAGE_KEYS) {
    const message = extractMessageLike(value[key], seen);
    if (message) {
      return message;
    }
  }

  return undefined;
};

export const getErrorMessage = (error: unknown): string => {
  const message = extractMessageLike(error);
  if (message) {
    return message;
  }

  const serialized = safeJsonStringify(error);
  if (serialized && serialized !== '{}') {
    return serialized;
  }

  return String(error);
};

export const toError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(getErrorMessage(error), {
    cause: error,
  });
};

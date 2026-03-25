import { describe, expect, it } from 'vitest';

import { getErrorMessage, toError } from '../error.js';

describe('error helpers', () => {
  it('keeps Error messages intact', () => {
    expect(getErrorMessage(new Error('sqlite failed'))).toBe('sqlite failed');
  });

  it('extracts plain object message fields', () => {
    expect(getErrorMessage({ message: 'worker crashed' })).toBe('worker crashed');
    expect(getErrorMessage({ error: { message: 'nested failure' } })).toBe('nested failure');
  });

  it('serializes non-message objects instead of returning [object Object]', () => {
    expect(getErrorMessage({ status: 404, path: '/sqlite3.wasm' })).toBe(
      '{"status":404,"path":"/sqlite3.wasm"}',
    );
  });

  it('serializes circular objects safely', () => {
    const circular: { self?: unknown; status: string } = {
      status: 'failed',
    };
    circular.self = circular;

    expect(getErrorMessage(circular)).toBe('{"status":"failed","self":"[Circular]"}');
  });

  it('wraps non-Error values with a useful Error message', () => {
    const error = toError({ message: 'db open failed' });

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('db open failed');
    expect(error.cause).toEqual({ message: 'db open failed' });
  });
});

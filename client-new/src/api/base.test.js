import { describe, it, expect, afterEach } from 'vitest';
import { isNetworkError } from './base';

const setOnline = (value) => {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
};

describe('isNetworkError', () => {
  afterEach(() => setOnline(true));

  it('treats a failed fetch as a network error', () => {
    setOnline(true);
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('treats any error as a network error while offline', () => {
    setOnline(false);
    expect(isNetworkError(new Error('boom'))).toBe(true);
  });

  it('leaves other errors alone while online', () => {
    setOnline(true);
    expect(isNetworkError(new Error('boom'))).toBe(false);
  });
});

// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

const customFetch = vi.fn();
vi.mock('../api/base', () => ({ customFetch: (...args) => customFetch(...args) }));
vi.mock('../api/urls', () => ({ baseURL: 'http://test' }));

const { FeaturesProvider, useFeatures } = await import('./FeaturesContext');

const Probe = () => {
  const features = useFeatures();
  return <span data-testid="probe">{String(features.job_openings)}</span>;
};

const show = () => render(<FeaturesProvider><Probe /></FeaturesProvider>);
const value = () => screen.getByTestId('probe').textContent;

beforeEach(() => {
  localStorage.clear();
  customFetch.mockReset();
  customFetch.mockReturnValue(new Promise(() => {}));   // never settles
});

afterEach(cleanup);

describe('FeaturesProvider', () => {
  // The flash: every reload drew the nav with every module on, then took the
  // switched-off ones away when /features answered a moment later.
  it('starts from the last answer instead of the defaults', () => {
    localStorage.setItem('features', JSON.stringify({ job_openings: false }));
    show();
    expect(value()).toBe('false');
  });

  // A first visit has nothing cached, and a module must never be hidden just
  // because the API has not answered yet.
  it('defaults a feature to on when nothing is cached', () => {
    show();
    expect(value()).toBe('true');
  });

  it('ignores a cache that is not usable', () => {
    localStorage.setItem('features', 'not json');
    show();
    expect(value()).toBe('true');
  });

  it('takes the answer over the cache, and remembers it', async () => {
    localStorage.setItem('features', JSON.stringify({ job_openings: true }));
    customFetch.mockResolvedValue({ success: true, response: { job_openings: false } });

    show();
    await waitFor(() => expect(value()).toBe('false'));
    expect(JSON.parse(localStorage.getItem('features')).job_openings).toBe(false);
  });

  it('keeps the cached answer when the request fails', async () => {
    localStorage.setItem('features', JSON.stringify({ job_openings: false }));
    customFetch.mockResolvedValue({ success: false, response: null });

    show();
    await waitFor(() => expect(customFetch).toHaveBeenCalled());
    expect(value()).toBe('false');
  });
});

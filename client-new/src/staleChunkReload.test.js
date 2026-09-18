// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import installStaleChunkReload from './staleChunkReload';

const reload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { ...window.location, reload },
  writable: true,
});

// One listener for the file, as the entry installs one for the page.
installStaleChunkReload();

// What Vite dispatches when a chunk a route needs is no longer on the server.
const preloadFailed = (message) => {
  const event = new Event('vite:preloadError', { cancelable: true });
  event.payload = new Error(message);
  window.dispatchEvent(event);
  return event;
};

const MISSING_LOGIN = 'Failed to fetch dynamically imported module: /assets/Login-BQaya0oO.js';

beforeEach(() => {
  sessionStorage.clear();
  reload.mockClear();
});

describe('staleChunkReload', () => {
  it('loads the page again when a route asks for a chunk the deploy replaced', () => {
    const event = preloadFailed(MISSING_LOGIN);
    expect(reload).toHaveBeenCalledTimes(1);
    // Cancelled, or Vite throws the error the reload is already answering.
    expect(event.defaultPrevented).toBe(true);
  });

  it('reloads once for the same chunk, so a missing one is not a reload loop', () => {
    preloadFailed(MISSING_LOGIN);
    const second = preloadFailed(MISSING_LOGIN);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(second.defaultPrevented).toBe(false);
  });

  it('reloads again for a different chunk, so the next deploy is picked up too', () => {
    preloadFailed(MISSING_LOGIN);
    preloadFailed('Failed to fetch dynamically imported module: /assets/UrfList-DWFdDN06.js');
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

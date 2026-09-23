import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast } from 'react-toastify';
import { openStoredFile, storedFileUrl } from './fileAccess';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn() } }));

const stubTab = () => ({ close: vi.fn(), location: { href: '' }, opener: {} });

describe('openStoredFile', () => {
  let tab;

  beforeEach(() => {
    tab = stubTab();
    vi.stubGlobal('window', { open: vi.fn(() => tab) });
    vi.stubGlobal('localStorage', { getItem: () => 'token-1' });
    toast.error.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('asks the file route with the bearer token and shows a PDF in the tab it opened', async () => {
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:pdf', revokeObjectURL: vi.fn() });
    const fetch = vi.fn(async () => ({ ok: true, blob: async () => ({ type: 'application/pdf' }) }));
    vi.stubGlobal('fetch', fetch);

    await openStoredFile('/app/uploads/thesis//thesis_1.pdf');

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(storedFileUrl('/app/uploads/thesis//thesis_1.pdf'));
    expect(url).toContain('/files?path=%2Fapp%2Fuploads%2Fthesis%2F%2Fthesis_1.pdf');
    expect(options.headers.Authorization).toBe('Bearer token-1');
    expect(tab.location.href).toBe('blob:pdf');
    expect(tab.close).not.toHaveBeenCalled();
  });

  it('closes the tab and says why when the file is refused', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })));

    await openStoredFile('/app/uploads/thesis//thesis_1.pdf');

    expect(tab.close).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('You do not have access to this file.');
  });

  it('opens an external link directly', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await openStoredFile('https://example.org/letter.pdf');

    expect(window.open).toHaveBeenCalledWith('https://example.org/letter.pdf', '_blank', 'noopener,noreferrer');
    expect(fetch).not.toHaveBeenCalled();
  });
});

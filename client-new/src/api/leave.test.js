import { describe, it, expect, vi } from 'vitest';

const pages = { 1: [{ id: 1 }, { id: 2 }], 2: [{ id: 3 }], 3: [{ id: 4 }] };
vi.mock('./base', () => ({
  customFetch: vi.fn(async (url) => {
    const page = Number(new URL(url, 'http://x').searchParams.get('page'));
    return { success: true, response: { data: pages[page], totalPages: 3, fields: ['name'] } };
  }),
}));

describe('apiLeaveList', () => {
  it('reads every page, so no pending application is left off', async () => {
    const { apiLeaveList } = await import('./leave');
    const res = await apiLeaveList();
    expect(res.success).toBe(true);
    expect(res.response.data.map((row) => row.id)).toEqual([1, 2, 3, 4]);
    expect(res.response.fields).toEqual(['name']);
  });
});

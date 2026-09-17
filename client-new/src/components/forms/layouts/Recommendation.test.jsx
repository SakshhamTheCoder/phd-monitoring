// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';

const submitted = [];
vi.mock('../../../api/form', () => ({ submitForm: (body) => submitted.push({ ...body }) }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { LoadingProvider } = await import('../../../context/LoadingContext');
const Recommendation = (await import('./Recommendation')).default;

afterEach(() => {
  cleanup();
  submitted.length = 0;
});

const form = (overrides = {}) => ({
  role: 'hod',
  stage: 'hod',
  steps: ['student', 'hod', 'complete'],
  approvals: { hod: 0 },
  comments: { hod: null },
  locks: { hod: 0 },
  ...overrides,
});

const renderPanel = (formData) => render(
  <MemoryRouter>
    <LoadingProvider>
      <Recommendation formData={formData} role="hod" allowRejection={false} />
    </LoadingProvider>
  </MemoryRouter>
);

describe('Recommendation', () => {
  // The approval column defaults to 0, and the step drew "Not Recommend"
  // already chosen, so a HOD pressing Submit rejected without deciding.
  it('starts an unanswered step with nothing chosen and will not submit it', () => {
    renderPanel(form());
    expect(screen.getByRole('radio', { name: 'Recommend' }).checked).toBe(false);
    expect(screen.getByRole('radio', { name: 'Not Recommend' }).checked).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(submitted).toHaveLength(0);

    fireEvent.click(screen.getByRole('radio', { name: 'Recommend' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(submitted).toEqual([expect.objectContaining({ approval: true })]);
  });

  it('shows an answered step as it was answered', () => {
    renderPanel(form({ stage: 'complete', approvals: { hod: 0 }, locks: { hod: 1 }, comments: { hod: 'Incomplete' } }));
    expect(screen.getByRole('radio', { name: 'Not Recommend' }).checked).toBe(true);
  });
});

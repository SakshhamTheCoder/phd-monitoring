// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
// The views the server really sends, kept equal to it by FormViewContractTest.
import cases from '../../../../../server/tests/fixtures/form-views/revise-title.json';
import ServerPanel from './ServerPanel';

const submitForm = vi.fn();
vi.mock('../../../api/form', () => ({ submitForm: (...args) => submitForm(...args) }));
vi.mock('../../../context/LoadingContext', () => ({ useLoading: () => ({ setLoading: () => {} }) }));

afterEach(() => {
  cleanup();
  submitForm.mockClear();
});

const formData = (name) => cases.find((c) => c.name === name).formData;
const draw = (data) =>
  render(
    <MemoryRouter>
      <ServerPanel formData={data} rows={data.view.panels.student} />
    </MemoryRouter>
  );

describe('ServerPanel', () => {
  it('starts a new form from the current title and objectives', () => {
    draw(formData('new form, scholar editing'));
    expect(screen.getByLabelText(/Revised title of PhD thesis/)).toHaveProperty('value', 'Catalysts for low-temperature ammonia synthesis');
    expect(screen.getByLabelText('Revised objective 1')).toHaveProperty('value', 'Screen ruthenium catalysts');
    expect(screen.getByLabelText('Revised objective 2')).toHaveProperty('value', 'Model reaction kinetics');
  });

  it('posts what was edited, dropping cleared list boxes', () => {
    draw(formData('sent back, scholar editing'));
    fireEvent.change(screen.getByLabelText(/Revised title of PhD thesis/), { target: { value: 'A narrower title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add objective' }));
    fireEvent.change(screen.getByLabelText('Revised objective 3'), { target: { value: 'A third aim' } });
    fireEvent.change(screen.getByLabelText('Revised objective 1'), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit revision' }));

    expect(submitForm).toHaveBeenCalledTimes(1);
    expect(submitForm.mock.calls[0][0]).toEqual({
      revised_title: 'A narrower title',
      revised_objectives: ['Test at pilot scale', 'A third aim'],
    });
  });

  it.each(['submitted, scholar reading', 'submitted, supervisor reading', 'unsubmitted, coordinator reading'])(
    'gives %s nothing to edit and nothing to submit',
    (name) => {
      const { container } = draw(formData(name));
      expect(container.querySelectorAll('input:not([readonly])')).toHaveLength(0);
      expect(screen.queryByRole('button', { name: 'Submit revision' })).toBeNull();
      expect(screen.getByText('Revised objectives')).toBeTruthy();
    }
  );
});

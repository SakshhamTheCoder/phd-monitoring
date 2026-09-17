// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import DateField from './DateField';

afterEach(cleanup);

const dateValue = (container) => within(container).getByPlaceholderText('Select Date...').value;

describe('DateField', () => {
  it('renders the parsed date for a valid ISO initialValue without throwing', () => {
    const { container } = render(
      <DateField label="Date" initialValue="2026-03-14T00:00:00.000Z" onChange={() => {}} />
    );
    expect(dateValue(container)).toBe('2026-03-14');
  });

  // Regression for C2: formData.date_of_irb is NULL for a student submitting
  // their own IRB, so callers pass it through formatDate() first, which used
  // to return the portal's em dash ('—') for "nothing recorded" and now
  // returns EMPTY_VALUE ('N/A'). Either string used to reach
  // `new Date(initialValue).toISOString()` unguarded, which throws
  // RangeError: Invalid time value from inside a useEffect.
  it('does not throw and renders an empty date input when given the em dash', () => {
    let container;
    expect(() => {
      ({ container } = render(<DateField label="Date" initialValue="—" onChange={() => {}} />));
    }).not.toThrow();
    expect(dateValue(container)).toBe('');
  });

  it('does not throw and renders an empty date input when given EMPTY_VALUE', () => {
    let container;
    expect(() => {
      ({ container } = render(<DateField label="Date" initialValue="N/A" onChange={() => {}} />));
    }).not.toThrow();
    expect(dateValue(container)).toBe('');
  });

  it('does not throw for any other unparseable initialValue', () => {
    let container;
    expect(() => {
      ({ container } = render(<DateField label="Date" initialValue="not a date" onChange={() => {}} />));
    }).not.toThrow();
    expect(dateValue(container)).toBe('');
  });

  it('renders an empty date input when initialValue is empty or falsy', () => {
    const { container } = render(<DateField label="Date" initialValue="" onChange={() => {}} />);
    expect(dateValue(container)).toBe('');
  });

  // A locked date is read as text, in the same format as every other date on a
  // form. The native picker draws itself in the browser's locale, so leaving it
  // in place put "12/05/2026" next to "13 Feb 2026" on the same row.
  it('renders a locked date as text in the shared format', () => {
    const { container } = render(
      <DateField label="Date" initialValue="2026-03-14T00:00:00.000Z" isLocked onChange={() => {}} />
    );
    expect(container.textContent).toContain('14 Mar 2026');
    expect(container.querySelector('input')).toBeNull();
  });

  it('says so when a locked date has no value', () => {
    const { container } = render(
      <DateField label="Date" initialValue="" isLocked onChange={() => {}} />
    );
    expect(container.textContent).toContain('Not provided');
  });
});

// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import InputField from './InputField';
import DropdownField from './DropdownField';
import DateField from './DateField';
import TimeField from './TimeField';
import FileUploadField from './FileUploadField';

afterEach(cleanup);

const OPTIONS = [
  { value: 1, title: 'Computer Science' },
  { value: 2, title: 'Mechanical' },
];

describe('InputField', () => {
  // Every field in the product reached a screen reader as "edit text, blank",
  // because the label was never tied to the input.
  it('ties its label to its input', () => {
    render(<InputField label="Roll Number" onChange={() => {}} />);
    expect(screen.getByLabelText(/Roll Number/)).toBeTruthy();
  });

  it('gives two fields on one form distinct ids', () => {
    const { container } = render(
      <>
        <InputField label="First" onChange={() => {}} />
        <InputField label="Second" onChange={() => {}} />
      </>
    );
    const ids = [...container.querySelectorAll('input')].map((i) => i.id);
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
  });

  // A locked field was `disabled`, which takes it out of the tab order and out
  // of the accessibility tree, so only sighted users could read the value.
  it('keeps a locked value readable rather than disabling it', () => {
    render(<InputField label="Name" initialValue="Asha" isLocked onChange={() => {}} />);
    const input = screen.getByLabelText('Name');
    expect(input.readOnly).toBe(true);
    expect(input.disabled).toBe(false);
  });

  it('marks a required field for assistive tech, not just with an asterisk', () => {
    render(<InputField label="Reason" required onChange={() => {}} />);
    expect(screen.getByLabelText(/Reason/).getAttribute('aria-required')).toBe('true');
  });
});

describe('DropdownField', () => {
  it('ties its label to its select', () => {
    render(<DropdownField label="Department" options={OPTIONS} onChange={() => {}} />);
    expect(screen.getByLabelText(/Department/)).toBeTruthy();
  });

  // The list used to collapse to a single option until a mouse click fired, so
  // a keyboard user who tabbed in and arrowed down had nothing to choose from.
  it('offers every option to someone who never clicks it', () => {
    render(
      <DropdownField label="Department" options={OPTIONS} initialValue={2} onChange={() => {}} />
    );
    const select = screen.getByLabelText(/Department/);
    expect(select.value).toBe('2');
    expect([...select.options].map((o) => o.textContent))
      .toEqual(['Select', 'Computer Science', 'Mechanical']);
  });

  it('reports the chosen value', () => {
    const onChange = vi.fn();
    render(<DropdownField label="Department" options={OPTIONS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Department/), { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledWith('1');
  });

  it('reads a locked value as text rather than a disabled select', () => {
    const { container } = render(
      <DropdownField label="Department" options={OPTIONS} initialValue={1} isLocked onChange={() => {}} />
    );
    expect(container.textContent).toContain('Computer Science');
    expect(container.querySelector('select')).toBeNull();
  });
});

describe('DateField', () => {
  // The one field the labelling pass missed: every date read as "date, blank".
  it('ties its label to its input and marks it required', () => {
    render(<DateField label="Date of Fee Submission" required onChange={() => {}} />);
    const input = screen.getByLabelText(/Date of Fee Submission/);
    expect(input.getAttribute('type')).toBe('date');
    expect(input.getAttribute('aria-required')).toBe('true');
  });
});

describe('TimeField and FileUploadField', () => {
  it('ties each label to its input', () => {
    render(<>
      <TimeField label="Time" required onChange={() => {}} />
      <FileUploadField label="Upload Thesis PDF" required onChange={() => {}} />
    </>);
    expect(screen.getByLabelText(/^Time/).getAttribute('type')).toBe('time');
    expect(screen.getByLabelText(/Upload Thesis PDF/).getAttribute('type')).toBe('file');
  });

  // A stored time is "10:30"; reading it through new Date() threw.
  it('shows a stored time instead of crashing on it', () => {
    render(<TimeField label="Time" initialValue="10:30:00" onChange={() => {}} />);
    expect(screen.getByLabelText(/^Time/).value).toBe('10:30');
  });
});

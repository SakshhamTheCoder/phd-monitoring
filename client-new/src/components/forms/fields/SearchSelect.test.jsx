// @vitest-environment jsdom
import React, { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import SearchSelect from './SearchSelect';
import DropdownField from './DropdownField';

const options = [
  { value: 1, title: 'CSED', keywords: 'Computer Science and Engineering' },
  { value: 2, title: 'ECED', keywords: 'Electronics and Communication Engineering' },
];

const Harness = ({ onPick = () => {} }) => {
  const [value, setValue] = useState('');
  return <SearchSelect id="d" value={value} options={options} emptyTitle="All departments" onChange={(v) => { setValue(v); onPick(v); }} />;
};

afterEach(cleanup);

describe('SearchSelect', () => {
  it('lists only codes, and finds a choice by code or by part of its name', () => {
    render(<Harness />);
    const box = screen.getByRole('combobox');
    fireEvent.focus(box);
    expect(screen.getByText('CSED')).toBeTruthy();
    expect(screen.queryByText('Computer Science and Engineering')).toBeNull();

    fireEvent.change(box, { target: { value: 'communication' } });
    expect(screen.queryByText('CSED')).toBeNull();
    expect(screen.getByText('ECED')).toBeTruthy();

    fireEvent.change(box, { target: { value: 'csed' } });
    expect(screen.getByText('CSED')).toBeTruthy();
    expect(screen.queryByText('ECED')).toBeNull();
  });

  it('hands back the chosen value and shows its code', () => {
    const picked = [];
    render(<Harness onPick={(v) => picked.push(v)} />);
    const box = screen.getByRole('combobox');
    fireEvent.focus(box);
    fireEvent.click(screen.getByText('ECED'));
    expect(picked).toEqual(['2']);
    expect(box.value).toBe('ECED');
  });

  it('a select without keywords stays a native select', () => {
    render(<DropdownField label="Year" options={[{ value: 1, title: 'First' }]} onChange={() => {}} />);
    expect(screen.getByRole('combobox').tagName).toBe('SELECT');
  });
});

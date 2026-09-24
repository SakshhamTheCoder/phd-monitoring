import { describe, it, expect } from 'vitest';
import { fails } from './SettingsSection';

// The checks a Configuration view sends (server: App\Pages\ConfigurationPage),
// read against what is typed into the fields.
const quota = { keys: ['academic_quota'], filled: true, integer: true, min: 0, max: 365 };
const order = { keys: ['min_years'], below: ['base_years_male', 'base_years_female_ph'] };

describe('settings checks', () => {
  it('passes a whole number within its bounds, the bounds included', () => {
    expect(fails(quota, { academic_quota: '10' })).toBe(false);
    expect(fails(quota, { academic_quota: '0' })).toBe(false);
    expect(fails(quota, { academic_quota: '365' })).toBe(false);
  });

  it('refuses a number outside its bounds or not whole', () => {
    expect(fails(quota, { academic_quota: '-1' })).toBe(true);
    expect(fails(quota, { academic_quota: '366' })).toBe(true);
    expect(fails(quota, { academic_quota: '10.5' })).toBe(true);
  });

  it('refuses a blank rather than reading it as 0', () => {
    expect(fails(quota, { academic_quota: '' })).toBe(true);
    expect(fails(quota, { academic_quota: '   ' })).toBe(true);
    expect(fails(quota, {})).toBe(true);
  });

  it('refuses a minimum that is not shorter than every deadline', () => {
    expect(fails(order, { min_years: '3', base_years_male: '6', base_years_female_ph: '8' })).toBe(false);
    expect(fails(order, { min_years: '6', base_years_male: '6', base_years_female_ph: '8' })).toBe(true);
    expect(fails(order, { min_years: '9', base_years_male: '6', base_years_female_ph: '8' })).toBe(true);
  });
});

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../../../components/forms/fields/CustomButton';
import { apiSettings, apiSaveSettings } from '../../../api/settings';

const FIELDS = [
  { key: 'min_years', label: 'Minimum years before submission', hint: 'Same for full-time and part-time.' },
  { key: 'base_years_male', label: 'Submission deadline, male (years)', hint: 'Before any extension.' },
  { key: 'base_years_female_ph', label: 'Submission deadline, female or physically handicapped (years)', hint: 'Before any extension.' },
];

/**
 * Thesis duration limits, read and written through the 'thesis' settings group.
 * The deadline is computed on the server from these numbers plus whatever
 * extensions a student has been granted, so a change here moves every
 * student's deadline at once.
 */
const ThesisLimits = () => {
  const [form, setForm] = useState({ min_years: '', base_years_male: '', base_years_female_ph: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiSettings('thesis');
    setLoading(false);
    if (res.success) setForm(res.response);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const values = {
      min_years: Number(form.min_years),
      base_years_male: Number(form.base_years_male),
      base_years_female_ph: Number(form.base_years_female_ph),
    };
    if (FIELDS.some(({ key }) => !Number.isInteger(values[key]) || values[key] < 1)) {
      toast.error('Every limit must be a whole number of years, at least 1.');
      return;
    }
    if (values.min_years >= values.base_years_male || values.min_years >= values.base_years_female_ph) {
      toast.error('The minimum must be shorter than both deadlines.');
      return;
    }
    setSaving(true);
    const res = await apiSaveSettings('thesis', values);
    setSaving(false);
    if (res.success) {
      toast.success('Thesis duration limits saved');
      setForm(res.response);
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <div className="filter-bar">
        <div className="filter-row" style={{ alignItems: 'flex-end' }}>
          {FIELDS.map(({ key, label, hint }) => (
            <div key={key} className="input-field-container" style={{ minWidth: '220px' }}>
              <label className="input-label" htmlFor={key}>{label}</label>
              <input
                id={key}
                type="number"
                min="1"
                max="15"
                className="input-field"
                value={form[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                disabled={loading}
                aria-describedby={`${key}-hint`}
              />
              <small id={`${key}-hint`}>{hint}</small>
            </div>
          ))}
          <div style={{ marginLeft: 'auto' }}>
            <CustomButton text={saving ? 'Saving…' : 'Save'} onClick={handleSave} disabled={loading || saving} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThesisLimits;

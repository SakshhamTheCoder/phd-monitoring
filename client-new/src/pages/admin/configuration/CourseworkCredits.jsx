import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../../../components/forms/fields/CustomButton';
import { apiSettings, apiSaveSettings } from '../../../api/settings';

const FIELDS = [
  { key: 'min_credits_full_time', label: 'Full time' },
  { key: 'min_credits_part_time', label: 'Part time' },
  { key: 'min_credits_executive', label: 'Executive' },
];

/**
 * Credits a scholar must have finished before the synopsis opens to them.
 * Read and written through the 'coursework' settings group.
 */
const CourseworkCredits = () => {
  const [form, setForm] = useState({
    min_credits_full_time: '',
    min_credits_part_time: '',
    min_credits_executive: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiSettings('coursework');
    setLoading(false);
    if (res.success) setForm(res.response);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const values = Object.fromEntries(FIELDS.map(({ key }) => [key, Number(form[key])]));
    if (FIELDS.some(({ key }) => !Number.isInteger(values[key]) || values[key] < 0 || values[key] > 100)) {
      toast.error('Every requirement must be a whole number between 0 and 100.');
      return;
    }
    setSaving(true);
    const res = await apiSaveSettings('coursework', values);
    setSaving(false);
    if (res.success) {
      toast.success('Coursework requirements saved');
      setForm(res.response);
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <div className="filter-bar">
        <div className="filter-row" style={{ alignItems: 'flex-end' }}>
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="input-field-container" style={{ minWidth: '200px' }}>
              <label className="input-label" htmlFor={key}>{label}</label>
              <input
                id={key}
                type="number"
                min="0"
                max="100"
                className="input-field"
                value={form[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                disabled={loading}
              />
            </div>
          ))}
          <div style={{ marginLeft: 'auto' }}>
            <CustomButton text={saving ? 'Saving…' : 'Save'} onClick={handleSave} disabled={loading || saving} />
          </div>
        </div>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
        A scholar's total is the credits of the courses marked complete on their profile.
        Until they reach the figure for their status, the synopsis cannot be raised, and
        their profile says how far off they are.
      </p>
    </div>
  );
};

export default CourseworkCredits;

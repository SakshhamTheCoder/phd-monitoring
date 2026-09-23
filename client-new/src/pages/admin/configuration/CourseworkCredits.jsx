import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../../../components/forms/fields/CustomButton';
import LoadError from '../../../components/common/LoadError';
import { apiSettings, apiSaveSettings } from '../../../api/settings';
import './Configuration.css';

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
  // Save stays off until the stored figures arrived, so a failed load cannot
  // be followed by saving the blank form over them.
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    const res = await apiSettings('coursework');
    setLoading(false);
    if (res.success) {
      setForm(res.response);
      setLoaded(true);
    } else {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    // Number('') is 0, which would pass the range check and save a blank as 0.
    if (FIELDS.some(({ key }) => String(form[key] ?? '').trim() === '')) {
      toast.error('Fill in every field before saving.');
      return;
    }
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

  if (loadFailed) {
    return (
      <LoadError message="Could not load the coursework requirements. Check your connection and try again." onRetry={load} />
    );
  }

  return (
    <>
      <div className="config-fields">
        <div className="config-filter-row">
          {FIELDS.map(({ key, label }) => (
            <div key={key} className="input-field-container config-field-200">
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
          <div className="config-push">
            <CustomButton text={saving ? 'Saving…' : 'Save'} onClick={handleSave} disabled={!loaded || loading || saving} />
          </div>
        </div>
      </div>
      <p className="config-note">
        A scholar's total is the credits of the courses marked complete on their profile.
        Until they reach the figure for their status, the synopsis cannot be raised, and
        their profile says how far off they are.
      </p>
    </>
  );
};

export default CourseworkCredits;

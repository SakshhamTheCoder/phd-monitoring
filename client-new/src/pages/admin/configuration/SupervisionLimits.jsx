import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../../../components/forms/fields/CustomButton';
import { apiSettings, apiSaveSettings } from '../../../api/settings';

const FIELDS = [
  { key: 'max_professor', label: 'Professor' },
  { key: 'max_associate_professor', label: 'Associate Professor' },
  { key: 'max_assistant_professor', label: 'Assistant Professor' },
  { key: 'max_other', label: 'Other designations', hint: 'Designations that name no rank, such as an administrative post.' },
];

/**
 * How many scholars a faculty member may supervise at once, by designation.
 * Read and written through the 'supervision' settings group.
 */
const SupervisionLimits = () => {
  const [form, setForm] = useState({
    max_professor: '',
    max_associate_professor: '',
    max_assistant_professor: '',
    max_other: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiSettings('supervision');
    setLoading(false);
    if (res.success) setForm(res.response);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const values = {
      max_professor: Number(form.max_professor),
      max_associate_professor: Number(form.max_associate_professor),
      max_assistant_professor: Number(form.max_assistant_professor),
      max_other: Number(form.max_other),
    };
    if (FIELDS.some(({ key }) => !Number.isInteger(values[key]) || values[key] < 0 || values[key] > 50)) {
      toast.error('Every limit must be a whole number between 0 and 50.');
      return;
    }
    setSaving(true);
    const res = await apiSaveSettings('supervision', values);
    setSaving(false);
    if (res.success) {
      toast.success('Supervision limits saved');
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
                min="0"
                max="50"
                className="input-field"
                value={form[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                disabled={loading}
                aria-describedby={hint ? `${key}-hint` : undefined}
              />
              {hint && <small id={`${key}-hint`}>{hint}</small>}
            </div>
          ))}
          <div style={{ marginLeft: 'auto' }}>
            <CustomButton text={saving ? 'Saving…' : 'Save'} onClick={handleSave} disabled={loading || saving} />
          </div>
        </div>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
        The limit counts scholars a faculty member is currently guiding. Once a thesis is submitted, it no longer occupies a slot.
      </p>
    </div>
  );
};

export default SupervisionLimits;

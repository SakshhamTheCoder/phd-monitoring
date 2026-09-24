import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../forms/fields/CustomButton';
import LoadError from '../common/LoadError';
import { apiSettings, apiSaveSettings } from '../../api/settings';
import useDoneFlash from '../../hooks/useDoneFlash';
import '../../pages/admin/configuration/Configuration.css';

// Whether a save's check fails for the values typed. Blank is text with
// nothing in it once trimmed; the numbers are read as a number input's value.
export const fails = (check, form) => check.keys.some((key) => {
  const typed = form[key];
  if (check.filled && `${typed ?? ''}`.trim() === '') return true;
  const value = Number(typed);
  if (check.integer && !Number.isInteger(value)) return true;
  if (check.min !== undefined && value < check.min) return true;
  if (check.max !== undefined && value > check.max) return true;
  return (check.below || []).some((other) => value >= Number(form[other]));
});

/**
 * One group of settings (a Configuration view's section of kind 'settings'),
 * read and written through that group's settings endpoint. The fields, the
 * checks a save must pass and what is said come from the view.
 */
const SettingsSection = ({ section }) => {
  const keys = section.fields.map((field) => field.key);
  const [form, setForm] = useState(() => Object.fromEntries(keys.map((key) => [key, ''])));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // What the server holds, for Reset and for telling whether anything changed.
  const [stored, setStored] = useState(null);
  const [saved, flashSaved] = useDoneFlash();

  // Only the group's own fields are kept from what the server answers.
  const ours = useCallback(
    (values) => Object.fromEntries(section.fields.map(({ key }) => [key, values[key]])),
    [section.fields],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    const res = await apiSettings(section.group);
    setLoading(false);
    if (res.success) {
      setForm(ours(res.response));
      setStored(ours(res.response));
      setLoaded(true);
    } else {
      setLoadFailed(true);
    }
  }, [section.group, ours]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const failed = section.checks.find((check) => fails(check, form));
    if (failed) {
      toast.error(failed.message);
      return;
    }
    const values = Object.fromEntries(keys.map((key) => [key, Number(form[key])]));
    setSaving(true);
    const res = await apiSaveSettings(section.group, values);
    setSaving(false);
    if (res.success) {
      toast.success(section.done);
      setForm(ours(res.response));
      setStored(ours(res.response));
      flashSaved();
    }
  };

  const changed = stored !== null && keys.some((key) => String(form[key] ?? '') !== String(stored[key] ?? ''));

  if (loadFailed && section.load_failed) {
    return <LoadError message={section.load_failed} onRetry={load} />;
  }

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <>
      <div className="config-fields">
        <div className="config-filter-row">
          {section.fields.map((field) => (
            <div key={field.key} className={`input-field-container config-field-${field.width}`}>
              <label className="input-label" htmlFor={field.id}>{field.label}</label>
              {field.input === 'select' ? (
                <select id={field.id} className="input-field" value={form[field.key]} onChange={set(field.key)} disabled={loading}>
                  <option value="" disabled>{field.placeholder}</option>
                  {field.options.map((option) => <option key={option.title} value={option.value}>{option.title}</option>)}
                </select>
              ) : (
                <input
                  id={field.id}
                  type="number"
                  min={String(field.min)}
                  max={String(field.max)}
                  className="input-field"
                  value={form[field.key]}
                  onChange={set(field.key)}
                  disabled={loading}
                  aria-describedby={field.hint ? `${field.id}-hint` : undefined}
                />
              )}
              {field.hint && <small id={`${field.id}-hint`}>{field.hint}</small>}
            </div>
          ))}
          <div className="config-push">
            <CustomButton text="Save" onClick={handleSave} busy={saving} done={saved} disabled={section.save_needs_load ? !loaded || loading : loading} />
            <CustomButton text="Reset" variant="quiet" onClick={() => setForm(stored)} disabled={!changed || saving} />
          </div>
        </div>
      </div>
      {section.note && <p className="config-note">{section.note}</p>}
    </>
  );
};

export default SettingsSection;

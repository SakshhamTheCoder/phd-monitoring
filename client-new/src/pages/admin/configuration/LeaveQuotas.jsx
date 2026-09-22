import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../../../components/forms/fields/CustomButton';
import { validateLeaveSettings } from '../../../utils/leaveBalance';
import { apiSettings, apiSaveSettings } from '../../../api/settings';
import './Configuration.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Leave quotas, read and written through the 'leave' settings group.
 *
 * A configuration section owns its own loading and saving rather than taking
 * them from Configuration.jsx: sections have nothing in common but the shell
 * they render into, and a shared loader would have to know every section's
 * endpoint.
 */
const LeaveQuotas = () => {
  const [form, setForm] = useState({ academic_quota: '', casual_quota: '', year_start_month: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiSettings('leave');
    setLoading(false);
    if (res.success) {
      setForm({
        academic_quota: res.response.academic_quota,
        casual_quota: res.response.casual_quota,
        year_start_month: res.response.year_start_month,
      });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const values = {
      academic_quota: Number(form.academic_quota),
      casual_quota: Number(form.casual_quota),
      year_start_month: Number(form.year_start_month),
    };
    const error = validateLeaveSettings(values);
    if (error) { toast.error(error); return; }
    setSaving(true);
    const res = await apiSaveSettings('leave', values);
    setSaving(false);
    if (res.success) {
      toast.success('Leave quota settings saved');
      setForm({
        academic_quota: res.response.academic_quota,
        casual_quota: res.response.casual_quota,
        year_start_month: res.response.year_start_month,
      });
    }
  };

  return (
    <div className="config-block">
      <div className="filter-bar">
        <div className="filter-row config-filter-row">
          <div className="input-field-container config-field-160">
            <label className="input-label" htmlFor="leave-quotas-academic-quota">Academic quota</label>
            <input
              id="leave-quotas-academic-quota"
              type="number"
              min="0"
              max="365"
              className="input-field"
              value={form.academic_quota}
              onChange={(e) => setForm((prev) => ({ ...prev, academic_quota: e.target.value }))}
              disabled={loading}
            />
          </div>
          <div className="input-field-container config-field-160">
            <label className="input-label" htmlFor="leave-quotas-casual-quota">Casual quota</label>
            <input
              id="leave-quotas-casual-quota"
              type="number"
              min="0"
              max="365"
              className="input-field"
              value={form.casual_quota}
              onChange={(e) => setForm((prev) => ({ ...prev, casual_quota: e.target.value }))}
              disabled={loading}
            />
          </div>
          <div className="input-field-container config-field-190">
            <label className="input-label" htmlFor="leave-quotas-quota-year-starts-in">Quota year starts in</label>
            <select
              id="leave-quotas-quota-year-starts-in"
              className="input-field"
              value={form.year_start_month}
              onChange={(e) => setForm((prev) => ({ ...prev, year_start_month: e.target.value }))}
              disabled={loading}
            >
              <option value="" disabled>Select a month</option>
              {MONTH_NAMES.map((name, idx) => <option key={name} value={idx + 1}>{name}</option>)}
            </select>
          </div>
          <div className="config-push">
            <CustomButton text={saving ? 'Saving…' : 'Save'} onClick={handleSave} disabled={loading || saving} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveQuotas;

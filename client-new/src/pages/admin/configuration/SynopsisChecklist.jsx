import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../../../components/forms/fields/CustomButton';
import TableComponent from '../../../components/forms/table/TableComponent';
import GridContainer from '../../../components/forms/fields/GridContainer';
import {
  apiChecklistCreate,
  apiChecklistDelete,
  apiChecklistList,
  apiChecklistUpdate,
} from '../../../api/synopsisChecklist';

const EMPTY = { admission_year: '', label: '', sort_order: '', active: true };

/**
 * The declarations a scholar chooses one of on their synopsis.
 *
 * The set depends on the year they registered, because a scholar submits under
 * the regulations in force when they joined. A year with no rows here asks the
 * scholar for nothing, so adding the first row for a year turns the question on.
 */
const SynopsisChecklist = () => {
  const [options, setOptions] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await apiChecklistList();
    if (res.success) setOptions(res.response);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const year = Number(form.admission_year);
    if (!Number.isInteger(year) || year < 1950 || year > 2100) {
      toast.error('Give the admission year as a four digit year.');
      return;
    }
    if (!form.label.trim()) {
      toast.error('A declaration needs wording the scholar will read.');
      return;
    }

    const body = {
      admission_year: year,
      label: form.label.trim(),
      sort_order: form.sort_order === '' ? 0 : Number(form.sort_order),
      active: !!form.active,
    };

    setBusy(true);
    const res = editing ? await apiChecklistUpdate(editing, body) : await apiChecklistCreate(body);
    setBusy(false);
    if (!res.success) return;

    toast.success(editing ? 'Declaration updated' : 'Declaration added');
    setForm(EMPTY);
    setEditing(null);
    load();
  };

  const remove = async (option) => {
    if (!window.confirm(`Remove "${option.label}" from ${option.admission_year}?`)) return;
    const res = await apiChecklistDelete(option.id);
    if (res.success) {
      toast.success('Declaration removed');
      load();
    }
  };

  const edit = (option) => {
    setEditing(option.id);
    setForm({
      admission_year: option.admission_year,
      label: option.label,
      sort_order: option.sort_order,
      active: option.active,
    });
  };

  const rows = options.map((option) => ({
    ...option,
    shown: option.active ? 'Offered' : 'Retired',
  }));

  return (
    <div style={{ marginTop: '1rem' }}>
      <div className="filter-bar">
        <div className="filter-row" style={{ alignItems: 'flex-end' }}>
          <div className="input-field-container" style={{ minWidth: '160px' }}>
            <label className="input-label" htmlFor="checklist-year">Admission year</label>
            <input
              id="checklist-year"
              type="number"
              min="1950"
              max="2100"
              className="input-field"
              placeholder="2023"
              value={form.admission_year}
              onChange={(e) => setForm((prev) => ({ ...prev, admission_year: e.target.value }))}
            />
          </div>
          <div className="input-field-container" style={{ minWidth: '380px' }}>
            <label className="input-label" htmlFor="checklist-label">Declaration</label>
            <input
              id="checklist-label"
              className="input-field"
              placeholder="I have published two SCI indexed papers"
              value={form.label}
              onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
            />
          </div>
          <div className="input-field-container" style={{ minWidth: '120px' }}>
            <label className="input-label" htmlFor="checklist-order">Order</label>
            <input
              id="checklist-order"
              type="number"
              min="0"
              max="1000"
              className="input-field"
              value={form.sort_order}
              onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
            />
          </div>
          <div className="input-field-container" style={{ minWidth: '140px' }}>
            <label className="input-label" htmlFor="checklist-active">
              <input
                id="checklist-active"
                type="checkbox"
                checked={!!form.active}
                onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
              />
              {' '}Offer this option
            </label>
          </div>
          <CustomButton text={editing ? 'Save changes' : 'Add declaration'} onClick={save} disabled={busy} />
          {editing && (
            <CustomButton
              text="Cancel"
              onClick={() => { setEditing(null); setForm(EMPTY); }}
            />
          )}
        </div>
      </div>

      <GridContainer
        label={`Declarations (${options.length})`}
        elements={[
          <TableComponent
            data={rows}
            keys={['admission_year', 'label', 'sort_order', 'shown', 'id']}
            titles={['Year', 'Declaration', 'Order', 'Status', ' ']}
            components={[{
              key: 'id',
              component: ({ row }) => (
                <>
                  <button type="button" className="icon-action" onClick={() => edit(row)} title="Edit declaration" aria-label="Edit declaration">
                    <i className="fa fa-pencil" aria-hidden="true"></i>
                  </button>
                  <button type="button" className="icon-action" onClick={() => remove(row)} title="Remove declaration" aria-label="Remove declaration">
                    <i className="fa fa-trash" aria-hidden="true"></i>
                  </button>
                </>
              ),
            }]}
          />,
        ]}
        space={3}
      />

      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
        A declaration a scholar has already chosen cannot be removed. Retire it instead
        and it stops being offered, while the forms that chose it still read back the
        wording that was agreed.
      </p>
    </div>
  );
};

export default SynopsisChecklist;

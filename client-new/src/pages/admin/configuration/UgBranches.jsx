import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../../../components/forms/fields/CustomButton';
import TableComponent from '../../../components/forms/table/TableComponent';
import GridContainer from '../../../components/forms/fields/GridContainer';
import InputSuggestions from '../../../components/forms/fields/InputSuggestions';
import UnifiedBulkImportModal from '../../../components/bulkImport/UnifiedBulkImportModal';
import { baseURL } from '../../../api/urls';
import { apiBranchCreate, apiBranchDelete, apiBranchImport, apiBranchList, apiBranchUpdate } from '../../../api/urf';
import { apiBranchOptions } from '../../../api/lookups';
import './Configuration.css';

const EMPTY = { programme: '', code: '', name: '', department_id: '', department: '' };

const SAMPLE_CSV = `programme,code,name,department_code
BE,COE,Computer Engineering,CSED
BE,ECE,Electronics and Communication Engineering,ECED
BTech,CSE,Computer Science and Engineering,CSED`;

/**
 * The branches a UG student can be on. Several can be taught by one
 * department, which is why this is not the departments page.
 */
const UgBranches = () => {
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // InputSuggestions ignores an empty initialValue, so clearing the form left
  // the old department in the picker. A new key starts it afresh.
  const [formResets, setFormResets] = useState(0);

  const load = useCallback(async () => {
    // Every write here ends in a reload of this list; the pickers elsewhere
    // share one cached copy, which has to go with it.
    apiBranchOptions.invalidate();
    const res = await apiBranchList();
    if (res.success) setBranches(res.response);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const body = {
      programme: form.programme.trim(),
      code: form.code.trim(),
      name: form.name.trim(),
      department_id: form.department_id || null,
    };
    if (!body.programme || !body.code || !body.name) {
      toast.error('A branch needs a programme, a code and a name.');
      return;
    }

    setBusy(true);
    const res = editing ? await apiBranchUpdate(editing, body) : await apiBranchCreate(body);
    setBusy(false);
    if (!res.success) return;

    toast.success(editing ? 'Branch updated' : 'Branch added');
    setForm(EMPTY);
    setEditing(null);
    setFormResets((count) => count + 1);
    load();
  };

  const remove = async (branch) => {
    if (!window.confirm(`Remove ${branch.programme} ${branch.name}?`)) return;
    const res = await apiBranchDelete(branch.id);
    if (res.success) {
      toast.success('Branch removed');
      load();
    }
  };

  const importRows = async (preview, reset) => {
    setImporting(true);
    const res = await apiBranchImport(preview.data);
    setImporting(false);

    if (!res.success) {
      toast.error(res.response?.message || 'Could not import the branches.');
      return;
    }

    const { added = 0, updated = 0, errors = [] } = res.response || {};
    toast.success(`${added} branches added, ${updated} updated`);
    errors.forEach((message) => toast.warn(message, { autoClose: 10000 }));
    reset();
    setImportOpen(false);
    load();
  };

  const edit = (branch) => {
    setEditing(branch.id);
    setForm({
      programme: branch.programme,
      code: branch.code,
      name: branch.name,
      department_id: branch.department_id || '',
      department: branch.department?.name || '',
    });
  };

  const rows = branches.map((branch) => ({
    ...branch,
    students: branch.students_count,
    department_name: branch.department?.name || 'Not set',
  }));

  return (
    <div className="config-block">
      <div className="filter-bar">
        <div className="filter-row config-filter-row">
          <div className="input-field-container config-field-140">
            <label className="input-label" htmlFor="ug-branches-programme">Programme</label>
            <input
              id="ug-branches-programme"
              className="input-field"
              placeholder="BE"
              value={form.programme}
              onChange={(e) => setForm((prev) => ({ ...prev, programme: e.target.value }))}
            />
          </div>
          <div className="input-field-container config-field-140">
            <label className="input-label" htmlFor="ug-branches-code">Code</label>
            <input
              id="ug-branches-code"
              className="input-field"
              placeholder="COE"
              value={form.code}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
            />
          </div>
          <div className="input-field-container config-field-280">
            <label className="input-label" htmlFor="ug-branches-branch-name">Branch name</label>
            <input
              id="ug-branches-branch-name"
              className="input-field"
              placeholder="Computer Engineering"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="input-field-container config-field-240">
            <InputSuggestions
              key={`${editing ?? 'new'}-${formResets}`}
              label="Department"
              apiUrl={`${baseURL}/suggestions/department`}
              initialValue={form.department}
              onSelect={(picked) => setForm((prev) => ({
                ...prev,
                department_id: picked?.id || '',
                department: picked?.name || '',
              }))}
            />
          </div>
          <CustomButton text={editing ? 'Save changes' : 'Add branch'} onClick={save} disabled={busy} />
          {!editing && <CustomButton text="Import CSV" onClick={() => setImportOpen(true)} />}
          {editing && (
            <CustomButton
              text="Cancel"
              onClick={() => { setEditing(null); setForm(EMPTY); setFormResets((count) => count + 1); }}
            />
          )}
        </div>
      </div>

      <GridContainer
        label={`Branches (${branches.length})`}
        elements={[
          <TableComponent
            data={rows}
            keys={['programme', 'code', 'name', 'department_name', 'students', 'id']}
            titles={['Programme', 'Code', 'Branch', 'Department', 'Students', ' ']}
            components={[{
              key: 'id',
              component: ({ row }) => (
                <>
                  <button type="button" className="icon-action" onClick={() => edit(row)} title="Edit branch" aria-label="Edit branch">
                    <i className="fa fa-pencil" aria-hidden="true"></i>
                  </button>
                  <button type="button" className="icon-action" onClick={() => remove(row)} title="Remove branch" aria-label="Remove branch">
                    <i className="fa fa-trash" aria-hidden="true"></i>
                  </button>
                </>
              ),
            }]}
          />,
        ]}
        space={3}
      />

      <UnifiedBulkImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Branches"
        required={['programme', 'code', 'name']}
        rules={[
          'Matched on programme and code, so importing the same file twice renames rather than duplicates.',
          'programme is the degree as the institute writes it, BE or BTech.',
          'Nothing is removed: a branch that leaves the file stays, and students on it keep their record.',
        ]}
        sampleFileName="ug_branches_sample.csv"
        sampleCsvContent={SAMPLE_CSV}
        onImport={importRows}
        submitting={importing}
      />
    </div>
  );
};

export default UgBranches;

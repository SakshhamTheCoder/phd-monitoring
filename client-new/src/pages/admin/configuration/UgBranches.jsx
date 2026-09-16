import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../../../components/forms/fields/CustomButton';
import TableComponent from '../../../components/forms/table/TableComponent';
import GridContainer from '../../../components/forms/fields/GridContainer';
import { apiBranchCreate, apiBranchDelete, apiBranchList, apiBranchUpdate } from '../../../api/urf';

const EMPTY = { programme: '', code: '', name: '' };

/**
 * The branches a UG student can be on, offered on sign-up and on the URF
 * application. A branch belongs to a programme (BE, BTech), and several
 * branches can be taught by one department, which is why this is its own list
 * rather than the departments page.
 */
const UgBranches = () => {
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await apiBranchList();
    if (res.success) setBranches(res.response);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const body = {
      programme: form.programme.trim(),
      code: form.code.trim(),
      name: form.name.trim(),
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

  const edit = (branch) => {
    setEditing(branch.id);
    setForm({ programme: branch.programme, code: branch.code, name: branch.name });
  };

  const rows = branches.map((branch) => ({ ...branch, students: branch.students_count }));

  return (
    <div style={{ marginTop: '1rem' }}>
      <div className="filter-bar">
        <div className="filter-row" style={{ alignItems: 'flex-end' }}>
          <div className="input-field-container" style={{ minWidth: '140px' }}>
            <label className="input-label" htmlFor="programme">Programme</label>
            <input
              id="programme"
              className="input-field"
              placeholder="BE"
              value={form.programme}
              onChange={(e) => setForm((prev) => ({ ...prev, programme: e.target.value }))}
            />
          </div>
          <div className="input-field-container" style={{ minWidth: '140px' }}>
            <label className="input-label" htmlFor="code">Code</label>
            <input
              id="code"
              className="input-field"
              placeholder="COE"
              value={form.code}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
            />
          </div>
          <div className="input-field-container" style={{ minWidth: '280px' }}>
            <label className="input-label" htmlFor="name">Branch name</label>
            <input
              id="name"
              className="input-field"
              placeholder="Computer Engineering"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <CustomButton text={editing ? 'Save changes' : 'Add branch'} onClick={save} disabled={busy} />
          {editing && (
            <CustomButton
              text="Cancel"
              onClick={() => { setEditing(null); setForm(EMPTY); }}
            />
          )}
        </div>
      </div>

      <GridContainer
        label={`Branches (${branches.length})`}
        elements={[
          <TableComponent
            data={rows}
            keys={['programme', 'code', 'name', 'students', 'id']}
            titles={['Programme', 'Code', 'Branch', 'Students', ' ']}
            components={[{
              key: 'id',
              component: ({ row }) => (
                <>
                  <a
                    onClick={() => edit(row)}
                    style={{ cursor: 'pointer', marginRight: 12, color: '#991b1b' }}
                    title="Edit branch"
                  >
                    <i className="fa fa-pencil" aria-hidden="true"></i>
                  </a>
                  <a
                    onClick={() => remove(row)}
                    style={{ cursor: 'pointer', color: '#991b1b' }}
                    title="Remove branch"
                  >
                    <i className="fa fa-trash" aria-hidden="true"></i>
                  </a>
                </>
              ),
            }]}
          />,
        ]}
        space={3}
      />
    </div>
  );
};

export default UgBranches;

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../../../components/forms/fields/CustomButton';
import TableComponent from '../../../components/forms/table/TableComponent';
import GridContainer from '../../../components/forms/fields/GridContainer';
import InputSuggestions from '../../../components/forms/fields/InputSuggestions';
import { baseURL } from '../../../api/urls';
import './Configuration.css';
import {
  apiChecklistCreate,
  apiChecklistDelete,
  apiChecklistList,
  apiChecklistRuleCreate,
  apiChecklistRuleDelete,
  apiChecklistRuleUpdate,
  apiChecklistUpdate,
} from '../../../api/synopsisChecklist';

const EMPTY_RULE = {
  name: '',
  departments: [],
  admitted_from: '',
  admitted_to: '',
  exclusive: false,
  sort_order: '',
  active: true,
};

const EMPTY_OPTION = { label: '', sort_order: '', active: true };

const onDate = (value) => (value ? String(value).slice(0, 10) : '');

/**
 * The publication categories a supervisor declares on a synopsis.
 *
 * Which categories a scholar is offered is decided by conditions: a set of
 * departments, a range of admission dates, or both. A scholar is offered every
 * category whose condition they meet, merged into one list, unless a condition
 * they meet is marked as standing alone.
 */
const SynopsisChecklist = () => {
  const [rules, setRules] = useState([]);
  const [rule, setRule] = useState(EMPTY_RULE);
  const [editingRule, setEditingRule] = useState(null);
  const [openRule, setOpenRule] = useState(null);
  const [option, setOption] = useState(EMPTY_OPTION);
  const [editingOption, setEditingOption] = useState(null);
  const [busy, setBusy] = useState(false);

  // A category half edited under one condition must not be saved into the
  // next one opened, since the save sends the open condition as its rule.
  const showRule = (ruleId) => {
    setOpenRule(ruleId);
    setEditingOption(null);
    setOption(EMPTY_OPTION);
  };

  const load = useCallback(async () => {
    const res = await apiChecklistList();
    if (res.success) setRules(res.response);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveRule = async () => {
    if (!rule.name.trim()) {
      toast.error('A condition needs a name, so an admin can tell it from the others.');
      return;
    }
    if (rule.admitted_from && rule.admitted_to && rule.admitted_from > rule.admitted_to) {
      toast.error('The admitted-from date has to fall on or before the admitted-to date.');
      return;
    }

    const body = {
      name: rule.name.trim(),
      department_ids: rule.departments.map((department) => department.id),
      admitted_from: rule.admitted_from || null,
      admitted_to: rule.admitted_to || null,
      exclusive: !!rule.exclusive,
      sort_order: rule.sort_order === '' ? 0 : Number(rule.sort_order),
      active: !!rule.active,
    };

    setBusy(true);
    const res = editingRule ? await apiChecklistRuleUpdate(editingRule, body) : await apiChecklistRuleCreate(body);
    setBusy(false);
    if (!res.success) return;

    toast.success(editingRule ? 'Condition updated' : 'Condition added');
    setRule(EMPTY_RULE);
    setEditingRule(null);
    load();
  };

  const editRule = (row) => {
    setEditingRule(row.id);
    setRule({
      name: row.name,
      departments: row.departments || [],
      admitted_from: onDate(row.admitted_from),
      admitted_to: onDate(row.admitted_to),
      exclusive: row.exclusive,
      sort_order: row.sort_order,
      active: row.active,
    });
  };

  const removeRule = async (row) => {
    if (!window.confirm(`Remove "${row.name}" and the ${row.options.length} category(s) under it?`)) return;
    const res = await apiChecklistRuleDelete(row.id);
    if (res.success) {
      toast.success('Condition removed');
      if (openRule === row.id) showRule(null);
      load();
    }
  };

  const saveOption = async () => {
    if (!option.label.trim()) {
      toast.error('A category needs wording the supervisor will read.');
      return;
    }

    const body = {
      rule_id: openRule,
      label: option.label.trim(),
      sort_order: option.sort_order === '' ? 0 : Number(option.sort_order),
      active: !!option.active,
    };

    setBusy(true);
    const res = editingOption ? await apiChecklistUpdate(editingOption, body) : await apiChecklistCreate(body);
    setBusy(false);
    if (!res.success) return;

    toast.success(editingOption ? 'Category updated' : 'Category added');
    setOption(EMPTY_OPTION);
    setEditingOption(null);
    load();
  };

  const removeOption = async (row) => {
    if (!window.confirm(`Remove "${row.label}"?`)) return;
    const res = await apiChecklistDelete(row.id);
    if (res.success) {
      toast.success('Category removed');
      load();
    }
  };

  /** The condition in one line, as an admin would read it back. */
  const appliesTo = (row) => {
    const departments = row.departments?.length
      ? row.departments.map((department) => department.name).join(', ')
      : 'Any department';
    const from = onDate(row.admitted_from);
    const to = onDate(row.admitted_to);

    if (!from && !to) return departments;
    if (from && to) return `${departments}, admitted ${from} to ${to}`;
    return from
      ? `${departments}, admitted on or after ${from}`
      : `${departments}, admitted on or before ${to}`;
  };

  const ruleRows = rules.map((row) => ({
    ...row,
    applies: appliesTo(row),
    merging: row.exclusive ? 'Stands alone' : 'Merged',
    categories: `${row.options.filter((one) => one.active).length} of ${row.options.length}`,
    shown: row.active ? 'In use' : 'Retired',
  }));

  const open = rules.find((row) => row.id === openRule);
  const optionRows = (open?.options || []).map((row) => ({
    ...row,
    shown: row.active ? 'Offered' : 'Retired',
  }));

  return (
    <div className="config-block">
      <div className="filter-bar">
        <div className="filter-row config-filter-row">
          <div className="input-field-container config-field-240">
            <label className="input-label" htmlFor="rule-name">Condition</label>
            <input
              id="rule-name"
              className="input-field"
              placeholder="All other departments"
              value={rule.name}
              onChange={(e) => setRule((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="input-field-container config-field-240">
            <InputSuggestions
              label="Add a department"
              apiUrl={`${baseURL}/suggestions/department`}
              onSelect={(picked) => {
                if (!picked?.id) return;
                setRule((prev) => (
                  prev.departments.some((department) => department.id === picked.id)
                    ? prev
                    : { ...prev, departments: [...prev.departments, { id: picked.id, name: picked.name }] }
                ));
              }}
            />
          </div>
          <div className="input-field-container config-field-160">
            <label className="input-label" htmlFor="rule-from">Admitted from</label>
            <input
              id="rule-from"
              type="date"
              className="input-field"
              value={rule.admitted_from}
              onChange={(e) => setRule((prev) => ({ ...prev, admitted_from: e.target.value }))}
            />
          </div>
          <div className="input-field-container config-field-160">
            <label className="input-label" htmlFor="rule-to">Admitted to</label>
            <input
              id="rule-to"
              type="date"
              className="input-field"
              value={rule.admitted_to}
              onChange={(e) => setRule((prev) => ({ ...prev, admitted_to: e.target.value }))}
            />
          </div>
          <div className="input-field-container config-field-110">
            <label className="input-label" htmlFor="rule-order">Order</label>
            <input
              id="rule-order"
              type="number"
              min="0"
              max="1000"
              className="input-field"
              value={rule.sort_order}
              onChange={(e) => setRule((prev) => ({ ...prev, sort_order: e.target.value }))}
            />
          </div>
          <div className="input-field-container config-field-220">
            <label className="input-label" htmlFor="rule-exclusive">
              <input
                id="rule-exclusive"
                type="checkbox"
                checked={!!rule.exclusive}
                onChange={(e) => setRule((prev) => ({ ...prev, exclusive: e.target.checked }))}
              />
              {' '}These categories stand alone
            </label>
          </div>
          <div className="input-field-container config-field-160">
            <label className="input-label" htmlFor="rule-active">
              <input
                id="rule-active"
                type="checkbox"
                checked={!!rule.active}
                onChange={(e) => setRule((prev) => ({ ...prev, active: e.target.checked }))}
              />
              {' '}Apply this condition
            </label>
          </div>
          <CustomButton text={editingRule ? 'Save changes' : 'Add condition'} onClick={saveRule} disabled={busy} />
          {editingRule && (
            <CustomButton text="Cancel" onClick={() => { setEditingRule(null); setRule(EMPTY_RULE); }} />
          )}
        </div>

        {rule.departments.length > 0 && (
          <div className="filter-row config-chip-row">
            {rule.departments.map((department) => (
              <button
                key={department.id}
                type="button"
                className="icon-action"
                title={`Remove ${department.name} from this condition`}
                onClick={() => setRule((prev) => ({
                  ...prev,
                  departments: prev.departments.filter((one) => one.id !== department.id),
                }))}
              >
                {department.name} <i className="fa fa-times" aria-hidden="true"></i>
              </button>
            ))}
          </div>
        )}
      </div>

      <GridContainer
        label={`Conditions (${rules.length})`}
        elements={[
          <TableComponent
            data={ruleRows}
            keys={['name', 'applies', 'merging', 'categories', 'shown', 'id']}
            titles={['Condition', 'Applies to', 'Merging', 'Categories', 'Status', ' ']}
            components={[{
              key: 'id',
              component: ({ row }) => (
                <>
                  <button type="button" className="icon-action" onClick={() => showRule(row.id === openRule ? null : row.id)} title="Show the categories under this condition" aria-label="Show the categories under this condition">
                    <i className="fa fa-list" aria-hidden="true"></i>
                  </button>
                  <button type="button" className="icon-action" onClick={() => editRule(row)} title="Edit condition" aria-label="Edit condition">
                    <i className="fa fa-pencil" aria-hidden="true"></i>
                  </button>
                  <button type="button" className="icon-action" onClick={() => removeRule(row)} title="Remove condition" aria-label="Remove condition">
                    <i className="fa fa-trash" aria-hidden="true"></i>
                  </button>
                </>
              ),
            }]}
          />,
        ]}
        space={3}
      />

      {open && (
        <>
          <div className="filter-bar config-block">
            <div className="filter-row config-filter-row">
              <div className="input-field-container config-field-440">
                <label className="input-label" htmlFor="option-label">Category under {open.name}</label>
                <input
                  id="option-label"
                  className="input-field"
                  placeholder="Two SCI publications (excluding review articles)"
                  value={option.label}
                  onChange={(e) => setOption((prev) => ({ ...prev, label: e.target.value }))}
                />
              </div>
              <div className="input-field-container config-field-110">
                <label className="input-label" htmlFor="option-order">Order</label>
                <input
                  id="option-order"
                  type="number"
                  min="0"
                  max="1000"
                  className="input-field"
                  value={option.sort_order}
                  onChange={(e) => setOption((prev) => ({ ...prev, sort_order: e.target.value }))}
                />
              </div>
              <div className="input-field-container config-field-160">
                <label className="input-label" htmlFor="option-active">
                  <input
                    id="option-active"
                    type="checkbox"
                    checked={!!option.active}
                    onChange={(e) => setOption((prev) => ({ ...prev, active: e.target.checked }))}
                  />
                  {' '}Offer this category
                </label>
              </div>
              <CustomButton text={editingOption ? 'Save changes' : 'Add category'} onClick={saveOption} disabled={busy} />
              {editingOption && (
                <CustomButton text="Cancel" onClick={() => { setEditingOption(null); setOption(EMPTY_OPTION); }} />
              )}
            </div>
          </div>

          <GridContainer
            label={`Categories under ${open.name} (${optionRows.length})`}
            elements={[
              <TableComponent
                data={optionRows}
                keys={['label', 'sort_order', 'shown', 'id']}
                titles={['Category', 'Order', 'Status', ' ']}
                components={[{
                  key: 'id',
                  component: ({ row }) => (
                    <>
                      <button
                        type="button"
                        className="icon-action"
                        title="Edit category"
                        aria-label="Edit category"
                        onClick={() => {
                          setEditingOption(row.id);
                          setOption({ label: row.label, sort_order: row.sort_order, active: row.active });
                        }}
                      >
                        <i className="fa fa-pencil" aria-hidden="true"></i>
                      </button>
                      <button type="button" className="icon-action" onClick={() => removeOption(row)} title="Remove category" aria-label="Remove category">
                        <i className="fa fa-trash" aria-hidden="true"></i>
                      </button>
                    </>
                  ),
                }]}
              />,
            ]}
            space={3}
          />
        </>
      )}

      <p className="config-note">
        A scholar is offered every category whose condition they meet, merged into one list, in
        condition order. A condition that stands alone answers on its own: when a scholar meets
        it, the conditions everyone else reads are left out, which is how a department with a
        complete set of its own is written. Two conditions that stand alone still merge with
        each other, so where one department's rules changed on a date, give each of its
        conditions its own date window. A category a supervisor has already declared cannot
        be removed; retire it instead and the forms that chose it still read back the wording
        that was agreed.
      </p>
    </div>
  );
};

export default SynopsisChecklist;

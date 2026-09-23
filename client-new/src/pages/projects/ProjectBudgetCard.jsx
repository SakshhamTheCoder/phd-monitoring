import React, { useState } from 'react';
import { toast } from 'react-toastify';
import {
  subVal, setSubCell, headTotal, yearTotal, grandTotal, budgetYears as budgetYearsOf,
  subItemsTotal, headSubMismatch,
  manpowerCell, setManpowerCell, unionLabels,
  manpowerTotal, equipmentTotal, typedHead, setTypedHead,
  equipRows, equipLine, setEquipAmount, renameEquipRow, dropEquipRow, addEquipRow,
  otherRows, otherSubRows, otherLine, otherSubTotal, otherSubMismatch,
  setOtherAmount, renameOtherRow, dropOtherRow, addOtherRow,
  KEY_MANPOWER, HEAD_MANPOWER, HEAD_EQUIPMENT, HEAD_OTHER,
} from '../../data/projectsData';
import { EMPTY_VALUE } from '../../utils/timeParse';
import { apiUpdateProject } from '../../api/projects';
import Panel from '../../components/panel/Panel';
import CustomButton from '../../components/forms/fields/CustomButton';

/**
 * The project's budget, read and edited in place.
 *
 * One card on one tab, and it was a third of ProjectDetails: three pieces of
 * state and every row renderer for manpower, equipment and other expenses.
 * The page now passes what the card needs and is told when it saves.
 */
const ProjectBudgetCard = ({ projectId, budget, meta, canEdit, onSaved }) => {
  const budgetData = budget;
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState({});
  const startBudgetEdit = () => { setBudgetDraft(JSON.parse(JSON.stringify(budgetData))); setEditingBudget(true); };
  const cancelBudgetEdit = () => setEditingBudget(false);
  const updateBudgetCell = (year, head, value) => {
    setBudgetDraft(prev => ({ ...prev, [year]: { ...prev[year], [head]: value === '' ? 0 : Number(value) } }));
  };
  const updateSubCell = (year, head, sub, value) => {
    setBudgetDraft(prev => setSubCell(prev, year, head, sub, value));
  };
  const saveBudgetEdit = async () => {
    const res = await apiUpdateProject(projectId, { budget: budgetDraft });
    if (res.success) { onSaved(budgetDraft); setEditingBudget(false); toast.success('Budget updated.'); }
  };

  // In-table editing for the derived heads, mirroring the create wizard:
  // fixed manpower category rows, self-added equipment rows, and Any Other
  // Expenses rows that may own sub-rows. Any of the three may instead carry a
  // hand-typed head total that overrides its breakdown.
  const manpowerCats = (meta.manpowerCategories && meta.manpowerCategories.length)
    ? meta.manpowerCategories : ['Postdoc', 'JRF', 'SRF', 'UG Intern', 'PG Intern'];
  const extraManpowerCats = (b) => unionLabels(b, KEY_MANPOWER, 'category')
    .filter(c => c && !manpowerCats.includes(c));
  const equipItems = (b) => equipRows(b);

  const editManpower = (y, cat, field, value) =>
    setBudgetDraft(prev => setManpowerCell(prev, y, cat, field, value));
  const editEquipAmount = (y, key, value) =>
    setBudgetDraft(prev => setEquipAmount(prev, y, key, value));
  const renameEquip = (key, label) =>
    setBudgetDraft(prev => renameEquipRow(prev, key, label));
  const addEquip = () =>
    setBudgetDraft(prev => addEquipRow(prev, budgetYears));
  const dropEquip = (key) =>
    setBudgetDraft(prev => dropEquipRow(prev, key));
  const editTypedHead = (y, head, value) =>
    setBudgetDraft(prev => setTypedHead(prev, y, head, value));
  const editOther = (y, key, parentKey, value) =>
    setBudgetDraft(prev => setOtherAmount(prev, y, key, parentKey, value));
  const renameOther = (key, label) =>
    setBudgetDraft(prev => renameOtherRow(prev, key, label));
  const dropOther = (key) =>
    setBudgetDraft(prev => dropOtherRow(prev, key));
  const addOther = (parentKey) =>
    setBudgetDraft(prev => addOtherRow(prev, budgetYears, parentKey));

  // One table in budgetHeads order (Manpower, Travel, Equipment, Consumables,
  // Contingency, Overhead, Other Expenses), mirroring the wizard.
  const pdHeadSum = (b, head, y) =>
    head === HEAD_MANPOWER ? manpowerTotal(b, y) : equipmentTotal(b, y);
  const pdHeadMismatch = (b, head, y) => {
    const typed = typedHead(b, y, head);
    const sum = pdHeadSum(b, head, y);
    return typed !== null && sum > 0 && typed !== sum;
  };

  // The head cell: a typed total when there is one, otherwise the breakdown's
  // own sum. Editable only while the budget is in edit mode.
  const renderPdHeadCells = (b, head) => budgetYears.map(y => {
    const sum = pdHeadSum(b, head, y);
    const bad = pdHeadMismatch(b, head, y);
    if (!editingBudget) {
      return (
        <td key={y} className={bad ? 'pd-budget-bad' : undefined}
          title={bad ? `Breakdown sums to ₹${sum.toLocaleString('en-IN')}` : undefined}>
          ₹{headTotal(b, y, head).toLocaleString('en-IN')}{bad ? ' ⚠' : ''}
        </td>
      );
    }
    const typed = typedHead(budgetDraft, y, head);
    return (
      <td key={y}>
        <input type="number" min="0" className="pd-budget-edit-input"
          value={typed === null ? '' : typed}
          placeholder={pdHeadSum(budgetDraft, head, y) ? String(pdHeadSum(budgetDraft, head, y)) : '0'}
          title="Leave blank to use the breakdown below"
          onChange={e => editTypedHead(y, head, e.target.value)} />
      </td>
    );
  });

  const renderManpowerRows = (b) => (
    <>
      <tr className="pd-budget-head-row">
        <td className="pd-budget-head-name">{HEAD_MANPOWER}</td>
        {renderPdHeadCells(b, HEAD_MANPOWER)}
        <td className="pd-bh-total">₹{budgetYears.reduce((s, y) => s + headTotal(b, y, HEAD_MANPOWER), 0).toLocaleString('en-IN')}</td>
      </tr>
      {[...manpowerCats, ...extraManpowerCats(b)].map(cat => (
        <tr key={cat} className="pd-budget-sub-row">
          <td className="pd-budget-sub-name">↳ {cat}(s)</td>
          {budgetYears.map(y => {
            const amt = Number(manpowerCell(b, y, cat).amount) || 0;
            return (
              <td key={y} className="pd-budget-sub-cell">
                {editingBudget ? (
                  <input type="number" min="0" className="pd-budget-edit-input" title="Amount (₹)"
                    value={manpowerCell(budgetDraft, y, cat).amount || ''} placeholder="0"
                    onChange={e => editManpower(y, cat, 'amount', e.target.value)} />
                ) : (
                  <>{amt ? `₹${amt.toLocaleString('en-IN')}` : EMPTY_VALUE}</>
                )}
              </td>
            );
          })}
          <td className="pd-budget-sub-total">₹{budgetYears.reduce((s, y) =>
            s + (Number(manpowerCell(b, y, cat).amount) || 0), 0).toLocaleString('en-IN')}</td>
        </tr>
      ))}
    </>
  );

  const renderEquipmentRows = (b) => (
    <>
      <tr className="pd-budget-head-row">
        <td className="pd-budget-head-name">{HEAD_EQUIPMENT}
          {editingBudget && (
            <button type="button" className="inline-add-btn inline-add-btn--sm" onClick={addEquip}>
              <i className="fa fa-plus" aria-hidden="true"></i> Add item
            </button>
          )}
        </td>
        {renderPdHeadCells(b, HEAD_EQUIPMENT)}
        <td className="pd-bh-total">₹{budgetYears.reduce((s, y) => s + headTotal(b, y, HEAD_EQUIPMENT), 0).toLocaleString('en-IN')}</td>
      </tr>
      {equipItems(editingBudget ? budgetDraft : b).map(row => (
        <tr key={row.key} className="pd-budget-sub-row">
          <td className="pd-budget-sub-name">
            {editingBudget ? (
              <span className="pd-budget-countpair">
                <input type="text" className="pd-budget-edit-input" value={row.label}
                  placeholder="e.g. GPU Workstation"
                  onChange={e => renameEquip(row.key, e.target.value)} />
                <button type="button" className="pd-remove-btn" title="Remove item" aria-label="Remove item"
                  onClick={() => dropEquip(row.key)}>
                  <i className="fa fa-trash" aria-hidden="true"></i>
                </button>
              </span>
            ) : <>↳ {row.label || EMPTY_VALUE}</>}
          </td>
          {budgetYears.map(y => {
            const amt = Number(((equipLine(b, y, row.key) || {}).amount) || 0);
            return (
              <td key={y} className="pd-budget-sub-cell">
                {editingBudget ? (
                  <input type="number" min="0" className="pd-budget-edit-input"
                    value={(equipLine(budgetDraft, y, row.key) || {}).amount || ''}
                    placeholder="0"
                    onChange={e => editEquipAmount(y, row.key, e.target.value)} />
                ) : (
                  <>{amt ? `₹${amt.toLocaleString('en-IN')}` : EMPTY_VALUE}</>
                )}
              </td>
            );
          })}
          <td className="pd-budget-sub-total">₹{budgetYears.reduce((s, y) =>
            s + Number(((equipLine(b, y, row.key) || {}).amount) || 0), 0).toLocaleString('en-IN')}</td>
        </tr>
      ))}
    </>
  );

  // Other Expenses: named rows that may own sub-items. The parent row holds the
  // money; its sub-items break it down and never add to the head on their own.
  const renderOtherRows = (b) => {
    const src = editingBudget ? budgetDraft : b;
    const rows = otherRows(src);
    return (
      <>
        <tr className="pd-budget-head-row">
          <td className="pd-budget-head-name">{HEAD_OTHER}
            {editingBudget && (
              <button type="button" className="inline-add-btn inline-add-btn--sm" onClick={() => addOther('')}>
                <i className="fa fa-plus" aria-hidden="true"></i> Add expense
              </button>
            )}
          </td>
          {budgetYears.map(y => <td key={y}>₹{headTotal(b, y, HEAD_OTHER).toLocaleString('en-IN')}</td>)}
          <td className="pd-bh-total">₹{budgetYears.reduce((s, y) => s + headTotal(b, y, HEAD_OTHER), 0).toLocaleString('en-IN')}</td>
        </tr>
        {rows.map(row => {
          const subs = otherSubRows(src, row.key);
          return (
            <React.Fragment key={row.key}>
              <tr className="pd-budget-sub-row">
                <td className="pd-budget-sub-name">
                  {editingBudget ? (
                    <span className="pd-budget-countpair">
                      <input type="text" className="pd-budget-edit-input" value={row.label}
                        placeholder="e.g. Fabrication"
                        onChange={e => renameOther(row.key, e.target.value)} />
                      <button type="button" className="inline-add-btn inline-add-btn--sm" title="Add sub-item" aria-label="Add sub-item"
                        onClick={() => addOther(row.key)}>
                        <i className="fa fa-plus" aria-hidden="true"></i>
                      </button>
                      <button type="button" className="pd-remove-btn" title="Remove expense" aria-label="Remove expense"
                        onClick={() => dropOther(row.key)}>
                        <i className="fa fa-trash" aria-hidden="true"></i>
                      </button>
                    </span>
                  ) : <>↳ {row.label || EMPTY_VALUE}</>}
                </td>
                {budgetYears.map(y => {
                  const amt = Number(((otherLine(b, y, row.key) || {}).amount) || 0);
                  const bad = otherSubMismatch(b, y, row.key);
                  return (
                    <td key={y} className="pd-budget-sub-cell">
                      {editingBudget ? (
                        <input type="number" min="0" className="pd-budget-edit-input"
                          value={(otherLine(budgetDraft, y, row.key) || {}).amount || ''}
                          placeholder="0"
                          onChange={e => editOther(y, row.key, '', e.target.value)} />
                      ) : (
                        <span className={bad ? 'pd-budget-bad' : undefined}
                          title={bad ? `Sub-items sum to ₹${otherSubTotal(b, y, row.key).toLocaleString('en-IN')}` : undefined}>
                          {amt ? `₹${amt.toLocaleString('en-IN')}` : EMPTY_VALUE}{bad ? ' ⚠' : ''}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="pd-budget-sub-total">₹{budgetYears.reduce((s, y) =>
                  s + Number(((otherLine(b, y, row.key) || {}).amount) || 0), 0).toLocaleString('en-IN')}</td>
              </tr>
              {subs.map(sub => (
                <tr key={sub.key} className="pd-budget-sub-row pd-budget-subsub-row">
                  <td className="pd-budget-sub-name">
                    {editingBudget ? (
                      <span className="pd-budget-countpair">
                        <input type="text" className="pd-budget-edit-input" value={sub.label}
                          placeholder="e.g. Casting"
                          onChange={e => renameOther(sub.key, e.target.value)} />
                        <button type="button" className="pd-remove-btn" title="Remove sub-item" aria-label="Remove sub-item"
                          onClick={() => dropOther(sub.key)}>
                          <i className="fa fa-trash" aria-hidden="true"></i>
                        </button>
                      </span>
                    ) : <>↳ {sub.label || EMPTY_VALUE}</>}
                  </td>
                  {budgetYears.map(y => {
                    const amt = Number(((otherLine(b, y, sub.key) || {}).amount) || 0);
                    return (
                      <td key={y} className="pd-budget-sub-cell">
                        {editingBudget ? (
                          <input type="number" min="0" className="pd-budget-edit-input"
                            value={(otherLine(budgetDraft, y, sub.key) || {}).amount || ''}
                            placeholder="0"
                            onChange={e => editOther(y, sub.key, row.key, e.target.value)} />
                        ) : (
                          <>{amt ? `₹${amt.toLocaleString('en-IN')}` : EMPTY_VALUE}</>
                        )}
                      </td>
                    );
                  })}
                  <td className="pd-budget-sub-total">₹{budgetYears.reduce((s, y) =>
                    s + Number(((otherLine(b, y, sub.key) || {}).amount) || 0), 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </React.Fragment>
          );
        })}
      </>
    );
  };

  // Co-PI management. An internal Co-PI must carry a faculty_code, since that is
  // what grants them access to the project.
  const activeBudget = editingBudget ? budgetDraft : budgetData;
  const budgetYears = budgetYearsOf(budgetData);
  const yTotal = (y) => yearTotal(activeBudget, y, meta.budgetHeads);
  const gTotal = grandTotal(activeBudget, meta.budgetHeads);
  // Total across all years for a single head (for the head row's Total column).
  const headAllYearsTotal = (h) => budgetYears.reduce((s, y) => s + headTotal(activeBudget, y, h), 0);
  // Total across all years for a single sub-item (for the sub-row Total column).
  const subYearTotal = (head, sub) => budgetYears.reduce((s, y) => s + subVal(activeBudget, y, head, sub), 0);


  if (budgetYears.length === 0) return null;

  return (
            <Panel
              flush
              title="Budget breakdown"
              actions={editingBudget ? (
                <>
                  <CustomButton text="Save changes" variant="secondary" size="sm" onClick={saveBudgetEdit} />
                  <CustomButton text="Cancel" variant="quiet" size="sm" onClick={cancelBudgetEdit} />
                </>
              ) : (
                canEdit && <CustomButton text="Edit budget" variant="secondary" size="sm" onClick={startBudgetEdit} />
              )}
            >
              <div className="data-table-wrap">
                <table className="data-table pd-budget-table">
                  <thead>
                    <tr>
                      <th>Budget head</th>
                      {budgetYears.map((y, i) => <th key={y}>Year {i + 1} (₹)</th>)}
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meta.budgetHeads.map(bh => {
                      if (bh.head === HEAD_MANPOWER) return <React.Fragment key={bh.head}>{renderManpowerRows(activeBudget)}</React.Fragment>;
                      if (bh.head === HEAD_EQUIPMENT) return <React.Fragment key={bh.head}>{renderEquipmentRows(activeBudget)}</React.Fragment>;
                      if (bh.head === HEAD_OTHER) return <React.Fragment key={bh.head}>{renderOtherRows(activeBudget)}</React.Fragment>;
                      return (
                      <React.Fragment key={bh.head}>
                        <tr className="pd-budget-head-row">
                          <td className="pd-budget-head-name">{bh.head}</td>
                          {budgetYears.map(y => {
                            const mism = editingBudget && bh.subItems.length > 0 && headSubMismatch(budgetDraft, y, bh.head, bh.subItems);
                            return (
                              <td key={y}>
                                {editingBudget ? (
                                  <input
                                    type="number" min="0"
                                    className={`pd-budget-edit-input${mism ? ' pd-budget-mismatch' : ''}`}
                                    value={budgetDraft[y]?.[bh.head] ?? 0}
                                    onChange={e => updateBudgetCell(y, bh.head, e.target.value)}
                                    title={mism ? `Sub-items sum to ₹${subItemsTotal(budgetDraft, y, bh.head, bh.subItems).toLocaleString('en-IN')}` : undefined}
                                  />
                                ) : (
                                  <>₹{(budgetData[y]?.[bh.head] || 0).toLocaleString('en-IN')}</>
                                )}
                              </td>
                            );
                          })}
                          <td className="pd-bh-total">₹{headAllYearsTotal(bh.head).toLocaleString('en-IN')}</td>
                        </tr>
                        {bh.subItems.map(sub => (
                          <tr key={sub} className="pd-budget-sub-row">
                            <td className="pd-budget-sub-name">↳ {sub}</td>
                            {budgetYears.map(y => (
                              <td key={y} className="pd-budget-sub-cell">
                                {editingBudget ? (
                                  <input
                                    type="number"
                                    className="pd-budget-edit-input sub"
                                    value={subVal(budgetDraft, y, bh.head, sub) || 0}
                                    onChange={e => updateSubCell(y, bh.head, sub, e.target.value)}
                                  />
                                ) : (
                                  <>{subVal(budgetData, y, bh.head, sub) ? `₹${subVal(budgetData, y, bh.head, sub).toLocaleString('en-IN')}` : EMPTY_VALUE}</>
                                )}
                              </td>
                            ))}
                            <td className="pd-budget-sub-total">{subYearTotal(bh.head, sub) ? `₹${subYearTotal(bh.head, sub).toLocaleString('en-IN')}` : ''}</td>
                          </tr>
                        ))}
                        {editingBudget && bh.subItems.length > 0 && (
                          <tr className="pd-budget-subsum-row">
                            <td className="pd-budget-sub-name">↳ sub-items total</td>
                            {budgetYears.map(y => {
                              const total = subItemsTotal(budgetDraft, y, bh.head, bh.subItems);
                              const bad = headSubMismatch(budgetDraft, y, bh.head, bh.subItems);
                              return (
                                <td key={y} className={`pd-budget-subsum${bad ? ' bad' : (total > 0 ? ' ok' : '')}`}>
                                  ₹{total.toLocaleString('en-IN')}{bad ? ' ⚠' : (total > 0 ? ' ✓' : '')}
                                </td>
                              );
                            })}
                            <td></td>
                          </tr>
                        )}
                      </React.Fragment>
                      );
                    })}
                    <tr className="pd-grand-row">
                      <td><strong>Grand total</strong></td>
                      {budgetYears.map(y => <td key={y}><strong>₹{yTotal(y).toLocaleString('en-IN')}</strong></td>)}
                      <td className="pd-grand-total"><strong>₹{gTotal.toLocaleString('en-IN')}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Panel>
  );
};

export default ProjectBudgetCard;

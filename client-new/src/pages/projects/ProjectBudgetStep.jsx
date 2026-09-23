import React from 'react';
import {
  subVal, setSubCell, headTotal, yearTotal, grandTotal,
  subItemsTotal, headSubMismatch,
  manpowerCell, setManpowerCell, unionLabels,
  manpowerTotal, equipmentTotal, typedHead, setTypedHead,
  equipRows, equipLine, setEquipAmount, renameEquipRow, dropEquipRow, addEquipRow,
  otherRows, otherSubRows, otherLine, otherSubTotal, otherSubMismatch,
  setOtherAmount, renameOtherRow, dropOtherRow, addOtherRow,
  KEY_MANPOWER, HEAD_MANPOWER, HEAD_EQUIPMENT, HEAD_OTHER,
} from '../../data/projectsData';
import { PanelSection } from '../../components/panel/Panel';

/**
 * The budget table on the wizard's funding step.
 *
 * Always editable, unlike the card on the project page, which is the same
 * table with a read mode. Takes the budget and returns the next one rather
 * than reaching into the wizard's form.
 */
const ProjectBudgetStep = ({ budget, years: budgetYears, meta, onChange }) => {
  const updateBudget = (year, head, value) => {
    onChange({ ...budget, [year]: { ...budget[year], [head]: parseFloat(value) || 0 } });
  };

  const updateSubBudget = (year, head, sub, value) => {
    onChange(setSubCell(budget, year, head, sub, value));
  };

  const yTotal = (y) => yearTotal(budget, y, meta.budgetHeads);
  const gTotal = grandTotal(budget, meta.budgetHeads, budgetYears);

  // In-table editing for the derived heads. Manpower rows are fixed per
  // category, equipment rows and Other Expenses rows are self-added by
  // label, and Other Expenses rows may own sub-rows. All three persist to
  // the same __manpower/__equipment/__other line lists, and any of them may
  // instead carry a hand-typed head total in __headamt that overrides its
  // breakdown.
  const manpowerCats = (meta.manpowerCategories && meta.manpowerCategories.length)
    ? meta.manpowerCategories : ['Postdoc', 'JRF', 'SRF', 'UG Intern', 'PG Intern'];
  const extraManpowerCats = unionLabels(budget, KEY_MANPOWER, 'category')
    .filter(c => c && !manpowerCats.includes(c));
  const equipItems = equipRows(budget);
  const otherTopRows = otherRows(budget);

  const editManpower = (y, cat, field, value) =>
    onChange(setManpowerCell(budget, y, cat, field, value));
  const editEquipAmount = (y, key, value) =>
    onChange(setEquipAmount(budget, y, key, value));
  const renameEquip = (key, label) =>
    onChange(renameEquipRow(budget, key, label));
  const addEquip = () =>
    onChange(addEquipRow(budget, budgetYears));
  const dropEquip = (key) =>
    onChange(dropEquipRow(budget, key));
  const editTypedHead = (y, head, value) =>
    onChange(setTypedHead(budget, y, head, value));
  const editOther = (y, key, parentKey, value) =>
    onChange(setOtherAmount(budget, y, key, parentKey, value));
  const renameOther = (key, label) =>
    onChange(renameOtherRow(budget, key, label));
  const dropOther = (key) =>
    onChange(dropOtherRow(budget, key));
  const addOther = (parentKey) =>
    onChange(addOtherRow(budget, budgetYears, parentKey));

  // One table in budgetHeads order (Manpower, Travel, Equipment,
  // Contingency, Overhead, Other Expenses). Each derived head renders
  // its own rows; plain heads render the head + sub-item rows.
  // A head whose breakdown can be overridden by a typed total renders the same
  // three parts: an editable head row, its breakdown, and a sub-total row that
  // flags a disagreement the way Travel's sub-items already do.
  const headSum = (head, y) =>
    head === HEAD_MANPOWER ? manpowerTotal(budget, y) : equipmentTotal(budget, y);
  const headMismatch = (head, y) => {
    const typed = typedHead(budget, y, head);
    const sum = headSum(head, y);
    return typed !== null && sum > 0 && typed !== sum;
  };

  const renderTypedHeadCells = (head) => budgetYears.map(y => {
    const typed = typedHead(budget, y, head);
    const sum = headSum(head, y);
    const bad = headMismatch(head, y);
    return (
      <td key={y}>
        <input type="number" min="0" className={`cp-budget-input${bad ? ' cp-budget-mismatch' : ''}`}
          value={typed === null ? '' : typed}
          placeholder={sum ? String(sum) : '0'}
          title={bad ? `Breakdown sums to ₹${sum.toLocaleString('en-IN')}` : 'Leave blank to use the breakdown below'}
          onChange={e => editTypedHead(y, head, e.target.value)} />
      </td>
    );
  });

  const renderHeadSubSum = (head) => (
    <tr className="cp-budget-subsum-row">
      <td className="cp-budget-sub-name">↳ sub-items total</td>
      {budgetYears.map(y => {
        const sum = headSum(head, y);
        const bad = headMismatch(head, y);
        return (
          <td key={y} className={`cp-budget-subsum${bad ? ' bad' : (sum > 0 ? ' ok' : '')}`}>
            ₹{sum.toLocaleString('en-IN')}{bad ? ' ⚠' : (sum > 0 ? ' ✓' : '')}
          </td>
        );
      })}
      <td></td>
    </tr>
  );

  const renderManpowerRows = () => (
    <>
      <tr className="cp-budget-head-row">
        <td className="cp-budget-head-name">{HEAD_MANPOWER}</td>
        {renderTypedHeadCells(HEAD_MANPOWER)}
        <td className="cp-budget-total">₹{budgetYears.reduce((s, y) => s + headTotal(budget, y, HEAD_MANPOWER), 0).toLocaleString('en-IN')}</td>
      </tr>
      {[...manpowerCats, ...extraManpowerCats].map(cat => (
        <tr key={cat} className="cp-budget-sub-row">
          <td className="cp-budget-sub-name">↳ {cat}(s)</td>
          {budgetYears.map(y => (
            <td key={y}>
              <input type="number" min="0" className="cp-budget-input sub" title="Amount (₹)"
                value={manpowerCell(budget, y, cat).amount || ''} placeholder="0"
                onChange={e => editManpower(y, cat, 'amount', e.target.value)} />
            </td>
          ))}
          <td className="cp-budget-total">₹{budgetYears.reduce((s, y) =>
            s + (Number(manpowerCell(budget, y, cat).amount) || 0), 0).toLocaleString('en-IN')}</td>
        </tr>
      ))}
      {renderHeadSubSum(HEAD_MANPOWER)}
    </>
  );

  const renderEquipmentRows = () => (
    <>
      <tr className="cp-budget-head-row">
        <td className="cp-budget-head-name">{HEAD_EQUIPMENT}
          <button type="button" className="inline-add-btn inline-add-btn--sm" onClick={addEquip}>
            <i className="fa fa-plus" aria-hidden="true"></i> Add item
          </button>
        </td>
        {renderTypedHeadCells(HEAD_EQUIPMENT)}
        <td className="cp-budget-total">₹{budgetYears.reduce((s, y) => s + headTotal(budget, y, HEAD_EQUIPMENT), 0).toLocaleString('en-IN')}</td>
      </tr>
      {equipItems.map(row => (
        <tr key={row.key} className="cp-budget-sub-row">
          <td>
            <span className="cp-budget-countpair">
              <input type="text" className="cp-budget-input" value={row.label}
                placeholder="e.g. GPU Workstation"
                onChange={e => renameEquip(row.key, e.target.value)} />
              <button type="button" className="cp-remove-btn" title="Remove item" aria-label="Remove item"
                onClick={() => dropEquip(row.key)}>
                <i className="fa fa-trash" aria-hidden="true"></i>
              </button>
            </span>
          </td>
          {budgetYears.map(y => (
            <td key={y}>
              <input type="number" min="0" className="cp-budget-input sub"
                value={(equipLine(budget, y, row.key) || {}).amount || ''}
                placeholder="0" onChange={e => editEquipAmount(y, row.key, e.target.value)} />
            </td>
          ))}
          <td className="cp-budget-total">₹{budgetYears.reduce((s, y) =>
            s + Number(((equipLine(budget, y, row.key) || {}).amount) || 0), 0).toLocaleString('en-IN')}</td>
        </tr>
      ))}
      {equipItems.length > 0 && renderHeadSubSum(HEAD_EQUIPMENT)}
    </>
  );

  // Other Expenses is the only head you build yourself: add a row, name it, and
  // optionally break it down with sub-rows. A parent row carries the money; its
  // sub-rows are a breakdown, flagged when they disagree.
  const renderOtherRows = () => (
    <>
      <tr className="cp-budget-head-row">
        <td className="cp-budget-head-name">{HEAD_OTHER}
          <button type="button" className="inline-add-btn inline-add-btn--sm" onClick={() => addOther('')}>
            <i className="fa fa-plus" aria-hidden="true"></i> Add expense
          </button>
        </td>
        {budgetYears.map(y => (
          <td key={y} className="cp-budget-total">₹{headTotal(budget, y, HEAD_OTHER).toLocaleString('en-IN')}</td>
        ))}
        <td className="cp-budget-total">₹{budgetYears.reduce((s, y) => s + headTotal(budget, y, HEAD_OTHER), 0).toLocaleString('en-IN')}</td>
      </tr>
      {otherTopRows.map(row => {
        const subs = otherSubRows(budget, row.key);
        return (
          <React.Fragment key={row.key}>
            <tr className="cp-budget-sub-row">
              <td>
                <span className="cp-budget-countpair">
                  <input type="text" className="cp-budget-input" value={row.label}
                    placeholder="e.g. Fabrication"
                    onChange={e => renameOther(row.key, e.target.value)} />
                  <button type="button" className="inline-add-btn inline-add-btn--sm" title="Add sub-item" aria-label="Add sub-item"
                    onClick={() => addOther(row.key)}>
                    <i className="fa fa-plus" aria-hidden="true"></i>
                  </button>
                  <button type="button" className="cp-remove-btn" title="Remove expense" aria-label="Remove expense"
                    onClick={() => dropOther(row.key)}>
                    <i className="fa fa-trash" aria-hidden="true"></i>
                  </button>
                </span>
              </td>
              {budgetYears.map(y => {
                const bad = otherSubMismatch(budget, y, row.key);
                return (
                  <td key={y}>
                    <input type="number" min="0" className={`cp-budget-input sub${bad ? ' cp-budget-mismatch' : ''}`}
                      value={(otherLine(budget, y, row.key) || {}).amount || ''}
                      placeholder="0"
                      title={bad ? `Sub-items sum to ₹${otherSubTotal(budget, y, row.key).toLocaleString('en-IN')}` : undefined}
                      onChange={e => editOther(y, row.key, '', e.target.value)} />
                  </td>
                );
              })}
              <td className="cp-budget-total">₹{budgetYears.reduce((s, y) =>
                s + Number(((otherLine(budget, y, row.key) || {}).amount) || 0), 0).toLocaleString('en-IN')}</td>
            </tr>
            {subs.map(sub => (
              <tr key={sub.key} className="cp-budget-sub-row cp-budget-subsub-row">
                <td>
                  <span className="cp-budget-countpair">
                    <input type="text" className="cp-budget-input" value={sub.label}
                      placeholder="e.g. Casting"
                      onChange={e => renameOther(sub.key, e.target.value)} />
                    <button type="button" className="cp-remove-btn" title="Remove sub-item" aria-label="Remove sub-item"
                      onClick={() => dropOther(sub.key)}>
                      <i className="fa fa-trash" aria-hidden="true"></i>
                    </button>
                  </span>
                </td>
                {budgetYears.map(y => (
                  <td key={y}>
                    <input type="number" min="0" className="cp-budget-input sub"
                      value={(otherLine(budget, y, sub.key) || {}).amount || ''}
                      placeholder="0" onChange={e => editOther(y, sub.key, row.key, e.target.value)} />
                  </td>
                ))}
                <td className="cp-budget-total">₹{budgetYears.reduce((s, y) =>
                  s + Number(((otherLine(budget, y, sub.key) || {}).amount) || 0), 0).toLocaleString('en-IN')}</td>
              </tr>
            ))}
            {subs.length > 0 && (
              <tr className="cp-budget-subsum-row">
                <td className="cp-budget-sub-name cp-budget-indent-sum">↳ sub-items total</td>
                {budgetYears.map(y => {
                  const sum = otherSubTotal(budget, y, row.key);
                  const bad = otherSubMismatch(budget, y, row.key);
                  return (
                    <td key={y} className={`cp-budget-subsum${bad ? ' bad' : (sum > 0 ? ' ok' : '')}`}>
                      ₹{sum.toLocaleString('en-IN')}{bad ? ' ⚠' : (sum > 0 ? ' ✓' : '')}
                    </td>
                  );
                })}
                <td></td>
              </tr>
            )}
          </React.Fragment>
        );
      })}
    </>
  );

  return (
          <PanelSection title="Budget breakdown">
            <div className="cp-table-wrap">
              <table className="data-table cp-budget-table">
                <thead>
                  <tr>
                    <th>Budget head</th>
                    {budgetYears.map((y, i) => <th key={y}>Year {i + 1} (₹)</th>)}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {meta.budgetHeads.map(bh => {
                    if (bh.head === HEAD_MANPOWER) return <React.Fragment key={bh.head}>{renderManpowerRows()}</React.Fragment>;
                    if (bh.head === HEAD_EQUIPMENT) return <React.Fragment key={bh.head}>{renderEquipmentRows()}</React.Fragment>;
                    if (bh.head === HEAD_OTHER) return <React.Fragment key={bh.head}>{renderOtherRows()}</React.Fragment>;
                    return (
                    <React.Fragment key={bh.head}>
                      <tr className="cp-budget-head-row">
                        <td className="cp-budget-head-name">{bh.head}</td>
                        {budgetYears.map(y => {
                          const mism = bh.subItems.length > 0 && headSubMismatch(budget, y, bh.head, bh.subItems);
                          return (
                            <td key={y}>
                              <input type="number" min="0" className={`cp-budget-input${mism ? ' cp-budget-mismatch' : ''}`}
                                value={budget[y]?.[bh.head] || ''}
                                onChange={e => updateBudget(y, bh.head, e.target.value)} placeholder="0"
                                title={mism ? `Sub-items sum to ₹${subItemsTotal(budget, y, bh.head, bh.subItems).toLocaleString('en-IN')}` : undefined} />
                            </td>
                          );
                        })}
                        <td className="cp-budget-total">₹{budgetYears.reduce((s, y) => s + headTotal(budget, y, bh.head), 0).toLocaleString('en-IN')}</td>
                      </tr>
                      {bh.subItems.map(sub => (
                        <tr key={sub} className="cp-budget-sub-row">
                          <td className="cp-budget-sub-name">↳ {sub}</td>
                          {budgetYears.map(y => (
                            <td key={y}>
                              <input type="number" min="0" className="cp-budget-input sub"
                                value={subVal(budget, y, bh.head, sub) || ''}
                                onChange={e => updateSubBudget(y, bh.head, sub, e.target.value)} placeholder="0" />
                            </td>
                          ))}
                          <td className="cp-budget-total">₹{budgetYears.reduce((s, y) => s + subVal(budget, y, bh.head, sub), 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                      {bh.subItems.length > 0 && (
                        <tr className="cp-budget-subsum-row">
                          <td className="cp-budget-sub-name">↳ sub-items total</td>
                          {budgetYears.map(y => {
                            const total = subItemsTotal(budget, y, bh.head, bh.subItems);
                            const bad = headSubMismatch(budget, y, bh.head, bh.subItems);
                            return (
                              <td key={y} className={`cp-budget-subsum${bad ? ' bad' : (total > 0 ? ' ok' : '')}`}>
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
                  <tr className="cp-budget-grand-row">
                    <td><strong>Grand total</strong></td>
                    {budgetYears.map(y => <td key={y} className="cp-budget-total">₹{yTotal(y).toLocaleString('en-IN')}</td>)}
                    <td className="cp-budget-grand">₹{gTotal.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </PanelSection>
  );
};

export default ProjectBudgetStep;

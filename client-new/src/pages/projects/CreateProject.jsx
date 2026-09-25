import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatDuration } from '../../data/projectsData';
import { formatDate, toDateObject, toDateValue } from '../../utils/timeParse';
import { customFetch } from '../../api/base';
import { useView } from '../../api/views';
import LoadError from '../../components/common/LoadError';
import StatusNotice from '../../components/common/StatusNotice';
import Page from '../../components/page/Page';
import Panel, { PanelSection } from '../../components/panel/Panel';
import CustomButton from '../../components/forms/fields/CustomButton';
import InputSuggestions from '../../components/forms/fields/InputSuggestions';
import FacultyLink from '../../components/facultyLink/FacultyLink';
import { baseURL } from '../../api/urls';
import { toast } from 'react-toastify';
import { toastUndo, insertAt } from '../../utils/undoToast';
import ProjectBudgetStep from './ProjectBudgetStep';
import './CreateProject.css';

const required = <span className="req" aria-hidden="true">*</span>;
const initials = (name) => name.split(' ').map((n) => n[0]).join('').slice(0, 2);
const blankMilestone = () => ({ name: '', deliverable: '', dueDate: '', status: 'Not Started' });
const blankExternal = () => ({ name: '', designation: '', institute: '', email: '', mobile: '', website: '' });

// A field's label, with the required mark after it.
const FieldLabel = ({ field }) => (
  <label htmlFor={field.id}>{field.required ? `${field.label} ` : field.label}{field.required && required}</label>
);

/**
 * One field the view describes, drawn as the wizard's grid draws it. `values`
 * and `set` are the form (or an external Co-PI draft) it belongs to.
 */
const WizardField = ({ field, values, set, options, fileRef }) => {
  const value = values[field.key];
  const aria = field.required ? 'true' : undefined;
  const className = `cp-field${field.full ? ' full' : ''}${field.read_only ? ' input-field-container' : ''}`;

  if (field.only_if_filled && !value) return null;

  let control;
  switch (field.input) {
    case 'select':
      control = (
        <select id={field.id} aria-required={aria} value={value} onChange={(e) => set(field.key, e.target.value)}>
          {field.choose && <option value="">{field.choose}</option>}
          {field.options.map((option) => <option key={option.value} value={option.value}>{option.title}</option>)}
        </select>
      );
      break;
    case 'textarea':
      control = (
        <>
          <textarea id={field.id} rows={field.rows} value={value} onChange={(e) => set(field.key, e.target.value)} placeholder={field.placeholder} maxLength={field.max} />
          <span className="cp-char-count">{value.length}{` / ${field.max} characters`}</span>
        </>
      );
      break;
    case 'duration':
      control = (
        <>
          <div className="cp-duration-pair">
            <select id={field.id} aria-required={aria} value={value} onChange={(e) => set(field.key, e.target.value)} aria-label="Duration in years">
              {options.duration.years.map((y) => <option key={y} value={y}>{y} {y === 1 ? 'Year' : 'Years'}</option>)}
            </select>
            <select value={values[field.months]} onChange={(e) => set(field.months, e.target.value)} aria-label="Additional months">
              {Array.from({ length: options.duration.maxMonths + 1 }, (_, m) => (
                <option key={m} value={m}>{m === 0 ? 'No extra months' : `${m} ${m === 1 ? 'Month' : 'Months'}`}</option>
              ))}
            </select>
          </div>
          <span className="cp-duration-preview">{formatDuration(value, values[field.months])}</span>
        </>
      );
      break;
    case 'file':
      control = (
        <>
          <input
            id={field.id}
            type="file"
            accept={field.accept}
            ref={fileRef}
            onChange={(e) => {
              const file = e.target.files && e.target.files[0];
              if (file) set(field.key, file, { [field.name_key]: file.name });
            }}
          />
          {values[field.name_key] && <span className="cp-file-hint"><i className="fa fa-paperclip" aria-hidden="true"></i> {values[field.name_key]}</span>}
        </>
      );
      break;
    default:
      control = field.read_only ? (
        <input id={field.id} type={field.input} value={value} readOnly className="field-readonly" />
      ) : (
        <input
          id={field.id}
          type={field.input}
          step={field.step}
          min={field.min}
          aria-required={aria}
          value={value}
          onChange={(e) => set(field.key, e.target.value)}
          placeholder={field.placeholder}
        />
      );
  }

  return (
    <div className={className}>
      <FieldLabel field={field} />
      {control}
    </div>
  );
};

/**
 * The project proposal wizard (GET /views/project-wizard, server:
 * App\Pages\ProjectWizardPage): the steps and every field, option and word on
 * them are the server's, its review step is the server's reading of the
 * answers, and the whole proposal is saved in one request. What stays here is
 * the typing: the budget table's arithmetic, the Co-PI picker and the lists.
 */
const Wizard = ({ view, backLink }) => {
  const navigate = useNavigate();
  const { steps, options, pi, submit } = view;
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState(view.values);
  const [showExtForm, setShowExtForm] = useState(false);
  const [extCopi, setExtCopi] = useState(blankExternal);
  // The row just added, as 'copi-2' or 'milestone-0', so it is marked where it landed.
  const [lastAdded, setLastAdded] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [review, setReview] = useState(null);
  const fileRef = useRef(null);
  const ganttRef = useRef(null);

  // The end date follows the start date and the duration.
  const duration = steps.flatMap((step) => step.blocks).flatMap((block) => block.fields || []).find((field) => field.ends);
  const updateField = (key, value, extra = {}) => {
    setForm((prev) => {
      const updated = { ...prev, [key]: value, ...extra };
      if (duration && [duration.ends.from, duration.key, duration.months].includes(key) && updated[duration.ends.from]) {
        // Local midnight in and a local date out, so the end date is not a day off.
        const d = toDateObject(updated[duration.ends.from]);
        d.setFullYear(d.getFullYear() + (parseInt(updated[duration.key], 10) || 0));
        d.setMonth(d.getMonth() + (parseInt(updated[duration.months], 10) || 0));
        updated[duration.ends.key] = toDateValue(d);
      }
      return updated;
    });
  };

  const addInternalCopi = (fac) => {
    if (!fac || !fac.name) return;
    if (form.coPIs.find((c) => c.name === fac.name)) return;
    setLastAdded(`copi-${form.coPIs.length}`);
    setForm({
      ...form,
      coPIs: [...form.coPIs, {
        type: 'internal', faculty_code: fac.id, name: fac.name,
        department: fac.department, designation: fac.designation, email: fac.email,
      }],
    });
  };

  const addExternalCopi = () => {
    if (extCopi.name) {
      setLastAdded(`copi-${form.coPIs.length}`);
      setForm({ ...form, coPIs: [...form.coPIs, { type: 'external', ...extCopi }] });
      setExtCopi(blankExternal());
      setShowExtForm(false);
    }
  };

  // Nothing is saved until Submit, so a removal happens at once and Undo puts it back.
  const removeCopi = (idx) => {
    const removed = form.coPIs[idx];
    // Rows are keyed by index, so the mark would land on whichever row an Undo shifts there.
    setLastAdded(null);
    setForm({ ...form, coPIs: form.coPIs.filter((_, i) => i !== idx) });
    toastUndo(`${removed.name} removed.`, () => setForm((prev) => ({ ...prev, coPIs: insertAt(prev.coPIs, idx, removed) })));
  };

  const removeObjective = (idx) => {
    const removed = form.objectives[idx];
    setForm((p) => ({ ...p, objectives: p.objectives.filter((_, j) => j !== idx) }));
    toastUndo('Objective removed.', () => setForm((prev) => ({ ...prev, objectives: insertAt(prev.objectives, idx, removed) })));
  };

  const addMilestone = () => {
    setLastAdded(`milestone-${form.milestones.length}`);
    setForm({ ...form, milestones: [...form.milestones, blankMilestone()] });
  };
  const removeMilestone = (i) => {
    const removed = form.milestones[i];
    setLastAdded(null);
    setForm({ ...form, milestones: form.milestones.filter((_, idx) => idx !== i) });
    toastUndo('Milestone removed.', () => setForm((prev) => ({ ...prev, milestones: insertAt(prev.milestones, i, removed) })));
  };
  const updateMilestone = (i, field, val) => {
    const ms = [...form.milestones];
    ms[i] = { ...ms[i], [field]: val };
    setForm({ ...form, milestones: ms });
  };

  const milestoneProgress = () => {
    const done = form.milestones.filter((m) => m.status === 'Completed').length;
    return form.milestones.length ? Math.round((done / form.milestones.length) * 100) : 0;
  };

  // The values without the files, which travel beside them.
  const valuesJson = () => JSON.stringify({ ...form, sanctionLetterFile: null, ganttFile: null });

  // The review is the server's reading of what has been typed.
  const goTo = async (index) => {
    setCurrentStep(index);
    if (!steps[index].blocks.some((block) => block.kind === 'review')) return;
    setReview(null);
    const res = await customFetch(baseURL + submit.review, 'POST', { values: JSON.parse(valuesJson()), pi }, false);
    if (res.success) setReview(res.response.blocks);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const body = new FormData();
    body.append('values', valuesJson());
    if (form.sanctionLetterFile) body.append('sanction_letter', form.sanctionLetterFile);
    if (form.ganttFile) body.append('gantt_chart', form.ganttFile);
    const res = await customFetch(baseURL + submit.path, 'POST', body, false, true);
    setSubmitting(false);
    if (res.success) {
      toast.success(res.response.message);
      navigate('/projects');
      return;
    }
    // A missing answer opens the step it is on.
    const refusal = res.response || {};
    if (Number.isInteger(refusal.step)) setCurrentStep(refusal.step);
    toast.error(refusal.message || 'The project could not be saved. Check your connection and try again.');
  };

  const budgetYears = Array.from(
    { length: Math.min(5, Math.max(1, parseInt(form.durationYears, 10) || 1)) },
    (_, i) => `year${i + 1}`
  );

  const fieldsOf = (fields, values = form, set = updateField) => fields.map((field) => (
    <WizardField key={field.id} field={field} values={values} set={set} options={options} fileRef={field.input === 'file' ? fileRef : undefined} />
  ));

  const renderBlock = (block, index) => {
    switch (block.kind) {
      case 'fields':
        return <div key={index} className="cp-form-grid">{fieldsOf(block.fields)}</div>;
      case 'section':
        return (
          <PanelSection key={index} title={block.title} description={block.description}>
            {block.blocks.map(renderBlock)}
          </PanelSection>
        );
      case 'pi':
        return (
          <PanelSection key={index} title={block.title}>
            {pi ? (
              <div className="cp-person">
                <div className="cp-avatar" aria-hidden="true">{initials(pi.name)}</div>
                <div className="cp-person-info">
                  <p className="cp-person-name"><FacultyLink code={pi.code} name={pi.name} /></p>
                  <p className="cp-person-dept">{pi.department}</p>
                  <p className="cp-person-meta">{pi.designation}</p>
                </div>
                <span className="badge badge--accent cp-person-role">{block.badge}</span>
              </div>
            ) : (
              <p className="cp-muted">{block.none}</p>
            )}
            <div className="cp-form-grid cp-after">{fieldsOf(block.fields)}</div>
          </PanelSection>
        );
      case 'copis':
        return (
          <PanelSection
            key={index}
            title={block.title}
            actions={<CustomButton text={block.add_external} variant="secondary" size="sm" onClick={() => setShowExtForm(!showExtForm)} />}
          >
            <div className="cp-copi-search">
              <InputSuggestions
                apiUrl={`${baseURL}${block.search.path}`}
                label={block.search.label}
                hint={block.search.hint}
                fields={['name', 'department']}
                onSelect={addInternalCopi}
              />
            </div>
            {showExtForm && (
              <div className="cp-ext-form">
                <p className="cp-ext-header"><span className="badge badge--purple">{block.external.badge}</span></p>
                <div className="cp-form-grid">
                  {fieldsOf(block.external.fields, extCopi, (key, value) => setExtCopi((prev) => ({ ...prev, [key]: value })))}
                </div>
                <div className="cp-inline-actions">
                  <CustomButton text={block.external.add} variant="secondary" size="sm" onClick={addExternalCopi} />
                  <CustomButton text="Cancel" variant="quiet" size="sm" onClick={() => setShowExtForm(false)} />
                </div>
              </div>
            )}
            {form.coPIs.map((c, i) => (
              <div key={i} className={`cp-person cp-copi-row${lastAdded === `copi-${i}` ? ' just-added' : ''}`}>
                <div className="cp-avatar" aria-hidden="true">{initials(c.name)}</div>
                <div className="cp-person-info">
                  <p className="cp-person-name">{c.name}</p>
                  <p className="cp-person-meta">{c.type === 'internal' ? c.department : c.institute} &middot; {c.type === 'internal' ? 'Internal' : 'External'}</p>
                </div>
                <button type="button" className="cp-remove-btn" onClick={() => removeCopi(i)} title="Remove Co-PI" aria-label={`Remove ${c.name}`}><i className="fa fa-trash" aria-hidden="true"></i></button>
              </div>
            ))}
          </PanelSection>
        );
      case 'budget':
        return (
          <ProjectBudgetStep
            key={index}
            budget={form.budget}
            years={budgetYears}
            meta={options}
            onChange={(next) => setForm((prev) => ({ ...prev, budget: typeof next === 'function' ? next(prev.budget) : next }))}
          />
        );
      case 'objectives':
        return (
          <PanelSection
            key={index}
            title={block.title}
            actions={<CustomButton text={block.add} variant="secondary" size="sm" onClick={() => setForm((p) => ({ ...p, objectives: [...p.objectives, ''] }))} />}
          >
            <div className="cp-obj-list">
              {form.objectives.map((obj, i) => (
                <div key={i} className="cp-obj-row">
                  <span className="cp-obj-num" aria-hidden="true">{i + 1}</span>
                  <input
                    type="text" value={obj} maxLength={block.max}
                    aria-label={`Objective ${i + 1}`}
                    placeholder={block.placeholder}
                    onChange={(e) => setForm((p) => ({ ...p, objectives: p.objectives.map((o, j) => (j === i ? e.target.value : o)) }))}
                  />
                  <button
                    type="button" className="cp-remove-btn" title="Remove objective" aria-label={`Remove objective ${i + 1}`}
                    disabled={form.objectives.length === 1}
                    onClick={() => removeObjective(i)}
                  >
                    <i className="fa fa-trash" aria-hidden="true"></i>
                  </button>
                </div>
              ))}
            </div>
          </PanelSection>
        );
      case 'sdgs':
        return (
          <PanelSection
            key={index}
            title={block.title}
            actions={<span className="cp-sdg-count">{form.sdgs.length}{block.count.replace('{n}', '')}</span>}
          >
            <div className="cp-sdg-grid">
              {options.sdgs.map((g) => (
                <label key={g.id} className={`cp-sdg-item${form.sdgs.includes(g.id) ? ' selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={form.sdgs.includes(g.id)}
                    onChange={() => updateField('sdgs', form.sdgs.includes(g.id)
                      ? form.sdgs.filter((id) => id !== g.id)
                      : [...form.sdgs, g.id].sort((a, b) => a - b))}
                  />
                  <span className="cp-sdg-num">{g.id}</span>
                  <span className="cp-sdg-label">{g.label}</span>
                </label>
              ))}
            </div>
          </PanelSection>
        );
      case 'gantt':
        return (
          <PanelSection key={index} title={block.title} description={block.description}>
            <div className="cp-field">
              <input
                type="file" accept={block.accept} ref={ganttRef}
                aria-label="Gantt chart file"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) setForm((p) => ({ ...p, [block.key]: file, [block.name_key]: file.name }));
                }}
              />
              {form[block.name_key] && <span className="cp-file-hint"><i className="fa fa-paperclip" aria-hidden="true"></i> {form[block.name_key]}</span>}
            </div>
          </PanelSection>
        );
      case 'milestones':
        return (
          <PanelSection key={index} title={block.title}>
            <div className="cp-table-wrap">
              <table className="data-table cp-milestone-table">
                <thead>
                  <tr>{block.columns.map((column) => <th key={column}>{column}</th>)}</tr>
                </thead>
                <tbody>
                  {form.milestones.map((m, i) => (
                    <tr key={i} className={lastAdded === `milestone-${i}` ? 'just-added' : undefined}>
                      <td><input type="text" aria-label={`Milestone ${i + 1} name`} value={m.name} onChange={(e) => updateMilestone(i, 'name', e.target.value)} placeholder={block.placeholders.name} /></td>
                      <td><input type="text" aria-label={`Milestone ${i + 1} deliverable`} value={m.deliverable} onChange={(e) => updateMilestone(i, 'deliverable', e.target.value)} placeholder={block.placeholders.deliverable} /></td>
                      <td><input type="date" aria-label={`Milestone ${i + 1} due date`} value={m.dueDate} onChange={(e) => updateMilestone(i, 'dueDate', e.target.value)} /></td>
                      <td>
                        <select aria-label={`Milestone ${i + 1} status`} value={m.status} onChange={(e) => updateMilestone(i, 'status', e.target.value)} className="cp-ms-status">
                          {options.milestoneStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td>
                        {form.milestones.length > 1 && <button type="button" className="cp-remove-btn" onClick={() => removeMilestone(i)} title="Remove milestone" aria-label={`Remove milestone ${i + 1}`}><i className="fa fa-trash" aria-hidden="true"></i></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="cp-add-row-btn" onClick={addMilestone}><i className="fa fa-plus" aria-hidden="true"></i> {block.add}</button>
          </PanelSection>
        );
      case 'review':
        return (
          <div key={index} className="cp-review-grid">
            {(review || []).map((section) => (
              <section key={section.title} className={`cp-review-block${section.full ? ' full' : ''}`}>
                <h3 className="panel-section-title">{section.title}</h3>
                <dl className="kv">
                  {section.rows.map((row, i) => (
                    <div key={i}>
                      <dt className={row.label_class}>{row.label}</dt>
                      <dd className={row.value_class}>{row.value.map((part) => (typeof part === 'string' ? part : formatDate(part.date))).join('')}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  const step = steps[currentStep];
  const progress = step.progress && (
    <div className="cp-progress">
      <span className="cp-progress-label">{step.progress.label}</span>
      <div className="cp-progress-track" aria-hidden="true">
        <div className="cp-progress-fill" style={{ width: `${milestoneProgress()}%` }}></div>
      </div>
      <span className="cp-progress-pct">{milestoneProgress()}{step.progress.suffix}</span>
    </div>
  );
  const body = step.blocks.length === 1 ? renderBlock(step.blocks[0], 0) : <>{step.blocks.map(renderBlock)}</>;

  const stepNav = (
    <>
      {currentStep > 0 && (
        <CustomButton text="Previous step" variant="quiet" onClick={() => goTo(currentStep - 1)} />
      )}
      {currentStep < steps.length - 1 ? (
        <CustomButton text="Continue" className="cp-nav-next" onClick={() => goTo(currentStep + 1)} />
      ) : (
        <CustomButton text={submit.label} className="cp-nav-next" onClick={handleSubmit} busy={submitting} />
      )}
    </>
  );

  const stepper = (
    <nav className="cp-stepper-wrap" aria-label="Proposal steps">
      <div className="cp-stepper">
        {steps.map(({ label }, i) => (
          <React.Fragment key={label}>
            <button
              type="button"
              className={`cp-step-dot ${i < currentStep ? 'done' : ''} ${i === currentStep ? 'active' : ''}`}
              onClick={() => goTo(i)}
              aria-current={i === currentStep ? 'step' : undefined}
              aria-label={`Step ${i + 1}: ${label}`}
            >
              {/* Both are drawn so a finished step's number can turn into the check. */}
              <span className="cp-step-num">{String(i + 1).padStart(2, '0')}</span>
              <i className="fa fa-check cp-step-check" aria-hidden="true"></i>
            </button>
            {i < steps.length - 1 && <div className={`cp-step-line ${i < currentStep ? 'done' : ''}`}></div>}
          </React.Fragment>
        ))}
      </div>
      <div className="cp-step-labels" aria-hidden="true">
        {steps.map(({ label }, i) => (
          <span key={label} className={`cp-step-label ${i === currentStep ? 'active' : ''}`}>{label}</span>
        ))}
      </div>
    </nav>
  );

  const leave = () => {
    if (JSON.stringify(form) !== JSON.stringify(view.values) && !window.confirm(view.leave)) return;
    navigate('/projects');
  };

  return (
    <>
      {backLink(leave)}
      <Page
        className={view.page_class ?? undefined}
        title={view.title}
        meta={<span className="badge badge--accent">{view.badge}</span>}
        tabs={stepper}
      >
        <Panel title={step.title} description={step.description} actions={progress || undefined} footer={stepNav}>
          {body}
        </Panel>
      </Page>
    </>
  );
};

const CreateProject = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editId = location.state?.editProject?.id;
  const { view, failed, retry } = useView('project-wizard', editId ? { id: editId } : {}, { kept: false });

  const backLink = (onClick) => (
    <button type="button" className="page-back-link cp-back" onClick={onClick}>
      <i className="fa fa-arrow-left" aria-hidden="true"></i> {view?.back ?? 'Back to projects'}
    </button>
  );

  if (!view) {
    return (
      <>
        {backLink(() => navigate('/projects'))}
        {failed
          ? <LoadError message="Could not load this project for editing. Check your connection and try again." onRetry={retry} />
          : <StatusNotice tone="loading" title="Loading the project" />}
      </>
    );
  }
  return <Wizard key={editId ?? 'new'} view={view} backLink={backLink} />;
};

export default CreateProject;

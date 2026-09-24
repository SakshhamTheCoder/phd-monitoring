import React, { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import Page from '../page/Page';
import Panel, { PanelSection } from '../panel/Panel';
import InfoGrid from '../profileFields/InfoGrid';
import GridContainer from '../forms/fields/GridContainer';
import TableComponent from '../forms/table/TableComponent';
import FormGrid from '../forms/formGrid/FormGrid';
import CustomButton from '../forms/fields/CustomButton';
import LoadError from '../common/LoadError';
import StatusNotice from '../common/StatusNotice';
import ShowPublications from '../publications/ShowPublications';
import FacultyLink, { facultyNameCell } from '../facultyLink/FacultyLink';
import { HeaderLine, StatusText } from '../urf/UrfRecord';
import { signedInUser } from '../urf/UrfForms';
import { openStoredFile } from '../../api/fileAccess';
import { useView } from '../../api/views';
import { EMPTY_VALUE, formatDate } from '../../utils/timeParse';
import ServerDialog from './ServerDialog';
import ResearchPublicationsBlock from './blocks/ResearchPublicationsBlock';
import { sendRequest } from './requests';
import '../profileCard/ProfileCard.css';
import './ResearchProfile.css';

// Sections with behaviour of their own, which the server places by name.
const BLOCKS = { 'research-publications': ResearchPublicationsBlock };

const noLoader = () => {};

// Faculty named in a line, each linking to their research profile.
const FacultyLinks = ({ faculty }) => faculty.map((member, index) => (
  <React.Fragment key={member.code ?? index}>
    {index > 0 && ', '}
    <FacultyLink code={member.code} name={member.name} />
  </React.Fragment>
));

// Cells a record's tables draw themselves, by the name the view gives. A
// cell gets the row's request runner as `act`.
const CELLS = {
  faculty: facultyNameCell.component,
  status: ({ data }) => <StatusText status={data} />,
  'faculty-links': ({ data }) => (data?.length ? <FacultyLinks faculty={data} /> : EMPTY_VALUE),
  remove: ({ row, act }) => <CustomButton text="Remove" variant="danger-outline" size="sm" onClick={() => act(row)} />,
  'student-link': ({ row }) => <Link to={`/students/${row.roll_no}`}>{row.name}</Link>,
};

const pointer = () => ({ cursor: 'pointer' });

const cellsFor = (named, act) => Object.entries(named).map(([key, name]) => ({
  key,
  component: (props) => CELLS[name]({ ...props, act }),
}));

// A header line's value: text, a status, or faculty links; absent draws as empty.
const lineValue = (line) => {
  if (line.status) return <StatusText status={line.status} />;
  if (line.links) return <FacultyLinks faculty={line.links} />;
  return line.text;
};

// A value in its own span, marked when empty, as the PhD profile's lines are.
const BoxedValue = ({ text }) => (
  <span className={text ? '' : 'student-value-empty'}>{text || EMPTY_VALUE}</span>
);

// A detail's value when it is more than text.
const detailNode = (row, navigate) => {
  if (row.boxed !== undefined) return <span>{row.boxed}</span>;
  if (row.link) return <a href={row.link.href} target="_blank" rel="noopener noreferrer">{row.link.text}</a>;
  if (row.deadline) {
    return (
      <span className={row.deadline.due ? 'profile-deadline-due' : undefined}>
        {formatDate(row.deadline.date)}
        {' '}
        <span className="profile-deadline-note">{row.deadline.note}</span>
      </span>
    );
  }
  if (row.attendance) {
    const { value, month_title: monthTitle, month_lines: monthLines, link } = row.attendance;
    return (
      <span className="profile-attendance-row">
        <span className="profile-attendance" tabIndex={0}>
          <span className="profile-attendance-value">{value ?? EMPTY_VALUE}</span>
          <span className="profile-attendance-pop" role="tooltip">
            <strong>{monthTitle}</strong>
            {monthLines.map((line) => <span key={line}>{line}</span>)}
          </span>
        </span>
        {link && (
          <button type="button" className="profile-edit-small" onClick={() => navigate(link.navigate)}>
            <i className="fa fa-calendar" aria-hidden="true"></i> {link.label}
          </button>
        )}
      </span>
    );
  }
  return undefined;
};

// A field edited in place, labelled above, as the profile's longer fields are.
const InlineField = ({ item, edit }) => {
  const value = edit.values[item.field] ?? '';
  const change = (e) => edit.change(item.field, e.target.value);
  if (item.kind === 'text') {
    return (
      <div className="inline-field-item">
        <label>{item.label}</label>
        <p className={item.text ? '' : 'student-value-empty'}>{item.text || item.empty}</p>
      </div>
    );
  }
  return (
    <div className="inline-field-item">
      <label htmlFor={item.id}>{item.label}</label>
      {item.kind === 'input' ? (
        <input id={item.id} type="text" placeholder={item.placeholder} value={value} disabled={item.disabled} onChange={change} />
      ) : (
        <textarea id={item.id} placeholder={item.placeholder} value={value} disabled={item.disabled} maxLength={item.max} onChange={change} />
      )}
      {item.note && <small className="profile-lock-note">{item.note}</small>}
      {item.kind === 'textarea' && <div className="inline-char-count">{`${String(value).length} / ${item.max}`}</div>}
    </div>
  );
};

// Details as InfoGrid takes them, dates and richer values drawn here.
const detailRows = (rows, navigate) => rows.map((row) => ({
  ...row,
  ...('date' in row ? { value: formatDate(row.date) } : {}),
  node: detailNode(row, navigate),
}));

// A person's own record: lines under their name, with a progress ring beside
// them for a scholar, then their details, which turn into inputs in place
// while editing.
const ProfileSection = ({ section, edit, navigate }) => {
  const editing = !!edit.values;
  const lines = section.boxed ? (
    <div className="student-research">
      {section.lines.map((line) => (
        <p key={line.label} className={line.title ? 'student-research-title' : undefined}>
          <span className="student-research-label">{`${line.label}:`}</span>{' '}
          <BoxedValue text={line.text} />
        </p>
      ))}
      {section.locked_note && <p className="student-sub-meta-locked">{section.locked_note}</p>}
    </div>
  ) : (
    <div className="student-research">
      {section.lines.map((line) => (
        <HeaderLine key={line.label} label={line.label} title={line.title}>{lineValue(line)}</HeaderLine>
      ))}
    </div>
  );
  const rows = detailRows(section.rows, navigate);

  return (
    <Panel>
      <PanelSection>
        {section.progress === undefined ? lines : (
          <div className="student-overview">
            <div className="student-overview-text">
              {editing && section.edit_lines ? (
                <div className="student-sub-edit">
                  {section.edit_lines.map((item) => <InlineField key={item.label} item={item} edit={edit} />)}
                </div>
              ) : lines}
            </div>
            <div className="student-progress">
              <CircularProgressbar
                value={section.progress}
                text={`${section.progress}%`}
                styles={buildStyles({
                  textColor: 'var(--text-color)',
                  pathColor: 'var(--primary-color)',
                  trailColor: 'var(--border-subtle)',
                })}
              />
              <span className="progress-label">Progress</span>
            </div>
          </div>
        )}
      </PanelSection>
      <PanelSection>
        <InfoGrid editing={editing} values={edit.values || {}} onChange={edit.change} rows={rows} />
      </PanelSection>
    </Panel>
  );
};

// A fact's value as the record shows it: text, text in a span, a date, or a
// button opening a stored file.
const factValue = (fact) => {
  if (fact.span) return <span>{fact.text}</span>;
  if ('date' in fact) return formatDate(fact.date);
  if ('file' in fact) {
    return fact.file && (
      <CustomButton text={fact.button} variant="secondary" size="sm" onClick={() => openStoredFile(fact.file)} />
    );
  }
  return fact.text;
};

const Section = ({ section, edit, navigate, act, reload }) => {
  switch (section.kind) {
    case 'profile':
      return <ProfileSection section={section} edit={edit} navigate={navigate} />;
    // Details in titled parts of one panel, so one Edit shows all one Save writes.
    case 'details':
      return (
        <Panel>
          {section.parts.map((part, index) => (
            <PanelSection key={index} title={part.title}>
              <InfoGrid rows={detailRows(part.rows, navigate)} editing={!!edit.values} values={edit.values || {}} onChange={edit.change} />
            </PanelSection>
          ))}
        </Panel>
      );
    case 'block': {
      const Block = BLOCKS[section.block];
      return <Block props={section.props} onChanged={reload} />;
    }
    // Someone's own account of themselves, sharing the header's edit mode.
    case 'about':
      return (
        <Panel title={section.title}>
          <GridContainer
            elements={section.items.map((item) => (edit.values ? <InlineField item={item} edit={edit} /> : (
              <div>
                <p className="student-research-label">{item.label}</p>
                <p className={item.text ? 'student-about-text' : 'student-value-empty'}>{item.text || item.empty || EMPTY_VALUE}</p>
              </div>
            )))}
            space={2}
          />
        </Panel>
      );
    case 'table':
      return (
        <Panel flush title={section.title}>
          {section.empty_note && section.rows.length === 0 ? (
            <p className="profile-panel-note">{section.empty_note}</p>
          ) : (
            <TableComponent
              data={section.rows}
              keys={section.columns.map((column) => column.key)}
              titles={section.columns.map((column) => column.title)}
              rowStyle={section.pointer_rows ? pointer : undefined}
              components={cellsFor(
                Object.fromEntries(section.columns.filter((column) => column.cell).map((column) => [column.key, column.cell])),
                (row) => act(section.remove, row),
              )}
            />
          )}
          {section.empty_notice && section.rows.length === 0 && (
            <div className="rp-panel-note">
              <StatusNotice tone="empty">{section.empty_notice}</StatusNotice>
            </div>
          )}
        </Panel>
      );
    case 'publications':
      return (
        <Panel>
          <ShowPublications formData={section.data} enableEdit={false} enableDelete={false} canAdd={false} collapsible />
        </Panel>
      );
    case 'facts':
      return (
        <Panel title={section.title}>
          <dl className="facts">
            {section.facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{factValue(fact) || EMPTY_VALUE}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      );
    case 'forms':
      return <FormGrid forms={section.forms} title={section.title} />;
    case 'panel':
      return (
        <Panel title={section.title}>
          {section.parts.map((part) => (
            <GridContainer
              key={part.label}
              label={part.label}
              elements={[
                <TableComponent
                  data={part.rows}
                  keys={part.columns.map((column) => column.key)}
                  titles={part.columns.map((column) => column.title)}
                  components={part.cells ? cellsFor(part.cells) : undefined}
                />,
              ]}
              space={part.space}
            />
          ))}
        </Panel>
      );
    default:
      return null;
  }
};

const Record = ({ page, params, failedMessage, loadingTitle }) => {
  const navigate = useNavigate();
  const { view, failed, retry, reload } = useView(page, params, { kept: false });
  const [dialog, setDialog] = useState(null);
  const lastDialog = useRef(null);
  // The record's editable values while it is being edited, else null.
  const [editValues, setEditValues] = useState(null);
  const [saving, setSaving] = useState(false);

  if (failed) return <LoadError message={failedMessage} onRetry={retry} />;
  if (!view) {
    return loadingTitle ? (
      <Page>
        <Panel><StatusNotice tone="loading" title={loadingTitle} /></Panel>
      </Page>
    ) : null;
  }

  if (dialog) lastDialog.current = dialog;
  const shown = dialog || lastDialog.current;
  const { edit: editSpec } = view;

  const save = async () => {
    setSaving(true);
    const body = { ...editValues };
    (editSpec.sent_without || []).forEach((key) => delete body[key]);
    const saved = await sendRequest(editSpec.request, {}, body, noLoader);
    setSaving(false);
    if (!saved) return;
    // The header reads the account stored at sign-in, so what it shows is kept in step.
    if (editSpec.updates_user) {
      const user = signedInUser();
      editSpec.updates_user.forEach((key) => { user[key] = editValues[key]; });
      localStorage.setItem('user', JSON.stringify(user));
    }
    setEditValues(null);
    reload();
  };

  const cancel = () => {
    const changed = Object.keys(editValues).some((key) => editValues[key] !== editSpec.values[key]);
    if (changed && editSpec.confirm_discard && !window.confirm(editSpec.confirm_discard)) return;
    setEditValues(null);
  };

  // A row's request, such as taking a course off, then the record read again.
  const act = async (request, row) => {
    if (await sendRequest(request, row, {}, noLoader)) reload();
  };

  // Save shows it is sending (busy), is only held off (disabled), or neither.
  const saveButton = {
    busy: <CustomButton text="Save" onClick={save} busy={saving} />,
    disabled: <CustomButton text="Save" onClick={save} disabled={saving} />,
    none: <CustomButton text="Save" onClick={save} />,
  }[editSpec?.save_state || 'busy'];
  const editControls = editValues ? (
    <React.Fragment key="edit">
      {saveButton}
      <CustomButton text="Cancel" variant="quiet" onClick={cancel} />
    </React.Fragment>
  ) : (
    <CustomButton key="edit" text="Edit" variant="secondary" onClick={() => setEditValues({ ...editSpec.values })} />
  );
  const runAction = (action) => {
    if (action.navigate) navigate(action.navigate);
    else if (action.scroll_to) document.getElementById(action.scroll_to)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else setDialog({ name: action.opens, opened: Date.now() });
  };
  // The header's actions in the view's order, the edit controls where it puts them.
  const actions = view.actions.length > 0 ? (
    <>
      {view.actions.map((action) => (action.edit ? editControls : (
        <CustomButton
          key={action.label}
          text={action.label}
          variant={editValues && action.editing_variant ? action.editing_variant : action.variant}
          onClick={() => runAction(action)}
        />
      )))}
    </>
  ) : null;
  const edit = { values: editValues, change: (field, value) => setEditValues((prev) => ({ ...prev, [field]: value })) };
  const shownDialog = shown ? view.dialogs[shown.name] : null;

  return (
    <>
      <Page className={view.page_class} title={view.title} description={view.description} actions={actions}>
        {view.sections.map((section, index) => (
          <Section key={index} section={section} edit={edit} navigate={navigate} act={act} reload={reload} />
        ))}
      </Page>

      {Object.keys(view.dialogs).length > 0 && (
        <ServerDialog
          dialog={shownDialog}
          isOpen={!!dialog}
          row={shownDialog?.row ?? null}
          opened={shown?.opened ?? 0}
          onClose={() => setDialog(null)}
          onSaved={reload}
        />
      )}
    </>
  );
};

/**
 * One record as the server describes it (GET /views/{page}, server:
 * App\Pages), read afresh each time it opens: its header and the actions on
 * it, an in-place edit where the reader may edit it, and its sections, every
 * value already worked out. Takes the route's parameters, or `params` where
 * the page is shown outside its route (a home page). Another record starts
 * clean: nothing being edited or open carries over.
 */
const ServerRecordPage = ({ page, params: given, failedMessage, loadingTitle }) => {
  const routeParams = useParams();
  const params = given || routeParams;
  return <Record key={JSON.stringify(params)} page={page} params={params} failedMessage={failedMessage} loadingTitle={loadingTitle} />;
};

export default ServerRecordPage;

import React, { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Page from '../page/Page';
import Panel, { PanelSection } from '../panel/Panel';
import InfoGrid from '../profileFields/InfoGrid';
import GridContainer from '../forms/fields/GridContainer';
import TableComponent from '../forms/table/TableComponent';
import FormGrid from '../forms/formGrid/FormGrid';
import CustomButton from '../forms/fields/CustomButton';
import LoadError from '../common/LoadError';
import FacultyLink, { facultyNameCell } from '../facultyLink/FacultyLink';
import { HeaderLine, StatusText } from '../urf/UrfRecord';
import { signedInUser } from '../urf/UrfForms';
import { openStoredFile } from '../../api/fileAccess';
import { useView } from '../../api/views';
import { EMPTY_VALUE, formatDate } from '../../utils/timeParse';
import ServerDialog from './ServerDialog';
import { sendRequest } from './requests';
import '../profileCard/ProfileCard.css';

// Faculty named in a line, each linking to their research profile.
const FacultyLinks = ({ faculty }) => faculty.map((member, index) => (
  <React.Fragment key={member.code ?? index}>
    {index > 0 && ', '}
    <FacultyLink code={member.code} name={member.name} />
  </React.Fragment>
));

// Cells a record's tables draw themselves, by the name the view gives.
const CELLS = {
  faculty: facultyNameCell.component,
  status: ({ data }) => <StatusText status={data} />,
  'faculty-links': ({ data }) => (data?.length ? <FacultyLinks faculty={data} /> : EMPTY_VALUE),
};

const cellsFor = (named) => Object.entries(named).map(([key, name]) => ({ key, component: CELLS[name] }));

// A header line's value: text, a status, or faculty links; absent draws as empty.
const lineValue = (line) => {
  if (line.status) return <StatusText status={line.status} />;
  if (line.links) return <FacultyLinks faculty={line.links} />;
  return line.text;
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

const Section = ({ section, edit }) => {
  switch (section.kind) {
    // A person's own record: lines under their name, then their details, which
    // turn into inputs in place while editing.
    case 'profile':
      return (
        <Panel>
          <PanelSection>
            <div className="student-research">
              {section.lines.map((line) => (
                <HeaderLine key={line.label} label={line.label} title={line.title}>{lineValue(line)}</HeaderLine>
              ))}
            </div>
          </PanelSection>
          <PanelSection>
            <InfoGrid editing={!!edit.values} values={edit.values || {}} onChange={edit.change} rows={section.rows} />
          </PanelSection>
        </Panel>
      );
    case 'table':
      return (
        <Panel flush title={section.title}>
          <TableComponent
            data={section.rows}
            keys={section.columns.map((column) => column.key)}
            titles={section.columns.map((column) => column.title)}
            components={cellsFor(Object.fromEntries(section.columns.filter((column) => column.cell).map((column) => [column.key, column.cell])))}
          />
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

/**
 * One record as the server describes it (GET /views/{page}?id=, server:
 * App\Pages): its header and the decisions offered on it, and its sections of
 * facts, form cards and tables, every value already worked out. Takes the
 * route's parameters.
 */
const ServerRecordPage = ({ page, failedMessage }) => {
  const params = useParams();
  const { view, failed, retry, reload } = useView(page, params);
  const [dialog, setDialog] = useState(null);
  const lastDialog = useRef(null);
  // The record's editable values while it is being edited, else null.
  const [editValues, setEditValues] = useState(null);
  const [saving, setSaving] = useState(false);

  if (failed) return <LoadError message={failedMessage} onRetry={retry} />;
  if (!view) return null;

  if (dialog) lastDialog.current = dialog;
  const shown = dialog || lastDialog.current;

  const save = async () => {
    setSaving(true);
    const saved = await sendRequest(view.edit.request, {}, editValues, () => {});
    setSaving(false);
    if (!saved) return;
    // The header reads the account stored at sign-in, so what it shows is kept in step.
    const user = signedInUser();
    (view.edit.updates_user || []).forEach((key) => { user[key] = editValues[key]; });
    localStorage.setItem('user', JSON.stringify(user));
    setEditValues(null);
    reload();
  };

  const editActions = view.edit && (editValues ? (
    <>
      <CustomButton text="Save" onClick={save} busy={saving} />
      <CustomButton text="Cancel" variant="quiet" onClick={() => setEditValues(null)} />
    </>
  ) : (
    <CustomButton text="Edit" variant="secondary" onClick={() => setEditValues({ ...view.edit.values })} />
  ));
  const edit = { values: editValues, change: (field, value) => setEditValues((prev) => ({ ...prev, [field]: value })) };

  return (
    <>
      <Page
        title={view.title}
        actions={editActions || (view.actions.length > 0
          ? view.actions.map((action) => (
            <CustomButton
              key={action.label}
              text={action.label}
              variant={action.variant}
              onClick={() => setDialog({ name: action.opens, opened: Date.now() })}
            />
          ))
          : null)}
      >
        {view.sections.map((section, index) => <Section key={index} section={section} edit={edit} />)}
      </Page>

      {Object.keys(view.dialogs).length > 0 && (
        <ServerDialog
          dialog={shown ? view.dialogs[shown.name] : null}
          isOpen={!!dialog}
          row={null}
          opened={shown?.opened ?? 0}
          onClose={() => setDialog(null)}
          onSaved={reload}
        />
      )}
    </>
  );
};

export default ServerRecordPage;

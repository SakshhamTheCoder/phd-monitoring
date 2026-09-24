import React, { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Page from '../page/Page';
import Panel from '../panel/Panel';
import GridContainer from '../forms/fields/GridContainer';
import TableComponent from '../forms/table/TableComponent';
import FormGrid from '../forms/formGrid/FormGrid';
import CustomButton from '../forms/fields/CustomButton';
import LoadError from '../common/LoadError';
import { facultyNameCell } from '../facultyLink/FacultyLink';
import { openStoredFile } from '../../api/fileAccess';
import { useView } from '../../api/views';
import { EMPTY_VALUE, formatDate } from '../../utils/timeParse';
import ServerDialog from './ServerDialog';
import '../profileCard/ProfileCard.css';

// Cells a record's tables draw themselves, by the name the view gives.
const CELLS = { faculty: facultyNameCell };

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

const Section = ({ section }) => {
  switch (section.kind) {
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
                  components={part.cells ? Object.values(part.cells).map((name) => CELLS[name]) : undefined}
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

  if (failed) return <LoadError message={failedMessage} onRetry={retry} />;
  if (!view) return null;

  if (dialog) lastDialog.current = dialog;
  const shown = dialog || lastDialog.current;

  return (
    <>
      <Page
        title={view.title}
        actions={view.actions.length > 0
          ? view.actions.map((action) => (
            <CustomButton
              key={action.label}
              text={action.label}
              variant={action.variant}
              onClick={() => setDialog({ name: action.opens, opened: Date.now() })}
            />
          ))
          : null}
      >
        {view.sections.map((section, index) => <Section key={index} section={section} />)}
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

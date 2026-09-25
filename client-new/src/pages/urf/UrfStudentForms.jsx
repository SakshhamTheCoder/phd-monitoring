import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Page from '../../components/page/Page';
import Panel from '../../components/panel/Panel';
import StatusNotice from '../../components/common/StatusNotice';
import FormGrid from '../../components/forms/formGrid/FormGrid';
import CustomButton from '../../components/forms/fields/CustomButton';
import UrfFormShell from '../../components/urf/UrfFormShell';
import LoadError from '../../components/common/LoadError';
import ServerPanel from '../../components/forms/serverForm/ServerPanel';
import { sendRequest } from '../../components/serverPage/requests';
import { useLoading } from '../../context/LoadingContext';
import { useView } from '../../api/views';
import { formatDate } from '../../utils/timeParse';
import '../../components/urf/UrfForms.css';

// Stands in for the page until the first answer.
const Pending = ({ failed, onRetry }) => (failed
  ? <LoadError message="Could not load your URF projects. Check your connection and try again." onRetry={onRetry} />
  : <StatusNotice tone="loading" title="Loading your URF projects" />);

// Runs of text the server phrased, a list being one run, a date on the reader's calendar.
const piece = (part) => (typeof part === 'string' ? part : formatDate(part.date));
const phrased = (parts) => parts.map((part, index) => (
  <React.Fragment key={index}>{Array.isArray(part) ? part.map(piece).join('') : piece(part)}</React.Fragment>
));

/**
 * Forms, for a UG student (GET /views/urf-forms, server:
 * App\Pages\UrfStudentFormsPage): one block per URF project, newest first,
 * each with the cards of that project's own forms, and whether a new
 * application may be made. Read afresh each time, since it follows the
 * projects.
 */
export const UrfFormsPage = () => {
  const navigate = useNavigate();
  const { view, failed, retry } = useView('urf-forms', {}, { kept: false });

  return (
    <Page
      title={view?.title ?? 'Available forms'}
      description={view?.description ?? 'Undergraduate Research Fellowship'}
      actions={view?.actions.length > 0 && view.actions.map((action) => (
        <CustomButton key={action.label} text={action.label} onClick={() => navigate(action.navigate)} />
      ))}
    >
      {!view && <Pending failed={failed} onRetry={retry} />}
      {view?.empty && (
        <Panel className="reveal">
          <StatusNotice tone="empty">{view.empty}</StatusNotice>
        </Panel>
      )}
      {view?.applications.map((application) => (
        <Panel
          key={application.id}
          className="reveal"
          title={application.title}
          actions={<span>{application.status}</span>}
        >
          {application.rounds.length > 0 && (
            <div className="urf-round-notice">
              {application.rounds.map((round, index) => <p key={index}>{phrased(round)}</p>)}
            </div>
          )}
          <FormGrid forms={application.forms} title={null} />
        </Panel>
      ))}
    </Page>
  );
};

/**
 * One form of one URF project, or a new application (GET /views/urf-form):
 * the server says which form is the student's to fill, which is read as
 * filed, and why there is none where there is none.
 */
export const UrfFormPage = ({ type }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { view, failed, retry, reload } = useView('urf-form', id ? { type, id } : { type }, { kept: false });
  const { setLoading } = useLoading();
  const [sending, setSending] = useState(false);
  // Every answer remounts the form, so it opens with what was just saved.
  const [version, setVersion] = useState(0);
  useEffect(() => { setVersion((v) => v + 1); }, [view]);

  const body = view?.body;
  let content = null;
  if (!view) {
    content = <Pending failed={failed} onRetry={retry} />;
  } else if (body.rows) {
    // The application, the fellowship details or a report, as the server
    // describes them (App\Pages\UrfStudentFormRows), the same rows the app draws.
    const submit = async (values, files) => {
      setSending(true);
      const sent = await sendRequest(body.request, {}, values, setLoading, files);
      setSending(false);
      if (!sent) return;
      if (body.after === 'forms') navigate('/forms');
      else reload();
    };
    content = (
      <Panel>
        <ServerPanel rows={body.rows} wrapped={false} host={{ submit, busy: sending }} />
      </Panel>
    );
  } else if (body.kind === 'shell') {
    content = <UrfFormShell path={body.path} />;
  } else {
    content = (
      <Panel>
        <StatusNotice tone="info">{phrased(body.text)}</StatusNotice>
      </Panel>
    );
  }

  return (
    <Page title={view?.title ?? ''} description={view?.description}>
      <React.Fragment key={version}>{content}</React.Fragment>
    </Page>
  );
};

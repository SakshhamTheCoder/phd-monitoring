import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/pageHeader/PageHeader';
import FormGrid from '../../components/forms/formGrid/FormGrid';
import CustomButton from '../../components/forms/fields/CustomButton';
import { StatusText, REPORT_TYPES } from '../../components/urf/UrfRecord';
import UrfFormShell from '../../components/urf/UrfFormShell';
import LoadError from '../../components/common/LoadError';
import { ApplyForm, FellowForm, ReportForm, signedInUser } from '../../components/urf/UrfForms';
import { apiUrfMine } from '../../api/urf';
import { formatDate } from '../../utils/timeParse';
import '../../components/urf/UrfForms.css';

// The student's URF projects (newest first), the application window and the
// session a new application joins. `version` changes on every load, so a form
// keyed on it remounts with what was just saved.
const useUrf = () => {
  const [state, setState] = useState(null);
  const [version, setVersion] = useState(0);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setFailed(false);
    const res = await apiUrfMine();
    if (res.success) {
      setState(res.response);
      setVersion((v) => v + 1);
    } else {
      setFailed(true);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { state, version, load, failed };
};

// Stands in for the page until the first load answers.
const Pending = ({ failed, onRetry }) => (failed
  ? <LoadError message="Could not load your URF projects. Check your connection and try again." onRetry={onRetry} />
  : <p>Loading…</p>);

// Fellowship details and reports are kept per student, and a project's rows
// include the teammate's. A project has two members at most: user_id is the
// first student and student2_email the second.
const own = (application, rows) => {
  const second = application.student2_email?.toLowerCase() === signedInUser().email?.toLowerCase();
  return (rows || []).filter((row) => (String(row.user_id) === String(application.user_id)) !== second);
};

const REPORT_FORMS = { half_yearly: 'urf-half-yearly-report', final: 'urf-final-report' };

// A form is the student's to fill while it waits on them. Submitting moves it
// to the mentor, and from then on it is read rather than filled in, as a PhD
// form is, until a step sends it back and it is theirs again.
const locked = (form) => Boolean(form) && form.stage !== 'student';

// One application per session: open unless this year's is waiting or selected.
const canApply = ({ applications_open: open, session, applications }) =>
  open && !applications.some((a) => a.session === session && a.status !== 'rejected');

const windowFor = (windows, application, type) => (windows || [])
  .find((w) => w.type === type && Number(w.session) === Number(application.session));

/** The rest wait on selection, and a report on its round being open as well. */
const formsFor = (application, windows) => {
  const base = `/forms/urf/${application.id}`;
  const report = (type, path) => {
    const round = windowFor(windows, application, type);
    const filed = own(application, application.reports).some((r) => r.type === type);
    if (!round?.is_open && !filed) return [];

    return [{
      form_type: REPORT_FORMS[type],
      form_name: REPORT_TYPES[type],
      path: `${base}/${path}`,
      action_required: round?.is_open && !filed,
    }];
  };

  return [
    { form_type: 'urf-application', form_name: 'URF Application Form', path: `${base}/application` },
    ...(application.status === 'selected' ? [
      { form_type: 'urf-additional-info', form_name: 'Additional Information Form', path: `${base}/additional-info`, action_required: !own(application, application.fellows).length },
      ...report('half_yearly', 'half-yearly-report'),
      ...report('final', 'final-report'),
    ] : []),
  ];
};

const RoundNotice = ({ application, windows }) => {
  if (application.status !== 'selected') return null;

  const upcoming = ['half_yearly', 'final']
    .map((type) => ({ type, round: windowFor(windows, application, type) }))
    .filter(({ type, round }) => round && !round.is_open && !own(application, application.reports).some((r) => r.type === type));

  if (!upcoming.length) return null;

  return (
    <div className="urf-round-notice">
      {upcoming.map(({ type, round }) => (
        <p key={type}>
          {REPORT_TYPES[type]}: {new Date(round.opens_on) > new Date()
            ? `opens ${formatDate(round.opens_on)}`
            : `closed ${formatDate(round.closes_on)}`}
          {round.notes ? ` · ${round.notes}` : ''}
        </p>
      ))}
    </div>
  );
};

/**
 * Forms, for a UG student: one block per URF project, newest first, each with
 * the cards of that project's own forms on the PhD forms grid. A student can
 * apply once per session (calendar year), so last year's selected project does
 * not stop this year's application.
 */
export const UrfFormsPage = () => {
  const navigate = useNavigate();
  const { state, load, failed } = useUrf();

  return (
    <>
      <PageHeader
        title="Available Forms"
        subtitle="Undergraduate Research Fellowship"
        actions={state && canApply(state) && (
          <CustomButton text={`Apply for URF ${state.session}`} onClick={() => navigate('/forms/urf-application')} />
        )}
      />
      {!state && <Pending failed={failed} onRetry={load} />}
      {state && state.applications.length === 0 && (
        <p>{state.applications_open ? `You have not applied for URF ${state.session} yet.` : 'URF applications are closed right now.'}</p>
      )}
      {state?.applications.map((application) => (
        <div key={application.id}>
          <div className="urf-subhead">
            <h3>URF {application.session} · {application.project_title}</h3>
            <StatusText status={application.status} />
          </div>
          <RoundNotice application={application} windows={state.report_windows} />
          <FormGrid forms={formsFor(application, state.report_windows)} title={null} />
        </div>
      ))}
    </>
  );
};

const TITLES = {
  application: 'URF Application Form',
  additional: 'Additional Information Form',
  ...REPORT_TYPES,
};

/** One form of one URF project, or a new application. What it offers follows the project's status. */
export const UrfFormPage = ({ type }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { state, version, load, failed } = useUrf();
  const application = state?.applications.find((a) => String(a.id) === String(id));

  let body = null;
  if (!state) {
    body = <Pending failed={failed} onRetry={load} />;
  } else if (type === 'new') {
    body = canApply(state)
      ? <ApplyForm student={state.student} onSaved={() => navigate('/forms')} />
      : <p>{state.applications_open ? `You have already applied for URF ${state.session}.` : 'URF applications are closed right now.'}</p>;
  } else if (!application) {
    body = <p>This URF project was not found.</p>;
  } else if (application && type === 'application') {
    const me = signedInUser();
    // Not gated on the window being open: an application only sits on the
    // student once a step has sent it back, and closing applications stops new
    // ones rather than stranding that one.
    const editable = application.status === 'applied'
      && !locked(application)
      && application.session === state.session
      && application.student2_email?.toLowerCase() !== me.email?.toLowerCase();
    // Once it can no longer be corrected it is read rather than filled in,
    // and what is read is the application: the whole project record here put
    // the stipend details and every report on a page headed Application Form.
    body = editable
      ? <ApplyForm initial={application} student={state.student} onSaved={load} />
      : <UrfFormShell path={`/urf/urf-application/${application.id}`} />;
  } else if (application && type === 'additional') {
    // Prefilled from the student's most recent other project.
    const previous = state.applications.map((a) => a.id !== application.id && own(a, a.fellows)[0]).find(Boolean);
    const fellow = own(application, application.fellows)[0];

    if (application.status !== 'selected') {
      body = <p>This form opens once your project is selected.</p>;
    } else if (locked(fellow)) {
      body = <UrfFormShell path={`/urf/urf-additional-info/${fellow.id}`} />;
    } else {
      body = <FellowForm applicationId={application.id} initial={fellow} prefill={previous} onSaved={load} />;
    }
  } else if (application && REPORT_TYPES[type]) {
    const round = windowFor(state.report_windows, application, type);
    // One report per round, so the one the student filed is the one they read.
    const filed = own(application, application.reports).find((report) => report.type === type);

    if (application.status !== 'selected') {
      body = <p>Reports open once your project is selected.</p>;
    } else if (locked(filed)) {
      body = <UrfFormShell path={`/urf/${REPORT_FORMS[type]}/${filed.id}`} />;
    } else if (round?.is_open) {
      body = <ReportForm application={application} type={type} filed={filed} onSaved={load} />;
    } else {
      // Say which round it is rather than offer a form the server would refuse.
      body = (
        <p>
          {!round && 'This report has not been scheduled yet.'}
          {round && new Date(round.opens_on) > new Date() && `This report can be filed from ${formatDate(round.opens_on)} to ${formatDate(round.closes_on)}.`}
          {round && new Date(round.opens_on) <= new Date() && `This report closed on ${formatDate(round.closes_on)}.`}
        </p>
      );
    }
  }

  return (
    <>
      <PageHeader
        title={type === 'new' ? `Apply for URF ${state?.session ?? ''}` : TITLES[type]}
        subtitle={application ? `URF ${application.session} · ${application.project_title}` : undefined}
      />
      <React.Fragment key={version}>{body}</React.Fragment>
    </>
  );
};

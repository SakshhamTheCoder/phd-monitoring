import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import FormGrid from '../../components/forms/formGrid/FormGrid';
import CustomButton from '../../components/forms/fields/CustomButton';
import UrfRecord, { ReportsTable, Section, StatusText, REPORT_TYPES } from '../../components/urf/UrfRecord';
import { ApplyForm, FellowForm, ReportForm, signedInUser } from '../../components/urf/UrfForms';
import { UrfApprovalTrail } from '../../components/urf/UrfApproval';
import { apiUrfMine } from '../../api/urf';
import { formatDate } from '../../utils/timeParse';
import '../../components/urf/UrfForms.css';

// The student's URF projects (newest first), the application window and the
// session a new application joins. `version` changes on every load, so a form
// keyed on it remounts with what was just saved.
const useUrf = () => {
  const [state, setState] = useState(null);
  const [version, setVersion] = useState(0);
  const load = useCallback(async () => {
    const res = await apiUrfMine();
    if (res.success) {
      setState(res.response);
      setVersion((v) => v + 1);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { state, version, load };
};

// One application per session: open unless this year's is waiting or selected.
const canApply = ({ applications_open: open, session, applications }) =>
  open && !applications.some((a) => a.session === session && a.status !== 'rejected');

// The round a report belongs to, if the office has opened one.
const windowFor = (windows, application, type) => (windows || [])
  .find((w) => w.type === type && Number(w.session) === Number(application.session));

/**
 * The forms a project offers right now.
 *
 * The application is always there. The rest wait on selection, and a report
 * waits on its round being open as well, the way progress monitoring waits on
 * a scheduled semester.
 */
const formsFor = (application, windows) => {
  const base = `/forms/urf/${application.id}`;
  const report = (type, path) => {
    const round = windowFor(windows, application, type);
    const filed = application.reports?.some((r) => r.type === type);
    if (!round?.is_open && !filed) return [];

    return [{
      form_type: type === 'final' ? 'urf-final-report' : 'urf-half-yearly-report',
      form_name: REPORT_TYPES[type],
      path: `${base}/${path}`,
      action_required: round?.is_open && !filed,
    }];
  };

  return [
    { form_type: 'urf-application', form_name: 'URF Application Form', path: `${base}/application` },
    ...(application.status === 'selected' ? [
      { form_type: 'urf-additional-info', form_name: 'Additional Information Form', path: `${base}/additional-info`, action_required: !application.fellows?.length },
      ...report('half_yearly', 'half-yearly-report'),
      ...report('final', 'final-report'),
    ] : []),
  ];
};

/** What a fellow is waiting for, when there is no report to file yet. */
const RoundNotice = ({ application, windows }) => {
  if (application.status !== 'selected') return null;

  const upcoming = ['half_yearly', 'final']
    .map((type) => ({ type, round: windowFor(windows, application, type) }))
    .filter(({ type, round }) => round && !round.is_open && !application.reports?.some((r) => r.type === type));

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
  const { state } = useUrf();

  return (
    <Layout>
      <PageHeader
        title="Available Forms"
        subtitle="Undergraduate Research Fellowship"
        actions={state && canApply(state) && (
          <CustomButton text={`Apply for URF ${state.session}`} onClick={() => navigate('/forms/urf-application')} />
        )}
      />
      {state && state.applications.length === 0 && (
        <p>{state.applications_open ? `You have not applied for URF ${state.session} yet.` : 'URF applications are closed right now.'}</p>
      )}
      {state?.applications.map((application) => (
        <div key={application.id}>
          <div className="urf-subhead">
            <h3>URF {application.session} · {application.project_title}</h3>
            <StatusText status={application.status} />
          </div>
          {/* Where the application has reached, and what anyone who sent it
              back asked for. */}
          <UrfApprovalTrail form={application} />
          <RoundNotice application={application} windows={state.report_windows} />
          <FormGrid forms={formsFor(application, state.report_windows)} title={null} />
          {application.reports?.filter((report) => report.mentor_comments || report.adordc_comments || report.dordc_comments).map((report) => (
            <div key={report.id} className="urf-report-approval">
              <div className="urf-subhead">
                <h3>{report.type === 'final' ? 'Final Report' : 'Half-yearly Report'}</h3>
              </div>
              <UrfApprovalTrail form={report} />
            </div>
          ))}
        </div>
      ))}
    </Layout>
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
  const { state, version, load } = useUrf();
  const application = state?.applications.find((a) => String(a.id) === String(id));

  let body = null;
  if (state && type === 'new') {
    body = canApply(state)
      ? <ApplyForm student={state.student} onSaved={() => navigate('/forms')} />
      : <p>{state.applications_open ? `You have already applied for URF ${state.session}.` : 'URF applications are closed right now.'}</p>;
  } else if (state && !application) {
    body = <p>This URF project was not found.</p>;
  } else if (application && type === 'application') {
    const me = signedInUser();
    const editable = state.applications_open
      && application.status === 'applied'
      && application.session === state.session
      && application.student2_email?.toLowerCase() !== me.email?.toLowerCase();
    body = editable ? <ApplyForm initial={application} student={state.student} onSaved={load} /> : <UrfRecord record={application} />;
  } else if (application && type === 'additional') {
    // Prefilled from the student's most recent other project, and still editable.
    const previous = state.applications.find((a) => a.id !== application.id && a.fellows?.length)?.fellows[0];
    body = application.status === 'selected'
      ? <FellowForm applicationId={application.id} initial={application.fellows?.[0]} prefill={previous} onSaved={load} />
      : <p>This form opens once your project is selected.</p>;
  } else if (application && REPORT_TYPES[type]) {
    const round = windowFor(state.report_windows, application, type);
    const filed = application.reports?.filter((report) => report.type === type) || [];
    const submitted = filed.length > 0 && (
      <Section title={`Submitted ${REPORT_TYPES[type]}s`}><ReportsTable reports={filed} /></Section>
    );

    if (application.status !== 'selected') {
      body = <p>Reports open once your project is selected.</p>;
    } else if (round?.is_open) {
      body = <><ReportForm application={application} type={type} onSaved={load} />{submitted}</>;
    } else {
      // The round decides when this is filed, so say which it is rather than
      // offering a form the server would refuse.
      body = (
        <>
          <p>
            {!round && 'This report has not been scheduled yet.'}
            {round && new Date(round.opens_on) > new Date() && `This report can be filed from ${formatDate(round.opens_on)} to ${formatDate(round.closes_on)}.`}
            {round && new Date(round.opens_on) <= new Date() && `This report closed on ${formatDate(round.closes_on)}.`}
          </p>
          {submitted}
        </>
      );
    }
  }

  return (
    <Layout>
      <PageHeader
        title={type === 'new' ? `Apply for URF ${state?.session ?? ''}` : TITLES[type]}
        subtitle={application ? `URF ${application.session} · ${application.project_title}` : undefined}
      />
      <React.Fragment key={version}>{body}</React.Fragment>
    </Layout>
  );
};

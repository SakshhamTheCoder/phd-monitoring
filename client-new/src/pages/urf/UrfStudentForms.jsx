import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import FormGrid from '../../components/forms/formGrid/FormGrid';
import CustomButton from '../../components/forms/fields/CustomButton';
import UrfRecord, { ReportsTable, Section, StatusBadge, REPORT_TYPES } from '../../components/urf/UrfRecord';
import { ApplyForm, FellowForm, ReportForm, signedInUser } from '../../components/urf/UrfForms';
import { apiUrfMine } from '../../api/urf';
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

const formsFor = (application) => {
  const base = `/forms/urf/${application.id}`;
  return [
    { form_type: 'urf-application', form_name: 'URF Application Form', path: `${base}/application` },
    ...(application.status === 'selected' ? [
      { form_type: 'urf-additional-info', form_name: 'Additional Information Form', path: `${base}/additional-info`, action_required: !application.fellows?.length },
      { form_type: 'urf-half-yearly-report', form_name: REPORT_TYPES.half_yearly, path: `${base}/half-yearly-report` },
      { form_type: 'urf-final-report', form_name: REPORT_TYPES.final, path: `${base}/final-report` },
    ] : []),
  ];
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
            <StatusBadge status={application.status} />
          </div>
          <FormGrid forms={formsFor(application)} title={null} />
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
      ? <ApplyForm onSaved={() => navigate('/forms')} />
      : <p>{state.applications_open ? `You have already applied for URF ${state.session}.` : 'URF applications are closed right now.'}</p>;
  } else if (state && !application) {
    body = <p>This URF project was not found.</p>;
  } else if (application && type === 'application') {
    const me = signedInUser();
    const editable = state.applications_open
      && application.status === 'applied'
      && application.session === state.session
      && application.student2_email?.toLowerCase() !== me.email?.toLowerCase();
    body = editable ? <ApplyForm initial={application} onSaved={load} /> : <UrfRecord record={application} />;
  } else if (application && type === 'additional') {
    // Prefilled from the student's most recent other project, and still editable.
    const previous = state.applications.find((a) => a.id !== application.id && a.fellows?.length)?.fellows[0];
    body = application.status === 'selected'
      ? <FellowForm applicationId={application.id} initial={application.fellows?.[0]} prefill={previous} onSaved={load} />
      : <p>This form opens once your project is selected.</p>;
  } else if (application && REPORT_TYPES[type]) {
    const filed = application.reports?.filter((report) => report.type === type) || [];
    body = application.status === 'selected' ? (
      <>
        <ReportForm application={application} type={type} onSaved={load} />
        {filed.length > 0 && (
          <Section title={`Submitted ${REPORT_TYPES[type]}s`}><ReportsTable reports={filed} /></Section>
        )}
      </>
    ) : <p>Reports open once your project is selected.</p>;
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

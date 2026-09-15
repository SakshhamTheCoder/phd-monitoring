import React, { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import FormGrid from '../../components/forms/formGrid/FormGrid';
import UrfRecord, { ReportsTable, Section, REPORT_TYPES } from '../../components/urf/UrfRecord';
import { ApplyForm, FellowForm, ReportForm, signedInUser } from '../../components/urf/UrfForms';
import { apiUrfMine } from '../../api/urf';

// The student's project and the application window. `version` changes on every
// load, so a form keyed on it remounts with what was just saved.
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

const underWay = (status) => status === 'selected';
const canApplyAfresh = ({ applications_open: open, application }) =>
  open && (!application || application.status === 'rejected');

/**
 * Forms, for a UG student: the URF forms open to them, as cards on the same
 * grid the PhD forms page uses. The additional information form appears once
 * the project is selected, and so do the two reports.
 */
export const UrfFormsPage = () => {
  const { state } = useUrf();
  const application = state?.application;
  const status = application?.status;

  const forms = state ? [
    { form_type: 'urf-application', form_name: 'URF Application Form', action_required: canApplyAfresh(state) },
    ...(underWay(status)
      ? [{ form_type: 'urf-additional-info', form_name: 'Additional Information Form', action_required: !application.fellows?.length }]
      : []),
    ...(underWay(status) ? [
      { form_type: 'urf-half-yearly-report', form_name: REPORT_TYPES.half_yearly },
      { form_type: 'urf-final-report', form_name: REPORT_TYPES.final },
    ] : []),
  ] : [];

  return <Layout>{state && <FormGrid forms={forms} />}</Layout>;
};

const TITLES = {
  application: 'URF Application Form',
  additional: 'Additional Information Form',
  ...REPORT_TYPES,
};

/** One URF form. What it offers follows the project's status. */
export const UrfFormPage = ({ type }) => {
  const { state, version, load } = useUrf();
  const application = state?.application;
  const status = application?.status;

  let body = null;
  if (state && type === 'application') {
    const me = signedInUser();
    const isApplicant = application && application.student2_email?.toLowerCase() !== me.email?.toLowerCase();
    if (state.applications_open && status === 'applied' && isApplicant) {
      body = <ApplyForm initial={application} onSaved={load} />;
    } else if (canApplyAfresh(state)) {
      body = <ApplyForm onSaved={load} />;
    } else if (application) {
      body = <UrfRecord record={application} />;
    } else {
      body = <p>URF applications are closed right now.</p>;
    }
  }
  if (state && type === 'additional') {
    body = underWay(status)
      ? <FellowForm applicationId={application.id} initial={application.fellows?.[0]} onSaved={load} />
      : <p>This form opens once your project is selected.</p>;
  }
  if (state && REPORT_TYPES[type]) {
    const filed = application?.reports?.filter((report) => report.type === type) || [];
    body = underWay(status) ? (
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
      <PageHeader title={TITLES[type]} />
      <React.Fragment key={version}>{body}</React.Fragment>
    </Layout>
  );
};

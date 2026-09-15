import React, { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import FormGrid from '../../components/forms/formGrid/FormGrid';
import UrfRecord, { ReportsTable, Section } from '../../components/urf/UrfRecord';
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

const underWay = (status) => ['selected', 'ongoing'].includes(status);
const canApplyAfresh = ({ applications_open: open, application }) =>
  open && (!application || ['rejected', 'completed'].includes(application.status));

/**
 * Forms, for a UG student: the URF forms open to them, as cards on the same
 * grid the PhD forms page uses. The additional information form appears once
 * the project is selected, the progress report while it is ongoing.
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
    ...(status === 'ongoing' ? [{ form_type: 'urf-progress-report', form_name: 'Progress Report' }] : []),
  ] : [];

  return <Layout>{state && <FormGrid forms={forms} />}</Layout>;
};

const TITLES = {
  application: 'URF Application Form',
  additional: 'Additional Information Form',
  report: 'Progress Report',
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
  if (state && type === 'report') {
    body = status === 'ongoing' ? (
      <>
        <ReportForm applicationId={application.id} onSaved={load} />
        {application.reports?.length > 0 && (
          <Section title="Submitted Reports"><ReportsTable reports={application.reports} /></Section>
        )}
      </>
    ) : <p>Reports are filed while your project is ongoing.</p>;
  }

  return (
    <Layout>
      <PageHeader title={TITLES[type]} />
      <React.Fragment key={version}>{body}</React.Fragment>
    </Layout>
  );
};

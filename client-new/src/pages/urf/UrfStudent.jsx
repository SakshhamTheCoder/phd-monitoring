import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import CustomButton from '../../components/forms/fields/CustomButton';
import UrfRecord from '../../components/urf/UrfRecord';
import { ApplyForm, FellowForm, ReportForm, signedInUser } from '../../components/urf/UrfForms';
import { apiUrfMine } from '../../api/urf';

/**
 * A UG student's URF page. What it offers follows the project's status: the
 * application while the window is open, fellowship details once selected,
 * and reports while the project is ongoing.
 */
const UrfStudent = () => {
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  // Remounting the forms after a save clears what was typed into them.
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    const res = await apiUrfMine();
    if (res.success) {
      setState(res.response);
      setVersion((v) => v + 1);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const application = state?.application;
  const status = application?.status;
  const open = state?.applications_open;
  const me = signedInUser();
  const isApplicant = application && application.student2_email?.toLowerCase() !== me.email?.toLowerCase();
  const editing = open && status === 'applied' && isApplicant;
  const applyingAfresh = open && (!application || status === 'rejected' || status === 'completed');

  return (
    <Layout>
      <PageHeader
        title="Undergraduate Research Fellowship"
        subtitle={application ? null : open ? 'Applications are open.' : 'URF applications are closed right now.'}
        actions={['selected', 'ongoing'].includes(status) && (
          <CustomButton text="Manage Publications" onClick={() => navigate('/publications')} />
        )}
      />

      {state && (
        <React.Fragment key={version}>
          {editing ? <ApplyForm initial={application} onSaved={load} /> : application && <UrfRecord record={application} />}
          {['selected', 'ongoing'].includes(status) && (
            <FellowForm applicationId={application.id} initial={application.fellows?.[0]} onSaved={load} />
          )}
          {status === 'ongoing' && <ReportForm applicationId={application.id} onSaved={load} />}
          {applyingAfresh && <ApplyForm onSaved={load} />}
        </React.Fragment>
      )}
    </Layout>
  );
};

export default UrfStudent;

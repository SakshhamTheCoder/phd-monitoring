import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../pageHeader/PageHeader';
import CustomButton from '../forms/fields/CustomButton';
import InfoGrid from '../profileFields/InfoGrid';
import UrfRecord, { Section } from './UrfRecord';
import { signedInUser } from './UrfForms';
import { apiUrfMine } from '../../api/urf';

/**
 * A UG student's home: who they are, and their URF project with its team and
 * mentors. Roll number and department are asked for on the application, so
 * they come from whichever student slot on it is this user.
 */
const UgProfile = () => {
  const navigate = useNavigate();
  const [state, setState] = useState(null);

  useEffect(() => {
    apiUrfMine().then((res) => res.success && setState(res.response));
  }, []);

  const me = signedInUser();
  const application = state?.application;
  const slot = application?.student2_email?.toLowerCase() === me.email?.toLowerCase() ? 2 : 1;

  return (
    <>
      <PageHeader
        title="Profile"
        subtitle="UG Student"
        actions={state && (
          <CustomButton text={application ? 'Open URF' : 'Apply for URF'} onClick={() => navigate('/urf')} />
        )}
      />

      <Section title="Personal Details">
        <InfoGrid rows={[
          { label: 'Name', value: [me.first_name, me.last_name].filter(Boolean).join(' ') },
          { label: 'Email', value: me.email },
          { label: 'Phone Number', value: me.phone },
          { label: 'Gender', value: me.gender },
          { label: 'Roll Number', value: application?.[`student${slot}_roll_no`] },
          { label: 'Department', value: application?.[`student${slot}_department`]?.name },
        ]} />
      </Section>

      {state && (application ? (
        <UrfRecord record={application} summary />
      ) : (
        <Section title="URF Project">
          <p>
            {state.applications_open
              ? 'You have not applied for the URF yet.'
              : 'You have not applied for the URF. Applications are closed right now.'}
          </p>
        </Section>
      ))}
    </>
  );
};

export default UgProfile;

import React, { useEffect, useState } from 'react';
import '../profileCard/ProfileCard.css';
import InfoGrid from '../profileFields/InfoGrid';
import { HeaderLine, StatusBadge, TeamTables } from './UrfRecord';
import { signedInUser } from './UrfForms';
import { apiUrfMine } from '../../api/urf';

/**
 * A UG student's home, laid out like the PhD student profile: their name with
 * their URF project beside it, their details in the framed grid, then the team
 * and mentors. Roll number and department are asked for on the application,
 * so they come from whichever student slot on it is this user.
 */
const UgProfile = () => {
  const [state, setState] = useState(null);

  useEffect(() => {
    apiUrfMine().then((res) => res.success && setState(res.response));
  }, []);

  const me = signedInUser();
  const application = state?.application;
  const slot = application?.student2_email?.toLowerCase() === me.email?.toLowerCase() ? 2 : 1;

  return (
    <div className="student-container">
      <div className="student-header">
        <div className="student-header-text">
          <h2>{[me.first_name, me.last_name].filter(Boolean).join(' ')}</h2>
          <div className="student-research">
            <HeaderLine label="URF Project" title>{application?.project_title}</HeaderLine>
            {application && <HeaderLine label="Status"><StatusBadge status={application.status} /></HeaderLine>}
          </div>
        </div>
      </div>

      <div className="student-details">
        <InfoGrid className="student-info-grid" rows={[
          { label: 'Roll Number', value: application?.[`student${slot}_roll_no`] },
          { label: 'Department', value: application?.[`student${slot}_department`]?.name },
          { label: 'Email', value: me.email },
          { label: 'Phone', value: me.phone },
          { label: 'Gender', value: me.gender },
          { label: 'Programme', value: 'Undergraduate Research Fellowship' },
        ]} />
      </div>

      {application && <TeamTables record={application} />}
    </div>
  );
};

export default UgProfile;

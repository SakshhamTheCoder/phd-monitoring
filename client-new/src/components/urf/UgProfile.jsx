import React, { useEffect, useState } from 'react';
import '../profileCard/ProfileCard.css';
import InfoGrid from '../profileFields/InfoGrid';
import GridContainer from '../forms/fields/GridContainer';
import TableComponent from '../forms/table/TableComponent';
import { HeaderLine, StatusBadge, TeamTables, facultyName, yearLabel } from './UrfRecord';
import { signedInUser } from './UrfForms';
import { apiUrfMine } from '../../api/urf';

/**
 * A UG student's home, laid out like the PhD student profile: their name with
 * their latest URF project beside it, their details in the framed grid, every
 * URF project they have been on, then the latest project's team and mentors.
 * Roll number, branch and year are asked for on the application, so they come
 * from the latest one.
 */
const UgProfile = () => {
  const [state, setState] = useState(null);

  useEffect(() => {
    apiUrfMine().then((res) => res.success && setState(res.response));
  }, []);

  const me = signedInUser();
  const applications = state?.applications || [];
  const latest = applications[0];
  const slot = latest?.student2_email?.toLowerCase() === me.email?.toLowerCase() ? 2 : 1;

  const projects = applications.map((a) => ({
    session: a.session,
    project_title: a.project_title,
    status: a.status,
    team: [a.student1_name, a.student2_name].filter(Boolean).join(', '),
    mentors: [a.mentor1, a.mentor2].filter(Boolean).map(facultyName).join(', '),
  }));

  return (
    <div className="student-container">
      <div className="student-header">
        <div className="student-header-text">
          <h2>{[me.first_name, me.last_name].filter(Boolean).join(' ')}</h2>
          <div className="student-research">
            <HeaderLine label="Latest URF Project" title>
              {latest && `URF ${latest.session} · ${latest.project_title}`}
            </HeaderLine>
            {latest && <HeaderLine label="Status"><StatusBadge status={latest.status} /></HeaderLine>}
          </div>
        </div>
      </div>

      <div className="student-details">
        <InfoGrid className="student-info-grid" rows={[
          { label: 'Roll Number', value: latest?.[`student${slot}_roll_no`] },
          { label: 'Branch', value: latest?.[`student${slot}_department`]?.name },
          { label: 'Year', value: yearLabel(latest?.[`student${slot}_year`]) },
          { label: 'Email', value: me.email },
          { label: 'Phone', value: me.phone },
          { label: 'Gender', value: me.gender },
          { label: 'Programme', value: 'Undergraduate Research Fellowship' },
        ]} />
      </div>

      {projects.length > 0 && (
        <GridContainer
          label="URF Projects"
          elements={[
            <TableComponent
              data={projects}
              keys={['session', 'project_title', 'status', 'team', 'mentors']}
              titles={['Session', 'Project Title', 'Status', 'Team Members', 'Faculty Mentors']}
              components={[{ key: 'status', component: ({ data }) => <StatusBadge status={data} /> }]}
            />,
          ]}
          space={3}
        />
      )}

      {latest && <TeamTables record={latest} />}
    </div>
  );
};

export default UgProfile;

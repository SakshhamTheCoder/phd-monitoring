import React, { useEffect, useState } from 'react';
import '../profileCard/ProfileCard.css';
import InfoGrid from '../profileFields/InfoGrid';
import GridContainer from '../forms/fields/GridContainer';
import TableComponent from '../forms/table/TableComponent';
import FacultyLink from '../facultyLink/FacultyLink';
import { HeaderLine, StatusText, facultyName, yearLabel } from './UrfRecord';
import { signedInUser } from './UrfForms';
import { apiUrfMine } from '../../api/urf';
import { EMPTY_VALUE } from '../../utils/timeParse';

const PROJECT_KEYS = ['session', 'project_title', 'status', 'teammate', 'teammate_branch', 'teammate_year', 'mentors'];
const PROJECT_TITLES = ['Session', 'Project Title', 'Status', 'Team Member', 'Branch', 'Year', 'Faculty Mentors'];

const PROJECT_CELLS = [
  { key: 'status', component: ({ data }) => <StatusText status={data} /> },
  {
    // Each mentor links to their own research profile, as names do elsewhere.
    key: 'mentors',
    component: ({ data }) => (data?.length ? data.map((mentor, index) => (
      <React.Fragment key={mentor.code ?? index}>
        {index > 0 && ', '}
        <FacultyLink code={mentor.code} name={mentor.name} />
      </React.Fragment>
    )) : EMPTY_VALUE),
  },
];

/**
 * A UG student's home, laid out like the PhD student profile: their name with
 * their current URF project beside it, their details in the framed grid, then
 * that project and the ones behind it. Roll number, branch and year are asked
 * for on the application, so they come from the current one.
 */
const UgProfile = () => {
  const [state, setState] = useState(null);

  useEffect(() => {
    apiUrfMine().then((res) => res.success && setState(res.response));
  }, []);

  const me = signedInUser();
  const applications = state?.applications || [];
  // The server sends the newest session first, so the current project leads.
  const [current, ...past] = applications;
  const slotOn = (application) => (
    application?.student2_email?.toLowerCase() === me.email?.toLowerCase() ? 2 : 1
  );
  const slot = slotOn(current);

  const projectRow = (application) => {
    // This is the student's own profile, so the row names the other member only.
    const other = slotOn(application) === 1 ? 2 : 1;
    const teammate = application[`student${other}_name`];

    return {
      session: application.session,
      project_title: application.project_title,
      status: application.status,
      teammate: teammate || EMPTY_VALUE,
      teammate_branch: (teammate && application[`student${other}_department`]?.name) || EMPTY_VALUE,
      teammate_year: (teammate && yearLabel(application[`student${other}_year`])) || EMPTY_VALUE,
      mentors: [application.mentor1, application.mentor2].filter(Boolean).map((mentor) => ({
        code: mentor.faculty_code,
        name: facultyName(mentor),
      })),
    };
  };

  return (
    <div className="student-container">
      <div className="student-header">
        <div className="student-header-text">
          <h2>{[me.first_name, me.last_name].filter(Boolean).join(' ')}</h2>
          <div className="student-research">
            <HeaderLine label="Current URF Project" title>
              {current && `URF ${current.session} · ${current.project_title}`}
            </HeaderLine>
            {current && <HeaderLine label="Status"><StatusText status={current.status} /></HeaderLine>}
          </div>
        </div>
      </div>

      <div className="student-details">
        <InfoGrid className="student-info-grid" rows={[
          { label: 'Roll Number', value: current?.[`student${slot}_roll_no`] },
          { label: 'Branch', value: current?.[`student${slot}_department`]?.name },
          { label: 'Year', value: yearLabel(current?.[`student${slot}_year`]) },
          { label: 'Email', value: me.email },
          { label: 'Phone', value: me.phone },
          { label: 'Gender', value: me.gender },
        ]} />
      </div>

      {current && (
        <GridContainer
          label="Current URF Project"
          elements={[
            <TableComponent
              data={[projectRow(current)]}
              keys={PROJECT_KEYS}
              titles={PROJECT_TITLES}
              components={PROJECT_CELLS}
            />,
          ]}
          space={3}
        />
      )}

      {past.length > 0 && (
        <GridContainer
          label="Past URF Projects"
          elements={[
            <TableComponent
              data={past.map(projectRow)}
              keys={PROJECT_KEYS}
              titles={PROJECT_TITLES}
              components={PROJECT_CELLS}
            />,
          ]}
          space={3}
        />
      )}
    </div>
  );
};

export default UgProfile;

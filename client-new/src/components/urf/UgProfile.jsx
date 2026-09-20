import React, { useEffect, useState } from 'react';
import '../profileCard/ProfileCard.css';
import InfoGrid from '../profileFields/InfoGrid';
import GridContainer from '../forms/fields/GridContainer';
import TableComponent from '../forms/table/TableComponent';
import FacultyLink from '../facultyLink/FacultyLink';
import { HeaderLine, StatusText, facultyName, yearLabel } from './UrfRecord';
import { signedInUser } from './UrfForms';
import { apiUrfMine } from '../../api/urf';
import UgDetailsForm from './UgDetailsForm';
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
 * that project and the ones behind it. Roll number, branch and year come from
 * what they gave at sign-up, falling back to the current application for an
 * account an admin created.
 */
const UgProfile = () => {
  const [state, setState] = useState(null);
  const [editing, setEditing] = useState(false);

  const load = () => apiUrfMine().then((res) => res.success && setState(res.response));

  useEffect(() => { load(); }, []);

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
      teammate_branch: (teammate && application[`student${other}_branch`]?.name) || EMPTY_VALUE,
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
            <HeaderLine label="Status">
              {current && <StatusText status={current.status} />}
            </HeaderLine>
            <HeaderLine label="Faculty Mentors">
              {current && [current.mentor1, current.mentor2].filter(Boolean).map((mentor, index) => (
                <React.Fragment key={mentor.faculty_code ?? index}>
                  {index > 0 && ', '}
                  <FacultyLink code={mentor.faculty_code} name={facultyName(mentor)} />
                </React.Fragment>
              ))}
            </HeaderLine>
          </div>
        </div>

        {/* How to reach them stays theirs to correct; who they are becomes the
            office's once they hold a project. Sits on the name's line, as the
            scholar's edit does. */}
        {state?.student && (
          <div className="profile-actions">
            <button className="profile-edit-small" onClick={() => setEditing(true)}>
              <i className="fa fa-pencil" aria-hidden="true"></i> Edit
            </button>
          </div>
        )}
      </div>

      <div className="student-details">
        <InfoGrid className="student-info-grid" rows={[
          { label: 'Roll Number', value: state?.student?.roll_no || current?.[`student${slot}_roll_no`] },
          { label: 'Branch', value: state?.student?.branch?.name || current?.[`student${slot}_branch`]?.name },
          { label: 'Year', value: yearLabel(state?.student?.year || current?.[`student${slot}_year`]) },
          { label: 'Semester', value: state?.student?.semester_of_study },
          { label: 'Email', value: me.email },
          { label: 'Phone', value: me.phone },
          { label: 'Gender', value: me.gender },
          { label: 'Programme', value: state?.student?.branch?.programme },
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
      <UgDetailsForm
        student={state?.student}
        applied={applications.length > 0}
        isOpen={editing}
        onClose={() => setEditing(false)}
        onSaved={load}
      />
    </div>
  );
};

export default UgProfile;

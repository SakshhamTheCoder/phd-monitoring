import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import '../profileCard/ProfileCard.css';
import InfoGrid from '../profileFields/InfoGrid';
import Page from '../page/Page';
import Panel, { PanelSection } from '../panel/Panel';
import TableComponent from '../forms/table/TableComponent';
import FacultyLink from '../facultyLink/FacultyLink';
import CustomButton from '../forms/fields/CustomButton';
import { HeaderLine, StatusText, facultyName, yearLabel } from './UrfRecord';
import { signedInUser } from './UrfForms';
import { apiUrfMine, apiUrfUpdateMine } from '../../api/urf';
import useBranchOptions from '../../hooks/useBranches';
import { EMPTY_VALUE } from '../../utils/timeParse';

const YEARS = [1, 2, 3, 4].map((year) => ({ title: yearLabel(year), value: year }));
const GENDERS = [{ title: 'Male', value: 'Male' }, { title: 'Female', value: 'Female' }];

// Who they are is on a URF project once they apply, and the branch is what
// routes a form to an ADORDC, so those rows say why rather than disappearing.
const LOCKED_NOTE = 'On a URF project now. Ask the office to change it.';

const PROJECT_KEYS = ['session', 'project_title', 'status', 'teammate', 'teammate_branch', 'teammate_year', 'mentors'];
const PROJECT_TITLES = ['Session', 'Project title', 'Status', 'Team member', 'Branch', 'Year', 'Faculty mentors'];

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
 * their current URF project under it, their details below that, then
 * that project and the ones behind it. Roll number, branch and year come from
 * what they gave at sign-up, falling back to the current application for an
 * account an admin created.
 */
const UgProfile = () => {
  const [state, setState] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const branches = useBranchOptions();

  const load = () => apiUrfMine().then((res) => res.success && setState(res.response));

  useEffect(() => { load(); }, []);

  // Read once per mount and updated on save, instead of parsing localStorage
  // on every render.
  const [me, setMe] = useState(signedInUser);
  const applications = state?.applications || [];
  const applied = applications.length > 0;

  const startEdit = () => {
    setForm({
      phone: me.phone || '',
      gender: me.gender || '',
      roll_no: state?.student?.roll_no || '',
      branch_id: state?.student?.branch_id || '',
      year: state?.student?.year || '',
    });
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    const res = await apiUrfUpdateMine(form);
    setSaving(false);
    if (!res.success) return;

    // The header reads the account stored at sign-in, so the two fields this
    // changes are kept in step with it.
    const updated = { ...me, phone: form.phone, gender: form.gender };
    localStorage.setItem('user', JSON.stringify(updated));
    setMe(updated);
    toast.success('Your details are saved');
    setEditing(false);
    load();
  };
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

  const rows = [
    {
      label: 'Roll Number',
      value: state?.student?.roll_no || current?.[`student${slot}_roll_no`],
      field: 'roll_no',
      disabled: applied,
      hint: applied ? LOCKED_NOTE : undefined,
    },
    {
      label: 'Branch',
      value: state?.student?.branch?.name || current?.[`student${slot}_branch`]?.name,
      field: 'branch_id',
      options: branches,
      disabled: applied,
      hint: applied ? LOCKED_NOTE : undefined,
    },
    {
      label: 'Year',
      value: yearLabel(state?.student?.year || current?.[`student${slot}_year`]),
      field: 'year',
      options: YEARS,
      disabled: applied,
      hint: applied ? LOCKED_NOTE : undefined,
    },
    // Counted from the year rather than stored, so there is nothing to edit.
    { label: 'Semester', value: state?.student?.semester_of_study },
    { label: 'Email', value: me.email },
    { label: 'Phone', value: me.phone, field: 'phone' },
    { label: 'Gender', value: me.gender, field: 'gender', options: GENDERS },
    { label: 'Programme', value: state?.student?.branch?.programme },
  ];

  // How to reach them stays theirs to correct; who they are becomes the
  // office's once they hold a project. Edits in place, as both the other
  // profiles do.
  const actions = state?.student && (editing ? (
    <>
      <CustomButton text="Save" onClick={save} busy={saving} />
      <CustomButton text="Cancel" variant="quiet" onClick={() => setEditing(false)} />
    </>
  ) : (
    <CustomButton text="Edit" variant="secondary" onClick={startEdit} />
  ));

  return (
    <Page title={[me.first_name, me.last_name].filter(Boolean).join(' ')} actions={actions}>
      <Panel>
        <PanelSection>
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
        </PanelSection>
        <PanelSection>
          <InfoGrid
            editing={editing}
            values={form}
            onChange={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
            rows={rows}
          />
        </PanelSection>
      </Panel>

      {current && (
        <Panel flush title="Current URF project">
          <TableComponent
            data={[projectRow(current)]}
            keys={PROJECT_KEYS}
            titles={PROJECT_TITLES}
            components={PROJECT_CELLS}
          />
        </Panel>
      )}

      {past.length > 0 && (
        <Panel flush title="Past URF projects">
          <TableComponent
            data={past.map(projectRow)}
            keys={PROJECT_KEYS}
            titles={PROJECT_TITLES}
            components={PROJECT_CELLS}
          />
        </Panel>
      )}
    </Page>
  );
};

export default UgProfile;

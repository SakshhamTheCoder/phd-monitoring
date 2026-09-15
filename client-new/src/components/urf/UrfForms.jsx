import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import GridContainer from '../forms/fields/GridContainer';
import InputField from '../forms/fields/InputField';
import DropdownField from '../forms/fields/DropdownField';
import DateField from '../forms/fields/DateField';
import FileUploadField from '../forms/fields/FileUploadField';
import InputSuggestions from '../forms/fields/InputSuggestions';
import CustomButton from '../forms/fields/CustomButton';
import CustomModal from '../forms/modal/CustomModal';
import InfoGrid from '../profileFields/InfoGrid';
import ShowPublications from '../publications/ShowPublications';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import { apiUrfApply, apiUrfDepartments, apiUrfFellow, apiUrfReport } from '../../api/urf';
import { Section, facultyName, yearLabel, REPORT_TYPES } from './UrfRecord';
import './UrfForms.css';

const GENDERS = [{ title: 'Male', value: 'Male' }, { title: 'Female', value: 'Female' }];
const YEARS = [1, 2, 3, 4].map((year) => ({ title: yearLabel(year), value: year }));
const STUDENT_FIELDS = ['name', 'roll_no', 'department_id', 'year', 'gender', 'email', 'phone'];

export const signedInUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user')) || {};
  } catch {
    return {};
  }
};

// One setter per field, so each input needs only its key.
const useBody = (initial) => {
  const [body, setBody] = useState(initial);
  const set = (key) => (value) => setBody((prev) => ({ ...prev, [key]: value }));
  return [body, set];
};

// The portal's departments, offered as the student's branch.
const useBranches = () => {
  const [branches, setBranches] = useState([]);
  useEffect(() => {
    apiUrfDepartments().then((res) => res.success && setBranches(res.response.map((d) => ({ title: d.name, value: d.id }))));
  }, []);
  return branches;
};

const Submit = ({ text, onClick }) => {
  const [saving, setSaving] = useState(false);
  const run = async () => {
    setSaving(true);
    await onClick();
    setSaving(false);
  };
  return <GridContainer elements={[<CustomButton text={saving ? 'Saving…' : text} onClick={run} disabled={saving} />]} />;
};

/** A student's fields. `account` locks what the signed-in account already knows. */
const StudentFields = ({ n, body, set, branches, account = {} }) => {
  const key = (field) => `student${n}_${field}`;
  return (
    <GridContainer
      elements={[
        <InputField label="Name" initialValue={body[key('name')]} onChange={set(key('name'))} isLocked={!!account.name} required />,
        <InputField label="Roll Number" initialValue={body[key('roll_no')]} onChange={set(key('roll_no'))} required />,
        <DropdownField label="Branch" options={branches} initialValue={body[key('department_id')]} onChange={set(key('department_id'))} required />,
        <DropdownField label="Year" options={YEARS} initialValue={body[key('year')]} onChange={set(key('year'))} required />,
        <DropdownField label="Gender" options={GENDERS} initialValue={body[key('gender')]} onChange={set(key('gender'))} isLocked={!!account.gender} required />,
        <InputField label="Official Email" type="email" initialValue={body[key('email')]} onChange={set(key('email'))} isLocked={!!account.email} required />,
        <InputField label="Phone Number" initialValue={body[key('phone')]} onChange={set(key('phone'))} isLocked={!!account.phone} required />,
      ]}
    />
  );
};

/** One faculty mentor on one row: the search, what it fills in, and remove. */
const MentorRow = ({ initial, onPick, onRemove, required }) => {
  const [picked, setPicked] = useState(null);
  const shown = picked || (initial && {
    name: facultyName(initial),
    email: initial.user?.email,
    designation: initial.designation,
    department: initial.department?.name,
  });
  return (
    <div className="urf-mentor-row">
      <InputSuggestions
        apiUrl={`${baseURL}/suggestions/faculty`}
        body={{ type: 'internal' }}
        label="Faculty Name"
        initialValue={shown?.name}
        onSelect={(faculty) => { setPicked(faculty); onPick(faculty.id); }}
        required={required}
      />
      <InputField label="Email" initialValue={shown?.email || ''} isLocked />
      <InputField label="Designation" initialValue={shown?.designation || ''} isLocked />
      <InputField label="Department" initialValue={shown?.department || ''} isLocked />
      {onRemove ? (
        <button type="button" className="urf-remove-btn" onClick={onRemove} title="Remove mentor" aria-label="Remove mentor">
          <i className="fa fa-trash" aria-hidden="true"></i>
        </button>
      ) : <span />}
    </div>
  );
};

const APPLICATION_FIELDS = ['project_title', 'mentor1_faculty_code', 'mentor2_faculty_code']
  .concat(...[1, 2].map((n) => STUDENT_FIELDS.map((f) => `student${n}_${f}`)));

/**
 * The URF application. The signed-in student's own name, email, phone and
 * gender come from their account; a second student and a second mentor are
 * added with a button, one of each at most. Passing `initial` corrects an
 * application still waiting for a result.
 */
export const ApplyForm = ({ initial, onSaved }) => {
  const me = signedInUser();
  const account = {
    name: [me.first_name, me.last_name].filter(Boolean).join(' '),
    email: me.email,
    phone: me.phone,
    gender: me.gender,
  };
  const branches = useBranches();
  const [body, set] = useBody(initial
    ? Object.fromEntries(APPLICATION_FIELDS.map((f) => [f, initial[f]]))
    : {
      student1_name: account.name,
      student1_email: account.email,
      student1_phone: account.phone,
      student1_gender: account.gender,
    });
  const [teammate, setTeammate] = useState(!!initial?.student2_name);
  const [secondMentor, setSecondMentor] = useState(!!initial?.mentor2_faculty_code);

  // Removing clears the fields, so the server drops them on save.
  const removeTeammate = () => {
    STUDENT_FIELDS.forEach((f) => set(`student2_${f}`)(''));
    setTeammate(false);
  };
  const removeMentor = () => {
    set('mentor2_faculty_code')('');
    setSecondMentor(false);
  };

  const submit = async () => {
    const res = await apiUrfApply(body);
    if (res.success) {
      toast.success(initial ? 'Application updated' : 'Application submitted');
      onSaved();
    }
  };

  return (
    <Section title={initial ? 'Edit Application' : 'Application'}>
      <GridContainer elements={[
        <InputField label="Project Title" initialValue={body.project_title} onChange={set('project_title')} required />,
      ]} space={3} />

      <div className="urf-subhead"><h3>Your Details</h3></div>
      <StudentFields n={1} body={body} set={set} branches={branches} account={account} />

      <div className="urf-subhead">
        <h3>Team Member</h3>
        {teammate ? (
          <button type="button" className="urf-remove-btn" onClick={removeTeammate}>
            <i className="fa fa-trash" aria-hidden="true"></i> Remove Team Member
          </button>
        ) : (
          <button type="button" className="urf-add-btn" onClick={() => setTeammate(true)}>
            <i className="fa fa-plus" aria-hidden="true"></i> Add Team Member
          </button>
        )}
      </div>
      {teammate && <StudentFields n={2} body={body} set={set} branches={branches} />}

      <div className="urf-subhead">
        <h3>Faculty Mentors</h3>
        {!secondMentor && (
          <button type="button" className="urf-add-btn" onClick={() => setSecondMentor(true)}>
            <i className="fa fa-plus" aria-hidden="true"></i> Add Faculty Mentor
          </button>
        )}
      </div>
      <MentorRow initial={initial?.mentor1} onPick={set('mentor1_faculty_code')} required />
      {secondMentor && (
        <MentorRow initial={initial?.mentor2} onPick={set('mentor2_faculty_code')} onRemove={removeMentor} />
      )}

      <GridContainer elements={[
        <FileUploadField
          label={initial ? 'Replace Project Proposal (PDF)' : 'Project Proposal (PDF)'}
          onChange={set('proposal')}
          maxSizeMB={20}
          required={!initial}
        />,
      ]} />
      <Submit text={initial ? 'Update Application' : 'Submit Application'} onClick={submit} />
    </Section>
  );
};

/** What a selected student gives for the stipend. */
export const FellowForm = ({ applicationId, initial, onSaved }) => {
  const [body, set] = useBody(initial || {});

  const submit = async () => {
    const res = await apiUrfFellow(applicationId, body);
    if (res.success) {
      toast.success('Fellowship details saved');
      onSaved();
    }
  };

  return (
    <Section title="Fellowship Details">
      <GridContainer elements={[
        <InputField label="Full Name (as per PAN Card)" initialValue={body.full_name} onChange={set('full_name')} required />,
        <DateField label="Date of Birth" initialValue={body.dob} onChange={set('dob')} required />,
        <DropdownField label="Gender" options={GENDERS} initialValue={body.gender} onChange={set('gender')} required />,
        <InputField label="Father's Name" initialValue={body.father_name} onChange={set('father_name')} required />,
        <InputField label="PAN Card Number" initialValue={body.pan} onChange={set('pan')} required />,
        <InputField label="Aadhaar Card Number" initialValue={body.aadhaar} onChange={set('aadhaar')} required />,
        <InputField label="Bank Name" initialValue={body.bank_name} onChange={set('bank_name')} required />,
        <InputField label="Bank Account Number" initialValue={body.account_no} onChange={set('account_no')} required />,
        <InputField label="IFSC Code" initialValue={body.ifsc} onChange={set('ifsc')} required />,
      ]} />
      <Submit text={initial ? 'Update Details' : 'Submit Details'} onClick={submit} />
    </Section>
  );
};

/**
 * The half-yearly progress report or the final report, with the sheet's
 * fields. Who is filing and for which project is filled in from the
 * application; publications are linked from the project's library the way a
 * PhD progress form links them.
 */
export const ReportForm = ({ application, type, onSaved }) => {
  const me = signedInUser();
  const [body, set] = useBody({ type });
  const [library, setLibrary] = useState(null);
  const [picking, setPicking] = useState(false);
  const [selection, setSelection] = useState({});
  const [linked, setLinked] = useState({});

  const slot = application.student2_email?.toLowerCase() === me.email?.toLowerCase() ? 2 : 1;
  const mentors = [application.mentor1, application.mentor2].filter(Boolean);

  const loadLibrary = () => customFetch(`${baseURL}/publications`, 'GET', {}, true, false, false)
    .then((res) => res.success && setLibrary(res.response));
  useEffect(() => { loadLibrary(); }, []);

  // The picker reports ticks as { group: { id: true } }. Ticked rows join what is
  // already linked, so opening the picker again to add more keeps earlier picks.
  const confirmPicks = () => {
    setLinked((prev) => {
      const next = { ...prev };
      Object.entries(selection).forEach(([group, ticks]) => {
        const have = new Set((next[group] || []).map((row) => row.id));
        const picked = (library?.[group] || []).filter((row) => ticks?.[row.id] && !have.has(row.id));
        next[group] = [...(next[group] || []), ...picked];
      });
      return next;
    });
    setSelection({});
    setPicking(false);
  };

  // Taking a publication off this report leaves it in the library for later reports.
  const unlink = (id, group) => setLinked((prev) => ({
    ...prev,
    [group]: (prev[group] || []).filter((row) => row.id !== id),
  }));

  const idsIn = (wanted) => Object.entries(linked)
    .filter(([group]) => wanted(group))
    .flatMap(([, rows]) => rows.map((row) => row.id));

  const submit = async () => {
    const res = await apiUrfReport(application.id, {
      ...body,
      publications: JSON.stringify(idsIn((group) => group !== 'patents')),
      patents: JSON.stringify(idsIn((group) => group === 'patents')),
    });
    if (res.success) {
      toast.success(`${REPORT_TYPES[type]} submitted`);
      onSaved();
    }
  };

  return (
    <Section title="Report Details">
      <div className="student-details">
        <InfoGrid rows={[
          { label: 'Name', value: application[`student${slot}_name`] },
          { label: 'Roll No.', value: application[`student${slot}_roll_no`] },
          { label: 'Department', value: application[`student${slot}_department`]?.name },
          { label: 'Email', value: application[`student${slot}_email`] },
          { label: 'Contact No.', value: application[`student${slot}_phone`] },
          { label: 'Faculty Mentor Name', value: mentors.map(facultyName).join(', ') },
          { label: 'Faculty Mentor Department', value: mentors.map((m) => m.department?.name).filter(Boolean).join(', ') },
          { label: 'Title of Project', value: application.project_title, span: 'all' },
        ]} />
      </div>

      <div className="urf-subhead">
        <h3>Publication Details</h3>
        <button type="button" className="urf-add-btn" onClick={() => setPicking(true)}>
          <i className="fa fa-plus" aria-hidden="true"></i> Add Publications
        </button>
      </div>
      <ShowPublications formData={linked} enableEdit={false} enableDelete onDelete={unlink} />

      <GridContainer elements={[
        <InputField label="Conference Presentation (if any)" initialValue={body.conference_presentation} onChange={set('conference_presentation')} />,
        <FileUploadField label="Upload the Report (PDF)" onChange={set('report')} maxSizeMB={20} required />,
      ]} />
      <Submit text={`Submit ${REPORT_TYPES[type]}`} onClick={submit} />

      {/* The project's library, as the PhD progress form shows it: add a new
          publication once with Add New, then pick it for this report or any later one. */}
      <CustomModal
        isOpen={picking}
        onClose={() => setPicking(false)}
        title="Add Publications"
        minHeight="200px"
        maxHeight="600px"
        minWidth="650px"
        maxWidth="700px"
        closeOnOutsideClick={false}
      >
        <ShowPublications
          formData={library}
          enableSelect
          enableSubmit
          enableEdit={false}
          canAdd
          onSelect={setSelection}
          onSubmit={confirmPicks}
          refetchData={loadLibrary}
        />
      </CustomModal>
    </Section>
  );
};

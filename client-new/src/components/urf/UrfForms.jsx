import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import GridContainer from '../forms/fields/GridContainer';
import InputField from '../forms/fields/InputField';
import DropdownField from '../forms/fields/DropdownField';
import DateField from '../forms/fields/DateField';
import FileUploadField from '../forms/fields/FileUploadField';
import InputSuggestions from '../forms/fields/InputSuggestions';
import CustomButton from '../forms/fields/CustomButton';
import FormActions from '../common/FormActions';
import { PanelSection } from '../panel/Panel';
import CustomModal from '../forms/modal/CustomModal';
import ShowPublications from '../publications/ShowPublications';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import { apiUrfApply, apiUrfFellow, apiUrfReport } from '../../api/urf';
import useBranches from '../../hooks/useBranches';
import { Section, facultyName, yearLabel, REPORT_TYPES } from './UrfRecord';
import './UrfForms.css';

const GENDERS = [{ title: 'Male', value: 'Male' }, { title: 'Female', value: 'Female' }];
const YEARS = [1, 2, 3, 4].map((year) => ({ title: yearLabel(year), value: year }));
const STUDENT_FIELDS = ['name', 'roll_no', 'branch_id', 'year', 'gender', 'email', 'phone'];

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

const Submit = ({ text, onClick }) => {
  const [saving, setSaving] = useState(false);
  const run = async () => {
    setSaving(true);
    await onClick();
    setSaving(false);
  };
  return (
    <PanelSection>
      <FormActions>
        <CustomButton text={saving ? 'Saving…' : text} onClick={run} disabled={saving} />
      </FormActions>
    </PanelSection>
  );
};

/**
 * A student's fields. `account` locks what the signed-in account already knows.
 * Year is not locked: it moves with the student, and an application is per
 * session, so a fellow applying again next year corrects it here.
 */
const StudentFields = ({ n, body, set, branches, account = {} }) => {
  const key = (field) => `student${n}_${field}`;
  return (
    <GridContainer
      elements={[
        <InputField label="Name" initialValue={body[key('name')]} onChange={set(key('name'))} isLocked={!!account.name} required />,
        <InputField label="Roll Number" initialValue={body[key('roll_no')]} onChange={set(key('roll_no'))} isLocked={!!account.roll_no} required />,
        <DropdownField label="Branch" options={branches} initialValue={body[key('branch_id')]} onChange={set(key('branch_id'))} isLocked={!!account.branch_id} required />,
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
export const ApplyForm = ({ initial, student, onSaved }) => {
  // Read once per mount: parsing localStorage on each keystroke gains nothing.
  const [me] = useState(signedInUser);
  // `student` is what they gave at sign-up. An account an admin created has
  // none, and then roll number and branch are asked for here as before.
  const account = {
    name: [me.first_name, me.last_name].filter(Boolean).join(' '),
    email: me.email,
    phone: me.phone,
    gender: me.gender,
    roll_no: student?.roll_no,
    branch_id: student?.branch_id,
  };
  const branches = useBranches();
  const [body, set] = useBody(initial
    ? Object.fromEntries(APPLICATION_FIELDS.map((f) => [f, initial[f]]))
    : {
      student1_name: account.name,
      student1_email: account.email,
      student1_phone: account.phone,
      student1_gender: account.gender,
      student1_roll_no: account.roll_no,
      student1_branch_id: account.branch_id,
      student1_year: student?.year,
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
    <Section title={initial ? 'Edit application' : 'Application'}>
      <PanelSection>
        <GridContainer elements={[
          <InputField label="Project Title" initialValue={body.project_title} onChange={set('project_title')} required />,
        ]} space={3} />
      </PanelSection>

      <PanelSection title="Your details">
        <StudentFields n={1} body={body} set={set} branches={branches} account={account} />
      </PanelSection>

      <PanelSection
        title="Team member"
        actions={teammate
          ? <CustomButton text="Remove team member" variant="quiet" size="sm" onClick={removeTeammate} />
          : <CustomButton text="Add team member" variant="secondary" size="sm" onClick={() => setTeammate(true)} />}
      >
        {teammate && <StudentFields n={2} body={body} set={set} branches={branches} />}
      </PanelSection>

      <PanelSection
        title="Faculty mentors"
        actions={!secondMentor && (
          <CustomButton text="Add faculty mentor" variant="secondary" size="sm" onClick={() => setSecondMentor(true)} />
        )}
      >
        <MentorRow initial={initial?.mentor1} onPick={set('mentor1_faculty_code')} required />
        {secondMentor && (
          <MentorRow initial={initial?.mentor2} onPick={set('mentor2_faculty_code')} onRemove={removeMentor} />
        )}
      </PanelSection>

      <PanelSection>
        <GridContainer elements={[
          <FileUploadField
            label={initial ? 'Replace Project Proposal (PDF)' : 'Project Proposal (PDF)'}
            onChange={set('proposal')}
            maxSizeMB={20}
            required={!initial}
          />,
        ]} />
      </PanelSection>
      <Submit text={initial ? 'Update application' : 'Submit application'} onClick={submit} />
    </Section>
  );
};

/**
 * What a selected student gives for the stipend. `prefill`, the details from
 * the student's previous project, fills a first submission but stays editable.
 */
export const FellowForm = ({ applicationId, initial, prefill, onSaved }) => {
  const [body, set] = useBody(initial || prefill || {});

  const submit = async () => {
    const res = await apiUrfFellow(applicationId, body);
    if (res.success) {
      toast.success('Fellowship details saved');
      onSaved();
    }
  };

  return (
    <Section title="Fellowship details">
      <PanelSection>
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
      </PanelSection>
      <Submit text={initial ? 'Update details' : 'Submit details'} onClick={submit} />
    </Section>
  );
};

/**
 * The half-yearly progress report or the final report, with the sheet's
 * fields. Who is filing and for which project is filled in from the
 * application; publications are linked from the student's own library the way
 * a PhD progress form links them.
 */
export const ReportForm = ({ application, type, filed, onSaved }) => {
  // Read once per mount: parsing localStorage on each keystroke gains nothing.
  const [me] = useState(signedInUser);
  // A report sent back opens with what was filed, so correcting it is not retyping it.
  const [body, set] = useBody({ type, conference_presentation: filed?.conference_presentation });
  const [library, setLibrary] = useState(null);
  const [picking, setPicking] = useState(false);
  const [selection, setSelection] = useState({});
  const [linked, setLinked] = useState(filed?.publications || {});

  const slot = application.student2_email?.toLowerCase() === me.email?.toLowerCase() ? 2 : 1;
  const mentors = [application.mentor1, application.mentor2].filter(Boolean);

  const loadLibrary = () => customFetch(`${baseURL}/publications`, 'GET', {})
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
    <Section title="Report details">
      {/* Filled in from the application and locked: the student cannot change them here. */}
      <PanelSection>
        <GridContainer elements={[
          <InputField label="Title of Project" initialValue={application.project_title || ''} isLocked />,
        ]} space={3} />
        <GridContainer elements={[
          <InputField label="Name" initialValue={application[`student${slot}_name`] || ''} isLocked />,
          <InputField label="Roll No." initialValue={application[`student${slot}_roll_no`] || ''} isLocked />,
          <InputField label="Branch" initialValue={application[`student${slot}_branch`]?.name || ''} isLocked />,
          <InputField label="Email" initialValue={application[`student${slot}_email`] || ''} isLocked />,
          <InputField label="Contact No." initialValue={application[`student${slot}_phone`] || ''} isLocked />,
          <InputField label="Faculty Mentor Name" initialValue={mentors.map(facultyName).join(', ')} isLocked />,
          <InputField label="Faculty Mentor Department" initialValue={mentors.map((m) => m.department?.name).filter(Boolean).join(', ')} isLocked />,
        ]} />
      </PanelSection>

      <PanelSection
        title="Publication details"
        actions={<CustomButton text="Add publications" variant="secondary" size="sm" onClick={() => setPicking(true)} />}
      >
        <ShowPublications formData={linked} enableEdit={false} enableDelete onDelete={unlink} />
      </PanelSection>

      <PanelSection>
        <GridContainer elements={[
          <InputField label="Conference Presentation (if any)" initialValue={body.conference_presentation} onChange={set('conference_presentation')} />,
          <FileUploadField label="Upload the Report (PDF)" onChange={set('report')} maxSizeMB={20} required />,
        ]} />
      </PanelSection>
      <Submit text={`Submit ${REPORT_TYPES[type]}`} onClick={submit} />

      {/* The project's library, as the PhD progress form shows it: add a new
          publication once with Add New, then pick it for this report or any later one. */}
      <CustomModal
        isOpen={picking}
        onClose={() => setPicking(false)}
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

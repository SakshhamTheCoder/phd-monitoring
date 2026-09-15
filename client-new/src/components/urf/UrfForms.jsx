import React, { useState } from 'react';
import { toast } from 'react-toastify';
import GridContainer from '../forms/fields/GridContainer';
import InputField from '../forms/fields/InputField';
import DropdownField from '../forms/fields/DropdownField';
import DateField from '../forms/fields/DateField';
import FileUploadField from '../forms/fields/FileUploadField';
import InputSuggestions from '../forms/fields/InputSuggestions';
import CustomButton from '../forms/fields/CustomButton';
import { baseURL } from '../../api/urls';
import { apiUrfApply, apiUrfFellow, apiUrfReport } from '../../api/urf';
import { Section, facultyName } from './UrfRecord';

const GENDERS = [{ title: 'Male', value: 'Male' }, { title: 'Female', value: 'Female' }];

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
  return <GridContainer elements={[<CustomButton text={saving ? 'Saving…' : text} onClick={run} disabled={saving} />]} />;
};

const StudentFields = ({ n, body, set, initial }) => {
  const key = (field) => `student${n}_${field}`;
  const required = n === 1;
  return (
    <GridContainer
      label={n === 1 ? 'First Student' : 'Second Student (if any)'}
      elements={[
        <InputField label="Name" initialValue={body[key('name')]} onChange={set(key('name'))} required={required} />,
        <InputField label="Roll Number" initialValue={body[key('roll_no')]} onChange={set(key('roll_no'))} required={required} />,
        <InputSuggestions
          apiUrl={`${baseURL}/suggestions/department`}
          label="Department"
          initialValue={initial?.[key('department')]?.name}
          onSelect={(department) => set(key('department_id'))(department.id)}
          required={required}
        />,
        <DropdownField label="Gender" options={GENDERS} initialValue={body[key('gender')]} onChange={set(key('gender'))} required={required} />,
        <InputField label="Official Email" type="email" initialValue={body[key('email')]} onChange={set(key('email'))} required={required} />,
        <InputField label="Phone Number" initialValue={body[key('phone')]} onChange={set(key('phone'))} required={required} />,
      ]}
    />
  );
};

const MentorFields = ({ n, initial, onPick }) => {
  const [picked, setPicked] = useState(null);
  const shown = picked || (initial && {
    name: facultyName(initial),
    email: initial.user?.email,
    designation: initial.designation,
    department: initial.department?.name,
  });
  return (
    <GridContainer
      label={n === 1 ? 'First Mentor' : 'Second Mentor (if any)'}
      elements={[
        <InputSuggestions
          apiUrl={`${baseURL}/suggestions/faculty`}
          label="Faculty Name"
          initialValue={shown?.name}
          onSelect={(faculty) => { setPicked(faculty); onPick(faculty.id); }}
          required={n === 1}
        />,
        <InputField label="Email" initialValue={shown?.email || ''} isLocked />,
        <InputField label="Designation" initialValue={shown?.designation || ''} isLocked />,
        <InputField label="Department" initialValue={shown?.department || ''} isLocked />,
      ]}
    />
  );
};

const APPLICATION_FIELDS = ['project_title', 'mentor1_faculty_code', 'mentor2_faculty_code'].concat(
  ...[1, 2].map((n) => ['name', 'roll_no', 'department_id', 'gender', 'email', 'phone'].map((f) => `student${n}_${f}`))
);

/** The URF application. Passing `initial` corrects an application still waiting for a result. */
export const ApplyForm = ({ initial, onSaved }) => {
  const me = signedInUser();
  const [body, set] = useBody(initial
    ? Object.fromEntries(APPLICATION_FIELDS.map((f) => [f, initial[f]]))
    : {
      student1_name: [me.first_name, me.last_name].filter(Boolean).join(' '),
      student1_email: me.email,
      student1_phone: me.phone,
      student1_gender: me.gender,
    });

  const submit = async () => {
    const res = await apiUrfApply(body);
    if (res.success) {
      toast.success(initial ? 'Application updated' : 'Application submitted');
      onSaved();
    }
  };

  return (
    <Section title={initial ? 'Edit Application' : 'Apply for URF'}>
      <GridContainer elements={[
        <InputField label="Project Title" initialValue={body.project_title} onChange={set('project_title')} required />,
      ]} space={3} />
      <StudentFields n={1} body={body} set={set} initial={initial} />
      <MentorFields n={1} initial={initial?.mentor1} onPick={set('mentor1_faculty_code')} />
      <StudentFields n={2} body={body} set={set} initial={initial} />
      <MentorFields n={2} initial={initial?.mentor2} onPick={set('mentor2_faculty_code')} />
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

/** A half-yearly progress report or the final report. Publications come from the Publications page. */
export const ReportForm = ({ applicationId, onSaved }) => {
  const [body, set] = useBody({ type: 'half_yearly' });

  const submit = async () => {
    const res = await apiUrfReport(applicationId, body);
    if (res.success) {
      toast.success('Report submitted');
      onSaved();
    }
  };

  return (
    <Section title="Submit a Report">
      <GridContainer elements={[
        <DropdownField
          label="Report"
          initialValue={body.type}
          options={[{ title: 'Half-yearly Progress Report', value: 'half_yearly' }, { title: 'Final Report', value: 'final' }]}
          onChange={set('type')}
          required
        />,
        <InputField label="Conference Presentation (if any)" initialValue={body.conference_presentation} onChange={set('conference_presentation')} />,
        <FileUploadField label="Upload the Report (PDF)" onChange={set('report')} maxSizeMB={20} required />,
      ]} />
      <Submit text="Submit Report" onClick={submit} />
    </Section>
  );
};

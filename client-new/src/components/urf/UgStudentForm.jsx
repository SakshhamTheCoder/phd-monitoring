import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import GridContainer from '../forms/fields/GridContainer';
import InputField from '../forms/fields/InputField';
import DropdownField from '../forms/fields/DropdownField';
import CustomButton from '../forms/fields/CustomButton';
import { apiUgStudentCreate, apiUgStudentUpdate, apiUrfBranches } from '../../api/urf';
import { yearLabel } from './UrfRecord';

const YEARS = [1, 2, 3, 4].map((year) => ({ title: yearLabel(year), value: year }));
const GENDERS = [{ title: 'Male', value: 'Male' }, { title: 'Female', value: 'Female' }];

/**
 * The office adding or correcting a UG student.
 *
 * A new account is made without a password and sent the link to choose one, the
 * way Manage Users does it. Year of study is counted from the year of
 * admission, so it is asked for only where that count is wrong.
 */
const UgStudentForm = ({ student, onClose, onSaved }) => {
  const [branches, setBranches] = useState([]);
  const [body, setBody] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiUrfBranches().then((res) => res.success && setBranches(
      res.response.map((branch) => ({ title: `${branch.programme} ${branch.name}`, value: branch.id })),
    ));
  }, []);

  useEffect(() => {
    setBody({
      first_name: student?.first_name || '',
      last_name: student?.last_name || '',
      email: student?.email || '',
      phone: student?.phone || '',
      gender: student?.gender || '',
      roll_no: student?.roll_no || '',
      branch_id: student?.branch_id || '',
      admission_year: student?.admission_year || '',
      year: student?.year_override || '',
    });
  }, [student]);

  const set = (key) => (value) => setBody((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    const payload = {
      ...body,
      admission_year: body.admission_year || null,
      year: body.year || null,
    };

    setSaving(true);
    const res = student
      ? await apiUgStudentUpdate(student.id, payload)
      : await apiUgStudentCreate(payload);
    setSaving(false);
    if (!res.success) return;

    toast.success(student
      ? 'Student updated'
      : 'Student added. They have been emailed a link to set their password.');
    onSaved();
    onClose();
  };

  return (
    <div>
      <GridContainer
        elements={[
          <InputField label="First Name" initialValue={body.first_name} onChange={set('first_name')} required />,
          <InputField label="Last Name" initialValue={body.last_name} onChange={set('last_name')} />,
          <InputField label="Institute Email" type="email" initialValue={body.email} onChange={set('email')} required />,
          <InputField label="Roll Number" initialValue={body.roll_no} onChange={set('roll_no')} required />,
          <DropdownField label="Branch" options={branches} initialValue={body.branch_id} onChange={set('branch_id')} required />,
          <InputField label="Phone Number" initialValue={body.phone} onChange={set('phone')} />,
          <DropdownField label="Gender" options={GENDERS} initialValue={body.gender} onChange={set('gender')} />,
          <InputField
            label="Year of Admission"
            type="number"
            hint="Blank reads it from the roll number, like 2023 from be23."
            initialValue={body.admission_year}
            onChange={set('admission_year')}
          />,
          <DropdownField
            label="Year of Study (blank counts from admission)"
            options={[{ title: 'Counted from admission', value: '' }, ...YEARS]}
            initialValue={body.year}
            onChange={set('year')}
          />,
        ]}
      />

      <GridContainer
        elements={[
          <CustomButton
            text={saving ? 'Saving…' : (student ? 'Save changes' : 'Add student')}
            onClick={save}
            disabled={saving}
          />,
        ]}
      />
    </div>
  );
};

export default UgStudentForm;

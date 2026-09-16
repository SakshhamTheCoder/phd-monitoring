import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import CustomModal from '../forms/modal/CustomModal';
import GridContainer from '../forms/fields/GridContainer';
import InputField from '../forms/fields/InputField';
import DropdownField from '../forms/fields/DropdownField';
import CustomButton from '../forms/fields/CustomButton';
import { apiUrfBranches, apiUrfUpdateMine } from '../../api/urf';
import { yearLabel } from './UrfRecord';
import { signedInUser } from './UrfForms';

const YEARS = [1, 2, 3, 4].map((year) => ({ title: yearLabel(year), value: year }));

/**
 * What a UG student can correct about themselves, until their first
 * application. After that the details are part of a record the admin reads, so
 * the office makes the change.
 */
const UgDetailsForm = ({ student, isOpen, onClose, onSaved }) => {
  const me = signedInUser();
  const [branches, setBranches] = useState([]);
  const [body, setBody] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiUrfBranches().then((res) => res.success && setBranches(
      res.response.map((branch) => ({ title: `${branch.programme} ${branch.name}`, value: branch.id })),
    ));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setBody({
      phone: me.phone || '',
      gender: me.gender || '',
      roll_no: student?.roll_no || '',
      branch_id: student?.branch_id || '',
      year: student?.year || '',
    });
  }, [isOpen, student]);

  const set = (key) => (value) => setBody((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    const res = await apiUrfUpdateMine(body);
    setSaving(false);
    if (!res.success) return;

    // The name and address on the account are shown from what was stored at
    // sign-in, so the two fields this changes are kept in step.
    localStorage.setItem('user', JSON.stringify({ ...me, phone: body.phone, gender: body.gender }));
    toast.success('Your details are saved');
    onSaved();
    onClose();
  };

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title="Edit your details" width="640px">
      <GridContainer
        elements={[
          <InputField label="Roll Number" initialValue={body.roll_no} onChange={set('roll_no')} required />,
          <DropdownField label="Branch" options={branches} initialValue={body.branch_id} onChange={set('branch_id')} required />,
          <InputField label="Phone Number" initialValue={body.phone} onChange={set('phone')} required />,
          <DropdownField
            label="Gender"
            options={[{ title: 'Male', value: 'Male' }, { title: 'Female', value: 'Female' }]}
            initialValue={body.gender}
            onChange={set('gender')}
            required
          />,
          <DropdownField
            label="Year of Study"
            options={YEARS}
            initialValue={body.year}
            onChange={set('year')}
            required
          />,
        ]}
      />
      <GridContainer elements={[<CustomButton text={saving ? 'Saving…' : 'Save details'} onClick={save} disabled={saving} />]} />
    </CustomModal>
  );
};

export default UgDetailsForm;

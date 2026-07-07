import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import InputField from '../../components/forms/fields/InputField';
import CustomButton from '../../components/forms/fields/CustomButton';
import GridContainer from '../../components/forms/fields/GridContainer';

const AddDepartmentForm = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !code.trim()) {
      toast.error('Please fill in both Department Name and Code');
      return;
    }

    setSubmitting(true);
    const result = await customFetch(
      `${baseURL}/departments/add`,
      'POST',
      { name: name.trim(), code: code.trim() },
      false
    );
    setSubmitting(false);

    if (result.success) {
      toast.success(result.response?.message || 'Department added successfully');
      if (onCreated) onCreated();
    } else {
      toast.error(result.response?.message || 'Failed to add department');
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Add Department</h2>

      <GridContainer
        elements={[
          <InputField
            label="Department Name"
            required
            initialValue={name}
            onChange={setName}
            placeholder="Enter department name..."
          />,
          <InputField
            label="Department Code"
            required
            initialValue={code}
            onChange={setCode}
            placeholder="Enter department code..."
          />,
        ]}
        space={2}
      />

      <div
        style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'flex-end',
          marginTop: '1.5rem',
        }}
      >
        <CustomButton
          text="Cancel"
          variant="secondary"
          onClick={onClose}
          disabled={submitting}
        />
        <CustomButton
          text={submitting ? 'Adding...' : 'Add Department'}
          onClick={handleSubmit}
          disabled={submitting}
        />
      </div>
    </div>
  );
};

export default AddDepartmentForm;

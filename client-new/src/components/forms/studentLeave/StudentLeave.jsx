import React from 'react';
import FormTitleBar from '../formTitleBar/FormTitleBar';
import Recommendation from '../layouts/Recommendation';
import Student from './roles/Student';

const StudentLeave = ({ formData }) => (
  <>
    <FormTitleBar formName="Leave Application" formData={formData} />
    <div className="form-container">
      <Student formData={formData} />
      <Recommendation formData={formData} role="hod" allowRejection={true} />
    </div>
  </>
);

export default StudentLeave;

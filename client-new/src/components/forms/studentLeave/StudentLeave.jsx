import React from 'react';
import FormTitleBar from '../formTitleBar/FormTitleBar';
import Recommendation from '../layouts/Recommendation';
import Student from './roles/Student';

// submitPath is optional: pages that embed this form at its normal route
// (/forms/student-leave/:id) need not pass it, but a page like
// HodAttendancePage that renders it elsewhere (/attendance) must, so
// Recommendation's Submit button posts to the right form endpoint.
const StudentLeave = ({ formData, submitPath }) => (
  <>
    <FormTitleBar formName="Leave Application" formData={formData} />
    <div className="form-container">
      <Student formData={formData} />
      <Recommendation formData={formData} role="hod" allowRejection={true} submitPath={submitPath} />
    </div>
  </>
);

export default StudentLeave;

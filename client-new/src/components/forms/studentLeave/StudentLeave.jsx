import React from 'react';
import FormTitleBar from '../formTitleBar/FormTitleBar';
import Recommendation from '../layouts/Recommendation';
import Student from './roles/Student';
import { badgeClass } from '../../../data/badges';
import './StudentLeave.css';

// submitPath is optional: pages that embed this form at its normal route
// (/forms/student-leave/:id) need not pass it, but a page like
// HodAttendancePage that renders it elsewhere (/attendance) must, so
// Recommendation's Submit button posts to the right form endpoint.
const StudentLeave = ({ formData, submitPath }) => {
  // The scholar has no decision to make on their own application, so they get
  // the outcome rather than a locked set of radio buttons. Every other role
  // reaching this form is the HOD, whose decision it is.
  const isStudent = localStorage.getItem('userRole') === 'student';

  return (
    <div className="student-leave">
      <FormTitleBar formName="Leave Application" formData={formData} />
      <div className="form-container">
        <Student formData={formData} />

        {isStudent ? (
          <div className="leave-outcome">
            <div className="leave-outcome__row">
              <span>Status</span>
              <span className={badgeClass(formData.status)}>{formData.status}</span>
            </div>
            <div className="leave-outcome__row">
              <span>HOD remarks</span>
              <span>{formData.comments?.hod || '—'}</span>
            </div>
          </div>
        ) : (
          <Recommendation
            formData={formData}
            role="hod"
            allowRejection={true}
            submitPath={submitPath}
            decision
            title="Decision:"
          />
        )}
      </div>
    </div>
  );
};

export default StudentLeave;

import React, { useEffect, useState } from 'react';
import FormTitleBar from '../formTitleBar/FormTitleBar';
import Recommendation from '../layouts/Recommendation';
import Student from './roles/Student';
import { badgeClass } from '../../../data/badges';
import './StudentLeave.css';
import { currentRole } from '../../../auth/access';

// submitPath is optional: pages that embed this form at its normal route
// (/forms/student-leave/:id) need not pass it, but a page like
// HodAttendancePage that renders it elsewhere (/attendance) must, so
// Recommendation's Submit button posts to the right form endpoint.
const StudentLeave = ({ formData, submitPath }) => {
  // The scholar has no decision to make on their own application, so they get
  // the outcome rather than a locked set of radio buttons. Everyone else sees
  // the HOD's decision: live for the HOD, and locked by Recommendation for an
  // admin reading along, since the viewer is not the role being asked.
  const isStudent = currentRole() === 'student';
  // The application as last loaded. After the scholar submits, the form below
  // reloads it, and the status shown here has to follow rather than keep the
  // one the page opened with.
  const [current, setCurrent] = useState(formData);
  useEffect(() => setCurrent(formData), [formData]);

  return (
    <div className="student-leave">
      <FormTitleBar formName="Leave Application" formData={current} />
      <div className="form-container">
        <Student formData={formData} onReload={setCurrent} />

        {isStudent ? (
          <div className="leave-outcome">
            <div className="leave-outcome__row">
              <span>Status</span>
              <span className={badgeClass(current.status)}>{current.status}</span>
            </div>
            <div className="leave-outcome__row">
              <span>HOD remarks</span>
              <span>{current.comments?.hod || '—'}</span>
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

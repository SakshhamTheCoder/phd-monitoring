import React, { useEffect, useState } from 'react';
import FormTitleBar from '../formTitleBar/FormTitleBar';
import ServerPanel from '../serverForm/ServerPanel';
import { PanelSection } from '../../panel/Panel';
import './StudentLeave.css';

// A leave application, drawn from the sections the server describes
// (StudentLeaveDefinition): the scholar's application, then the HOD's
// decision on it.
//
// submitPath is optional: pages that embed this form at its normal route
// (/forms/student-leave/:id) need not pass it, but a page like
// HodAttendancePage that renders it elsewhere (/attendance) must, so the
// HOD's Submit posts to the right form endpoint.
const StudentLeave = ({ formData, submitPath, onDraftDeleted }) => {
  // The application as last loaded. After the scholar submits, the form below
  // reloads it, and the status shown here has to follow rather than keep the
  // one the page opened with.
  const [current, setCurrent] = useState(formData);
  useEffect(() => setCurrent(formData), [formData]);

  const [application] = formData.view.sections;
  const decision = current.view.sections[1];

  return (
    <div className="student-leave">
      <FormTitleBar formName={formData.view.title} formData={current} />
      <div className="form-container">
        <PanelSection title={application.title} className="form-step">
          <ServerPanel formData={formData} rows={application.rows} host={{ onReload: setCurrent, onDraftDeleted }} />
        </PanelSection>
        <PanelSection title={decision.title} className="form-step">
          <ServerPanel key={current.status} formData={formData} rows={decision.rows} wrapped={false} host={{ submitPath }} />
        </PanelSection>
      </div>
    </div>
  );
};

export default StudentLeave;

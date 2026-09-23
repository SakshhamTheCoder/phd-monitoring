import React from 'react';
import GridContainer from '../forms/fields/GridContainer';
import InputField from '../forms/fields/InputField';
import ShowPublications from '../publications/ShowPublications';
import FileLink from '../common/FileLink';
import { formatDate, EMPTY_VALUE } from '../../utils/timeParse';
import { TeamTables, OtherProjects, REPORT_TYPES, facultyName } from './UrfRecord';
import './UrfForms.css';

/**
 * What the student filled in, locked, as the student panel of a PhD form shows
 * it. One panel per form type, since the four URF forms ask for different
 * things; everything after it on the page is the approval chain.
 */

const Locked = ({ fields }) => (
  <GridContainer
    elements={fields.map(([label, value]) => (
      <InputField label={label} initialValue={value ?? ''} isLocked />
    ))}
  />
);

const Application = ({ formData }) => {
  const application = formData.application || {};
  const mentors = [application.mentor1, application.mentor2].filter(Boolean);

  return (
    <>
      <GridContainer
        elements={[<InputField label="Title of Project" initialValue={application.project_title || ''} isLocked />]}
        space={3}
      />
      <TeamTables record={application} />
      <OtherProjects record={application} />
      <GridContainer
        label="Project Proposal"
        elements={[application.proposal
          ? <FileLink value={application.proposal} label="View Proposal" />
          : <p>{EMPTY_VALUE}</p>]}
        space={3}
      />
      {/* The mentors are in the table above; this is who the chain starts with. */}
      <Locked fields={[
        ['Session', application.session ? `URF ${application.session}` : ''],
        ['Applied On', formatDate(application.created_at)],
        ['Faculty Mentors', mentors.map(facultyName).join(', ')],
      ]} />
    </>
  );
};

const AdditionalInfo = ({ formData }) => {
  const filled = formData.filled || {};

  return (
    <Locked fields={[
      ['Submitted By', filled.submitted_by],
      ['Full Name (as per PAN Card)', filled.full_name],
      ['Date of Birth', formatDate(filled.dob)],
      ['Gender', filled.gender],
      ["Father's Name", filled.father_name],
      ['PAN Card Number', filled.pan],
      ['Aadhaar Card Number', filled.aadhaar],
      ['Bank Name', filled.bank_name],
      ['Bank Account Number', filled.account_no],
      ['IFSC Code', filled.ifsc],
    ]} />
  );
};

const Report = ({ formData }) => {
  const filled = formData.filled || {};
  const application = formData.application || {};
  const mentors = [application.mentor1, application.mentor2].filter(Boolean);

  return (
    <>
      <GridContainer
        elements={[<InputField label="Title of Project" initialValue={application.project_title || ''} isLocked />]}
        space={3}
      />
      <Locked fields={[
        ['Submitted By', filled.submitted_by],
        ['Faculty Mentor Name', mentors.map(facultyName).join(', ')],
        ['Faculty Mentor Department', mentors.map((mentor) => mentor.department?.name).filter(Boolean).join(', ')],
        ['Conference Presentation', filled.conference_presentation],
        ['Submitted On', formatDate(filled.created_at)],
      ]} />
      <GridContainer
        label={REPORT_TYPES[filled.type] || 'Report'}
        elements={[filled.report ? <FileLink value={filled.report} label="View Report" /> : <p>{EMPTY_VALUE}</p>]}
        space={3}
      />
      <GridContainer
        label="Publications"
        elements={[
          <ShowPublications
            formData={filled.publications}
            enableEdit={false}
            highlightNames={[application.student1_name, application.student2_name].filter(Boolean)}
          />,
        ]}
        space={3}
      />
    </>
  );
};

const PANELS = {
  'urf-application': Application,
  'urf-additional-info': AdditionalInfo,
  'urf-half-yearly-report': Report,
  'urf-final-report': Report,
};

const UrfFilled = ({ formData }) => {
  const Panel = PANELS[formData.form];

  return Panel ? <Panel formData={formData} /> : null;
};

export default UrfFilled;

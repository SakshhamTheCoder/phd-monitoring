import React from 'react';
import InfoGrid from '../profileFields/InfoGrid';
import TableComponent from '../forms/table/TableComponent';
import FileLink from '../common/FileLink';
import ShowPublications from '../publications/ShowPublications';
import { badgeClass } from '../../data/badges';
import { formatDate } from '../../utils/timeParse';

export const URF_STATUSES = ['applied', 'selected', 'ongoing', 'completed', 'rejected'];
const REPORT_TYPES = { half_yearly: 'Half-yearly Progress Report', final: 'Final Report' };

export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
export const facultyName = (faculty) => [faculty?.user?.first_name, faculty?.user?.last_name].filter(Boolean).join(' ');

export const Section = ({ title, children }) => (
  <div className="grid-container-wrapper">
    <div className="grid-label">{title}</div>
    {children}
  </div>
);

/**
 * Everything recorded against one URF project, stage by stage. The admin and
 * the students on the project read the same page; the server leaves out the
 * stipend details a student is not entitled to see. `summary` stops at the
 * project, team and mentors, for the student's profile.
 */
const UrfRecord = ({ record, summary = false }) => {
  const status = capitalize(record.status);

  return (
    <>
      <Section title="Project">
        <InfoGrid rows={[
          { label: 'Project Title', value: record.project_title, span: 'all' },
          { label: 'Status', node: <span className={badgeClass(status)}>{status}</span> },
          { label: 'Applied On', value: formatDate(record.created_at) },
          { label: 'Proposal', node: <FileLink value={record.proposal} /> },
        ]} />
      </Section>

      {[1, 2].filter((n) => record[`student${n}_name`]).map((n) => (
        <Section key={n} title={n === 1 ? 'First Student' : 'Second Student'}>
          <InfoGrid rows={[
            { label: 'Name', value: record[`student${n}_name`] },
            { label: 'Roll Number', value: record[`student${n}_roll_no`] },
            { label: 'Department', value: record[`student${n}_department`]?.name },
            { label: 'Gender', value: record[`student${n}_gender`] },
            { label: 'Official Email', value: record[`student${n}_email`] },
            { label: 'Phone Number', value: record[`student${n}_phone`] },
          ]} />
        </Section>
      ))}

      {[record.mentor1, record.mentor2].filter(Boolean).map((mentor, i) => (
        <Section key={mentor.faculty_code} title={i === 0 ? 'First Mentor' : 'Second Mentor'}>
          <InfoGrid rows={[
            { label: 'Name', value: facultyName(mentor) },
            { label: 'Email', value: mentor.user?.email },
            { label: 'Designation', value: mentor.designation },
            { label: 'Department', value: mentor.department?.name },
          ]} />
        </Section>
      ))}

      {!summary && record.fellows?.map((fellow) => (
        <Section key={fellow.id} title={`Fellowship Details: ${fellow.full_name}`}>
          <InfoGrid rows={[
            { label: 'Full Name (as per PAN)', value: fellow.full_name },
            { label: 'Date of Birth', value: formatDate(fellow.dob) },
            { label: 'Gender', value: fellow.gender },
            { label: "Father's Name", value: fellow.father_name },
            { label: 'PAN', value: fellow.pan },
            { label: 'Aadhaar', value: fellow.aadhaar },
            { label: 'Bank Name', value: fellow.bank_name },
            { label: 'Account Number', value: fellow.account_no },
            { label: 'IFSC Code', value: fellow.ifsc },
          ]} />
        </Section>
      ))}

      {!summary && record.reports?.length > 0 && (
        <Section title="Reports">
          <TableComponent
            data={record.reports}
            keys={['type', 'conference_presentation', 'created_at', 'report']}
            titles={['Type', 'Conference Presentation', 'Submitted On', 'Report']}
            components={[
              { key: 'type', component: ({ data }) => REPORT_TYPES[data] || data },
              { key: 'created_at', component: ({ data }) => formatDate(data) },
            ]}
          />
        </Section>
      )}

      {!summary && (
        <Section title="Publications">
          <ShowPublications formData={record.publications} enableEdit={false} />
        </Section>
      )}
    </>
  );
};

export default UrfRecord;

import React from 'react';
import '../profileCard/ProfileCard.css';
import InfoGrid from '../profileFields/InfoGrid';
import GridContainer from '../forms/fields/GridContainer';
import TableComponent from '../forms/table/TableComponent';
import CustomButton from '../forms/fields/CustomButton';
import ShowPublications from '../publications/ShowPublications';
import { facultyNameCell } from '../facultyLink/FacultyLink';
import { fileUrlFrom } from '../common/FileLink';
import { badgeClass } from '../../data/badges';
import { EMPTY_VALUE, formatDate } from '../../utils/timeParse';

export const URF_STATUSES = ['applied', 'selected', 'ongoing', 'completed', 'rejected'];
const REPORT_TYPES = { half_yearly: 'Half-yearly Progress Report', final: 'Final Report' };

export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
export const facultyName = (faculty) => [faculty?.user?.first_name, faculty?.user?.last_name].filter(Boolean).join(' ');

// A labelled block, used by the URF forms.
export const Section = ({ title, children }) => (
  <div className="grid-container-wrapper">
    <div className="grid-label">{title}</div>
    {children}
  </div>
);

export const StatusBadge =({ status }) => <span className={badgeClass(capitalize(status))}>{capitalize(status)}</span>;

// One "Label: value" line under a profile's name, as the PhD profile writes them.
export const HeaderLine = ({ label, children, title = false }) => (
  <p className={title ? 'student-research-title' : undefined}>
    <span className="student-research-label">{label}:</span>{' '}
    {children ?? <span className="student-value-empty">{EMPTY_VALUE}</span>}
  </p>
);

/** The students and faculty mentors on a project, listed the way a PhD profile lists supervisors. */
export const TeamTables = ({ record }) => {
  const students = [1, 2].filter((n) => record[`student${n}_name`]).map((n) => ({
    name: record[`student${n}_name`],
    roll_no: record[`student${n}_roll_no`],
    department: record[`student${n}_department`]?.name || EMPTY_VALUE,
    gender: record[`student${n}_gender`],
    email: record[`student${n}_email`],
    phone: record[`student${n}_phone`],
  }));
  const mentors = [record.mentor1, record.mentor2].filter(Boolean).map((mentor) => ({
    faculty_code: mentor.faculty_code,
    name: facultyName(mentor),
    email: mentor.user?.email,
    designation: mentor.designation,
    department: mentor.department?.name || EMPTY_VALUE,
  }));

  return (
    <>
      <GridContainer
        label="Team Members"
        elements={[
          <TableComponent
            data={students}
            keys={['name', 'roll_no', 'department', 'gender', 'email', 'phone']}
            titles={['Name', 'Roll Number', 'Department', 'Gender', 'Official Email', 'Phone']}
          />,
        ]}
        space={3}
      />
      <GridContainer
        label="Faculty Mentors"
        elements={[
          <TableComponent
            data={mentors}
            keys={['name', 'email', 'designation', 'department']}
            titles={['Name', 'Email', 'Designation', 'Department']}
            components={[facultyNameCell]}
          />,
        ]}
        space={3}
      />
    </>
  );
};

/**
 * One URF project as a profile card, laid out like the PhD student profile:
 * the title and its status beside the actions, then the team, stipend details,
 * reports and publications. The server leaves out stipend details a student is
 * not entitled to see.
 */
const UrfRecord = ({ record, actions = null }) => {
  const reportsDue = record.reports?.length > 0 || ['ongoing', 'completed'].includes(record.status);

  return (
    <div className="student-container">
      <div className="student-header">
        <div className="student-header-text">
          <h2>{record.project_title}</h2>
          <div className="student-research">
            <HeaderLine label="Status" title><StatusBadge status={record.status} /></HeaderLine>
            <HeaderLine label="Applied On">{formatDate(record.created_at)}</HeaderLine>
          </div>
        </div>
        <div className="profile-actions">
          {record.proposal && (
            <CustomButton
              text="View Proposal"
              variant="secondary"
              onClick={() => window.open(fileUrlFrom(record.proposal), '_blank', 'noopener,noreferrer')}
            />
          )}
          {actions}
        </div>
      </div>

      <TeamTables record={record} />

      {record.fellows?.length > 0 && (
        <GridContainer
          label="Fellowship Details"
          elements={[
            <div>
              {record.fellows.map((fellow) => (
                <div key={fellow.id} className="student-details">
                  <InfoGrid className="student-info-grid" rows={[
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
                </div>
              ))}
            </div>,
          ]}
          space={3}
        />
      )}

      {reportsDue && (
        <GridContainer
          label="Reports"
          elements={[
            <TableComponent
              data={record.reports}
              keys={['type', 'conference_presentation', 'created_at', 'report']}
              titles={['Type', 'Conference Presentation', 'Submitted On', 'Report']}
              components={[
                { key: 'type', component: ({ data }) => REPORT_TYPES[data] || data },
                { key: 'conference_presentation', component: ({ data }) => data || EMPTY_VALUE },
                { key: 'created_at', component: ({ data }) => formatDate(data) },
              ]}
            />,
          ]}
          space={3}
        />
      )}

      <GridContainer
        label="Publications"
        elements={[<ShowPublications formData={record.publications} enableEdit={false} />]}
        space={3}
      />
    </div>
  );
};

export default UrfRecord;

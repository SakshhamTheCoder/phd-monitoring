import React from 'react';
import '../profileCard/ProfileCard.css';
import InfoGrid from '../profileFields/InfoGrid';
import GridContainer from '../forms/fields/GridContainer';
import TableComponent from '../forms/table/TableComponent';
import ShowPublications from '../publications/ShowPublications';
import { facultyNameCell } from '../facultyLink/FacultyLink';
import { fileUrlFrom } from '../common/FileLink';
import { badgeClass } from '../../data/badges';
import { EMPTY_VALUE, formatDate } from '../../utils/timeParse';

export const URF_STATUSES = ['applied', 'selected', 'rejected'];
export const REPORT_TYPES = { half_yearly: 'Half-yearly Progress Report', final: 'Final Report' };

export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
export const facultyName = (faculty) => [faculty?.user?.first_name, faculty?.user?.last_name].filter(Boolean).join(' ');
// "3rd Year" for 3, as the server names it.
export const yearLabel = (year) => (year ? `${year}${['', 'st', 'nd', 'rd'][year] || 'th'} Year` : EMPTY_VALUE);

// A labelled block, used by the URF forms.
export const Section = ({ title, children }) => (
  <div className="grid-container-wrapper">
    <div className="grid-label">{title}</div>
    {children}
  </div>
);

export const StatusBadge = ({ status }) => <span className={badgeClass(capitalize(status))}>{capitalize(status)}</span>;

// One "Label: value" line under a profile's name, as the PhD profile writes them.
export const HeaderLine = ({ label, children, title = false }) => (
  <p className={title ? 'student-research-title' : undefined}>
    <span className="student-research-label">{label}:</span>{' '}
    {children ?? <span className="student-value-empty">{EMPTY_VALUE}</span>}
  </p>
);

/** Half-yearly and final reports, in the order they were filed. */
export const ReportsTable = ({ reports }) => (
  <TableComponent
    data={reports}
    keys={['type', 'conference_presentation', 'created_at', 'report']}
    titles={['Type', 'Conference Presentation', 'Submitted On', 'Report']}
    components={[
      { key: 'type', component: ({ data }) => REPORT_TYPES[data] || data },
      { key: 'conference_presentation', component: ({ data }) => data || EMPTY_VALUE },
      { key: 'created_at', component: ({ data }) => formatDate(data) },
    ]}
  />
);

/** The students and faculty mentors on a project, listed the way a PhD profile lists supervisors. */
export const TeamTables = ({ record }) => {
  const students = [1, 2].filter((n) => record[`student${n}_name`]).map((n) => ({
    name: record[`student${n}_name`],
    roll_no: record[`student${n}_roll_no`],
    department: record[`student${n}_department`]?.name || EMPTY_VALUE,
    year: yearLabel(record[`student${n}_year`]),
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
            keys={['name', 'roll_no', 'department', 'year', 'gender', 'email', 'phone']}
            titles={['Name', 'Roll Number', 'Branch', 'Year', 'Gender', 'Official Email', 'Phone']}
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

const hasPublications = (groups) => Object.values(groups || {}).some((rows) => rows?.length > 0);

/**
 * One URF project as a profile card, laid out like the PhD student profile:
 * the title and its status beside the actions, then the team, stipend details
 * and reports, each report with the publications linked to it. The server
 * leaves out stipend details a student is not entitled to see.
 */
const UrfRecord = ({ record, actions = null }) => {
  const reportsDue = record.reports?.length > 0 || record.status === 'selected';

  return (
    <div className="student-container">
      <div className="student-header">
        <div className="student-header-text">
          <h2>{record.project_title}</h2>
          <div className="student-research">
            <HeaderLine label="Status" title><StatusBadge status={record.status} /></HeaderLine>
            <HeaderLine label="Applied On">{formatDate(record.created_at)}</HeaderLine>
            {/* Beside the facts, not with the decisions, so it never reads as one of them. */}
            <HeaderLine label="Proposal">
              {record.proposal && (
                <button
                  type="button"
                  className="profile-edit-small"
                  onClick={() => window.open(fileUrlFrom(record.proposal), '_blank', 'noopener,noreferrer')}
                >
                  <i className="fa fa-file-pdf-o" aria-hidden="true"></i> View Proposal
                </button>
              )}
            </HeaderLine>
          </div>
        </div>
        {actions && <div className="profile-actions">{actions}</div>}
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
        <GridContainer label="Reports" elements={[<ReportsTable reports={record.reports} />]} space={3} />
      )}

      {record.reports?.filter((report) => hasPublications(report.publications)).map((report) => (
        <GridContainer
          key={report.id}
          label={`Publications in ${REPORT_TYPES[report.type] || 'Report'} (${formatDate(report.created_at)})`}
          elements={[
            <ShowPublications
              formData={report.publications}
              enableEdit={false}
              highlightNames={[record.student1_name, record.student2_name].filter(Boolean)}
            />,
          ]}
          space={3}
        />
      ))}
    </div>
  );
};

export default UrfRecord;

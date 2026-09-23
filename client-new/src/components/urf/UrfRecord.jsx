import React from 'react';
import '../profileCard/ProfileCard.css';
import GridContainer from '../forms/fields/GridContainer';
import TableComponent from '../forms/table/TableComponent';
import { facultyNameCell } from '../facultyLink/FacultyLink';
import { openStoredFile } from '../../api/fileAccess';
import { EMPTY_VALUE, formatDate } from '../../utils/timeParse';
import { stageLine } from './UrfApproval';
import FormGrid from '../forms/formGrid/FormGrid';
import Page from '../page/Page';
import Panel from '../panel/Panel';
import CustomButton from '../forms/fields/CustomButton';

export const URF_STATUSES = ['applied', 'selected', 'rejected'];
export const REPORT_TYPES = { half_yearly: 'Half-yearly Progress Report', final: 'Final Report' };

export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
export const facultyName = (faculty) => [faculty?.user?.first_name, faculty?.user?.last_name].filter(Boolean).join(' ');
// "3rd Year" for 3, as the server names it.
export const yearLabel = (year) => (year ? `${year}${['', 'st', 'nd', 'rd'][year] || 'th'} Year` : EMPTY_VALUE);

// A URF form's panel. Its children are PanelSections.
export const Section = ({ title, children }) => <Panel title={title}>{children}</Panel>;

// Plain text, as statuses read elsewhere in the portal.
export const StatusText = ({ status }) => <span>{capitalize(status)}</span>;

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
    branch: record[`student${n}_branch`]?.name || EMPTY_VALUE,
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
        label="Team members"
        elements={[
          <TableComponent
            data={students}
            keys={['name', 'roll_no', 'branch', 'year', 'gender', 'email', 'phone']}
            titles={['Name', 'Roll number', 'Branch', 'Year', 'Gender', 'Official email', 'Phone']}
          />,
        ]}
        space={3}
      />
      <GridContainer
        label="Faculty mentors"
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

// The kinds of publication the portal records. It has no Scopus flag, so a
// reviewer reads eligibility from these.
const PUBLICATION_KINDS = {
  'journal:sci': 'SCI journal',
  'journal:non-sci': 'Non-SCI journal',
  'conference:international': 'International conference',
  'conference:national': 'National conference',
};
const publicationSummary = (counts) => {
  const parts = Object.entries(counts || {}).map(([kind, n]) => `${n} ${PUBLICATION_KINDS[kind] || (kind.startsWith('book') ? 'Book' : kind)}`);
  return parts.length ? parts.join(', ') : 'None linked';
};
const FINAL_REPORT = { approved: 'Approved', filed: 'Filed, in review' };

/**
 * Each student's other URF projects and what came of them, so a reviewer can
 * weigh eligibility: a student who finished a fellowship without publishing
 * may not be eligible again. Only reviewers receive this; students do not.
 */
export const OtherProjects = ({ record }) => {
  if (!record.other_projects) return null;

  const rows = record.other_projects.flatMap(({ student, projects }) => (projects.length
    ? projects.map((project) => ({
      student,
      session: `URF ${project.session}`,
      project_title: project.project_title,
      status: capitalize(project.status),
      final_report: FINAL_REPORT[project.final_report] || 'Not filed',
      publications: publicationSummary(project.publications),
    }))
    : [{ student, session: EMPTY_VALUE, project_title: 'No other URF project', status: EMPTY_VALUE, final_report: EMPTY_VALUE, publications: EMPTY_VALUE }]));

  return (
    <GridContainer
      label="Eligibility: other URF projects"
      elements={[
        <TableComponent
          data={rows}
          keys={['student', 'session', 'project_title', 'status', 'final_report', 'publications']}
          titles={['Student', 'Session', 'Project', 'Status', 'Final report', 'Publications']}
        />,
      ]}
      space={3}
    />
  );
};

/**
 * The project's forms, each opening its own page. The project page holds the
 * project; what a form asked, and what each step of the chain said about it,
 * belongs to that form.
 *
 * Offered on the URF pages, which a student has no route to. Their own forms
 * are on /forms, where they can still be filled in.
 */
const UrfForms = ({ record }) => {
  const forms = [
    {
      form_type: 'urf-application',
      form_name: 'URF Application Form',
      path: `/urf/urf-application/${record.id}`,
      action_required: record.awaiting_me,
    },
    // A fellow row a reader is not entitled to is left out of the payload, so
    // the card for it is not offered either.
    ...(record.fellows || []).map((fellow) => ({
      form_type: 'urf-additional-info',
      form_name: 'Additional Information Form',
      path: `/urf/urf-additional-info/${fellow.id}`,
      action_required: fellow.awaiting_me,
    })),
    ...(record.reports || []).map((report) => ({
      form_type: report.type === 'final' ? 'urf-final-report' : 'urf-half-yearly-report',
      form_name: REPORT_TYPES[report.type] || 'Report',
      path: `/urf/${report.type === 'final' ? 'urf-final-report' : 'urf-half-yearly-report'}/${report.id}`,
      action_required: report.awaiting_me,
    })),
  ];

  return <FormGrid forms={forms} title="Forms" />;
};

/**
 * The project, and one card per form it holds. What each form contains is on
 * that form's own page: the stipend details are masked there for an approver
 * and whole for the office, and a report carries its file and its publications
 * there. Rendering all three here put nine identity and bank fields on a page
 * every mentor opens, and left the reader scrolling past them to find out
 * whether a report was in.
 */
const UrfRecord = ({ record, actions = null }) => {
  const facts = [
    ['Status', <StatusText status={record.status} />],
    ['Session', record.session && `URF ${record.session}`],
    ['Applied on', formatDate(record.applied_on)],
    ['Approval', stageLine(record)],
    // Beside the facts, not with the decisions, so it never reads as one of them.
    ['Proposal', record.proposal && (
      <CustomButton
        text="View proposal"
        variant="secondary"
        size="sm"
        onClick={() => openStoredFile(record.proposal)}
      />
    )],
  ];

  return (
    <Page title={record.project_title} actions={actions}>
      <Panel title="Project">
        <dl className="facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || EMPTY_VALUE}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <UrfForms record={record} />

      <Panel>
        <TeamTables record={record} />
        <OtherProjects record={record} />
      </Panel>
    </Page>
  );
};

export default UrfRecord;

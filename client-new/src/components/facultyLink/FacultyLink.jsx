import React from 'react';
import { Link } from 'react-router-dom';
import { useFeatures } from '../../context/FeaturesContext';
import './FacultyLink.css';

// A faculty member's name, linked to their research profile when we know their
// code. External collaborators have no code and no profile, so they render as
// plain text rather than a link that goes nowhere. The same applies when the
// research profile is switched off.
const FacultyLink = ({ code, name, className = '' }) => {
  const { research_profile: researchProfile } = useFeatures();
  if (!name) return null;
  if (!code || !researchProfile) return <span className={className}>{name}</span>;
  return (
    <Link to={`/faculty/${code}/profile`} className={`faculty-link ${className}`.trim()}>
      {name}
    </Link>
  );
};

// Drop-in cell for TableComponent: components={[facultyNameCell]}. The row
// needs a faculty_code; without one the name renders as plain text.
export const facultyNameCell = {
  key: 'name',
  component: ({ row }) => <FacultyLink code={row.faculty_code} name={row.name} />,
};

export default FacultyLink;

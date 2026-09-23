import React from 'react';
import './NewUserKindPicker.css';
import CustomButton from '../forms/fields/CustomButton';

/**
 * Asks what kind of user is being created before any record is written.
 *
 * Creating a bare User and granting it a role produces an account that cannot
 * be used: student and faculty roles need a Student/Faculty record, and the
 * plain user form never creates one. Routing to the existing Student and
 * Faculty forms, which create the User and its record together in one call -
 * means the common cases can no longer produce a locked-out account.
 */
const KINDS = [
  {
    key: 'student',
    icon: 'fa-graduation-cap',
    title: 'Student',
    description:
      'Creates the login and the student record together. Use for anyone enrolling in the PhD programme.',
  },
  {
    key: 'faculty',
    icon: 'fa-id-badge',
    title: 'Faculty',
    description:
      'Creates the login and the faculty record together, internal or external. HOD, PhD Coordinator and ADORDC are assigned later from the Departments page.',
  },
  {
    key: 'clerk',
    icon: 'fa-id-card-o',
    title: 'Clerk',
    description:
      'Creates a login for marking PhD attendance. Departments are tagged afterwards from Clerk Management.',
  },
  {
    key: 'other',
    icon: 'fa-shield',
    title: 'Office or admin',
    description:
      'A login with no student or faculty record, for Admin, Director, DRA, DORDC or a UG Student on the URF. These roles need no linked record.',
  },
];

const NewUserKindPicker = ({ onSelect, onCancel }) => (
  <div className="kind-picker">
    <h3 className="kind-picker-title">What kind of user is this?</h3>
    <p className="kind-picker-intro">
      Picking the right kind creates the record the account needs, so the user isn't left with a
      role they can't use.
    </p>

    <div className="kind-picker-options">
      {KINDS.map((kind) => (
        <button
          key={kind.key}
          type="button"
          onClick={() => onSelect(kind.key)}
          className="kind-picker-option"
        >
          <i className={`fa ${kind.icon} kind-picker-icon`} aria-hidden="true" />
          <span>
            <span className="kind-picker-option-title">{kind.title}</span>
            <span className="kind-picker-option-text">
              {kind.description}
            </span>
          </span>
        </button>
      ))}
    </div>

    <div className="modal-actions">
      <CustomButton text="Cancel" variant="quiet" onClick={onCancel} />
    </div>
  </div>
);

export default NewUserKindPicker;

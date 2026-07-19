import React from 'react';

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
    icon: 'fa-user-graduate',
    title: 'Student',
    description:
      'Creates the login and the student record together. Use for anyone enrolling in the PhD programme.',
  },
  {
    key: 'faculty',
    icon: 'fa-chalkboard-user',
    title: 'Faculty',
    description:
      'Creates the login and the faculty record together, internal or external. HOD, PhD Coordinator and ADORDC are assigned later from the Departments page.',
  },
  {
    key: 'other',
    icon: 'fa-user-shield',
    title: 'Office / Admin',
    description:
      'A login with no student or faculty record, for Admin, Director, DRA or DORDC. These roles need no linked record.',
  },
];

const NewUserKindPicker = ({ onSelect, onCancel }) => (
  <div style={{ padding: '1.5rem' }}>
    <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#111827' }}>What kind of user is this?</h3>
    <p style={{ marginTop: '0.4rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: '#6b7280' }}>
      Picking the right kind creates the record the account needs, so the user isn't left with a
      role they can't use.
    </p>

    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {KINDS.map((kind) => (
        <button
          key={kind.key}
          type="button"
          onClick={() => onSelect(kind.key)}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.9rem',
            width: '100%',
            textAlign: 'left',
            padding: '1rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            background: 'white',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary-color)';
            e.currentTarget.style.background = '#fdf6f6';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = '#d1d5db';
            e.currentTarget.style.background = 'white';
          }}
        >
          <i
            className={`fa-solid ${kind.icon}`}
            style={{
              fontSize: '1.1rem',
              color: 'var(--primary-color)',
              marginTop: '0.15rem',
              width: '1.4rem',
            }}
          />
          <span>
            <span style={{ display: 'block', fontWeight: 600, color: '#111827' }}>{kind.title}</span>
            <span style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginTop: '0.2rem' }}>
              {kind.description}
            </span>
          </span>
        </button>
      ))}
    </div>

    <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
      <button
        type="button"
        onClick={onCancel}
        style={{
          padding: '0.5rem 1rem',
          border: '1px solid #d1d5db',
          borderRadius: '0.375rem',
          background: 'white',
          cursor: 'pointer',
          fontSize: '0.875rem',
          color: '#374151',
        }}
      >
        Cancel
      </button>
    </div>
  </div>
);

export default NewUserKindPicker;

import React from 'react';
import SupervisorDoctoralManager from '../../supervisorDoctoralManager/SupervisorDoctoralManager';

/** A scholar's supervisors and doctoral committee, proposed for change. */
const SupervisorDoctoralBlock = ({ row, onClose }) => (
  <SupervisorDoctoralManager
    studentId={row?.roll_no}
    supervisors={row?.supervisors}
    doctoralCommittee={row?.doctoral}
    onClose={onClose}
  />
);

export default SupervisorDoctoralBlock;

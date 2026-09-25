import React from 'react';
import SupervisorDoctoralManager from '../../supervisorDoctoralManager/SupervisorDoctoralManager';

/**
 * A scholar's supervisors and doctoral committee, proposed for change. From
 * the profile it also sets the IRB outside expert, and the profile is read
 * again when it closes (props.reload_on_close).
 */
const SupervisorDoctoralBlock = ({ row, props = {}, onClose, onChanged }) => (
  <SupervisorDoctoralManager
    studentId={row?.roll_no}
    supervisors={row?.supervisors}
    doctoralCommittee={row?.doctoral}
    outsideExpert={props.outside_expert}
    canSetOutsideExpert={props.can_set_outside_expert}
    onOutsideExpertSaved={props.reload_on_close ? onChanged : undefined}
    onClose={() => {
      onClose();
      if (props.reload_on_close) onChanged();
    }}
  />
);

export default SupervisorDoctoralBlock;

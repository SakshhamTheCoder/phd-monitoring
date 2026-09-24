import React from 'react';
import BulkAllocateSupervisors from '../../bulkAllocateSupervisors/BulkAllocateSupervisors';

/** The PhD coordinator's allocation of supervisors to many scholars at once. */
const BulkAllocateBlock = ({ onClose, onChanged }) => (
  <BulkAllocateSupervisors
    onSuccess={() => {
      onClose();
      onChanged();
    }}
  />
);

export default BulkAllocateBlock;

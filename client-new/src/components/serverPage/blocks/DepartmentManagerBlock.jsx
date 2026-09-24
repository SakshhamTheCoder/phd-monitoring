import React, { useState } from 'react';
import DepartmentManager from '../../departmentManager/DepartmentManager';
import { apiDepartmentList } from '../../../api/lookups';

/**
 * The HoD, ADoRDC and coordinators of the department row it was opened on.
 * A change inside keeps it open, showing what the server now holds for that
 * department, and refreshes the table behind it; closing it after every change
 * meant reopening it for the next one.
 */
const DepartmentManagerBlock = ({ row, onClose, onChanged }) => {
  const [department, setDepartment] = useState(row);

  const refresh = async () => {
    onChanged();
    apiDepartmentList.invalidate();
    const res = await apiDepartmentList();
    const fresh = res.success ? (res.response?.data || []).find((d) => d.id === department?.id) : null;
    if (fresh) setDepartment((current) => (current?.id === fresh.id ? fresh : current));
  };

  return (
    <DepartmentManager
      departmentId={department.id}
      departmentName={department.name || department.department_name}
      hodEmail={department.hod_email}
      currentHod={department.hod}
      currentAdordc={department.adordc}
      currentCoordinators={department.phd_coordinators || []}
      onClose={onClose}
      onUpdate={refresh}
    />
  );
};

export default DepartmentManagerBlock;

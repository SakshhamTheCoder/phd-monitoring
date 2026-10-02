import { useEffect, useState } from 'react';
import { apiUgDepartmentOptions } from '../api/lookups';

/** The departments a UG student can be filed under, as a dropdown wants them. */
export const useUgDepartmentOptions = () => {
  const departments = useUgDepartments();

  return departments.map((department) => ({ title: department.name, value: department.id }));
};

/** The same list as the server sends it, for a page that formats it itself. */
export const useUgDepartments = () => {
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    let active = true;
    apiUgDepartmentOptions().then((res) => active && res.success && setDepartments(res.response));
    return () => { active = false; };
  }, []);

  return departments;
};

export default useUgDepartmentOptions;

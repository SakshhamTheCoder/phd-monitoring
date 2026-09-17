import { useEffect, useState } from 'react';
import { apiUrfBranches } from '../api/urf';

// Named with the programme, so the two Computer Science branches of different
// degrees are told apart.
const label = (branch) => `${branch.programme} ${branch.name}`;

/** The branch list, as a dropdown wants it. */
export const useBranchOptions = () => {
  const branches = useBranches();

  return branches.map((branch) => ({ title: label(branch), value: branch.id }));
};

/** The branch list as the server sends it, for a page that groups them itself. */
export const useBranches = () => {
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    apiUrfBranches().then((res) => res.success && setBranches(res.response));
  }, []);

  return branches;
};

export default useBranchOptions;

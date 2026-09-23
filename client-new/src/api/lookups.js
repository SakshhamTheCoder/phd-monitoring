// Option lists several pages ask for. Each is fetched once and the promise is
// shared, so concurrent callers make one request. A failed answer is dropped so
// the next caller asks again instead of inheriting the failure.
import { baseURL } from './urls';
import { customFetch } from './base';
import { apiUrfBranches } from './urf';

const sharedRequest = (load) => {
  let pending = null;
  const get = () => {
    if (!pending) {
      pending = load().then((res) => {
        if (!res.success) pending = null;
        return res;
      });
    }
    return pending;
  };
  // For whoever writes the list, so the next reader sees the change.
  get.invalidate = () => { pending = null; };
  return get;
};

// Every department, for pickers. Pages toast their own failure.
export const apiDepartmentList = sharedRequest(() =>
  customFetch(`${baseURL}/departments?rows=1000`, 'GET', {}, false));

export const apiRoleList = sharedRequest(() => customFetch(`${baseURL}/roles`, 'GET'));

export const apiBranchOptions = sharedRequest(apiUrfBranches);

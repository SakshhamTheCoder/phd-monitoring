import { toast } from 'react-toastify';
import { customFetch, NETWORK_ERROR_MESSAGE } from '../../api/base';
import { baseURL } from '../../api/urls';
import { fillFromRow } from '../../api/views';
import { apiDepartmentList } from '../../api/lookups';

// Lists the client keeps between pages, by the name a request says it changes.
const KEPT_LISTS = { departments: apiDepartmentList };

export const forgetKeptLists = (names = []) => names.forEach((name) => KEPT_LISTS[name]?.invalidate());

// Why a request a page view describes was refused. A refused save answers 422
// with a bare "Validation failed", so where the view asks for them the field
// errors beside it are what say which field to fix.
export const failureMessage = (result, request) => {
  if (request.failure === 'errors') {
    if (result.networkError) return NETWORK_ERROR_MESSAGE;
    const { errors, message } = result.response || {};
    return errors ? Object.values(errors).flat().join(' ') : message || request.failed;
  }
  return result.response?.message || request.failed;
};

// Sends a request a page view describes, on a row where it has one, and says
// how it went. Resolves true when it went through.
export const sendRequest = async (request, row, body, setLoading) => {
  if (request.confirm && !window.confirm(fillFromRow(request.confirm, row))) return false;

  // A request may keep the page's loader off, as a dialog that shows its own
  // busy button did, and may leave a refusal to the request itself to report.
  const loader = request.loader !== false;
  const reportsItself = request.failure === 'fetch';
  if (loader) setLoading(true);
  try {
    const result = await customFetch(baseURL + fillFromRow(request.path, row), request.method, body, reportsItself);
    if (result.success) {
      forgetKeptLists(request.invalidates);
      toast.success((request.done_from_answer && result.response?.message) || request.done);
      return true;
    }
    if (!reportsItself) toast.error(failureMessage(result, request));
    return false;
  } catch (error) {
    console.error(error);
    toast.error(request.failed);
    return false;
  } finally {
    if (loader) setLoading(false);
  }
};

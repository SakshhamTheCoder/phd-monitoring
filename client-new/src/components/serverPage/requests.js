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
// Uploads go as multipart, the answers beside them as fields: a null left
// out (FormData would send the text "null"), a yes or no as 1 or 0 (which
// Laravel's boolean rule takes), a list as key[] entries.
const asFormData = (body, files) => {
  const data = new FormData();
  Object.entries(body).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) value.forEach((item) => data.append(`${key}[]`, item));
    else if (typeof value === 'boolean') data.append(key, value ? '1' : '0');
    else data.append(key, value);
  });
  Object.entries(files).forEach(([key, file]) => data.append(key, file));
  return data;
};

export const sendRequest = async (request, row, body, setLoading, files = null) => {
  if (request.confirm && !window.confirm(fillFromRow(request.confirm, row))) return false;

  // A request may keep the page's loader off, as a dialog that shows its own
  // busy button did, and may leave a refusal to the request itself to report,
  // or have it reported and then say its own line as well ('both').
  const loader = request.loader !== false;
  const reportsItself = request.failure === 'fetch' || request.failure === 'both';
  if (loader) setLoading(true);
  try {
    const withFiles = files && Object.keys(files).length > 0;
    const result = await customFetch(
      baseURL + fillFromRow(request.path, row),
      request.method,
      withFiles ? asFormData(body, files) : body,
      reportsItself,
      withFiles,
    );
    if (result.success) {
      forgetKeptLists(request.invalidates);
      const answer = result.response || {};
      const says = (request.answer_says || []).find((said) => answer[said.key]);
      // A request with nothing to say (done null) says nothing.
      const done = says ? fillFromRow(says.text, answer) : (request.done_from_answer && answer.message) || request.done;
      if (done) toast.success(done);
      (request.warnings_from ? answer[request.warnings_from] || [] : []).forEach((warning) => toast.warn(warning, { autoClose: 10000 }));
      return true;
    }
    if (!reportsItself) toast.error(failureMessage(result, request));
    if (request.failure === 'both') toast.error(request.failed);
    return false;
  } catch (error) {
    console.error(error);
    toast.error(request.failed);
    return false;
  } finally {
    if (loader) setLoading(false);
  }
};

import { toast } from 'react-toastify';
import { customFetch, NETWORK_ERROR_MESSAGE } from '../../api/base';
import { baseURL } from '../../api/urls';
import { fillFromRow } from '../../api/views';

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

  setLoading(true);
  try {
    const result = await customFetch(baseURL + fillFromRow(request.path, row), request.method, body, false);
    if (result.success) {
      toast.success(request.done);
      return true;
    }
    toast.error(failureMessage(result, request));
    return false;
  } catch (error) {
    console.error(error);
    toast.error(request.failed);
    return false;
  } finally {
    setLoading(false);
  }
};

// The scholar's side of openings: applying. The board itself is described
// by the server (App\Pages\OpeningsPage).
import { baseURL } from './urls';
import { customFetch } from './base';

export const apiApply = (positionId, formData) =>
  customFetch(`${baseURL}/openings/${positionId}/apply`, 'POST', formData, true, true);

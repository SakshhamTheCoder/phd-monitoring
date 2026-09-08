import { baseURL } from './urls';
import { customFetch } from './base';

// Admin-editable settings, one group per feature. See AppSetting::GROUPS.
export const apiSettings = (group) => customFetch(`${baseURL}/settings/${group}`, 'GET', {}, true);
export const apiSaveSettings = (group, values) => customFetch(`${baseURL}/settings/${group}`, 'POST', values, true);

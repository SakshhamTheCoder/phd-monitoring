// Backend URL is resolved from the environment so it switches automatically:
//   `npm start`     -> development mode -> loads .env.development (localhost)
//   `npm run build` -> production mode  -> loads .env.production (hosted server)
// REACT_APP_API_URL must point at the API base (i.e. the URL ending in /api).
// The hardcoded fallback keeps a production build working even if no env file is present.
const API_URL = process.env.REACT_APP_API_URL || 'https://phdportal.thapar.edu/api/api';

export const baseURL = API_URL;
export const rootURL = API_URL.replace(/\/api\/?$/, '');

// Public client keys — sourced only from .env (no literal fallback kept in source).
export const CLOUDFLARE_SITE_KEY = process.env.REACT_APP_CLOUDFLARE_SITE_KEY;
export const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

export const ENDPOINTS = {
    LOGIN: `${baseURL}/login`,
    STUDENT_PROFILE: `${baseURL}/students`,
}

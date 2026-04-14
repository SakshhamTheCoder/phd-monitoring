export const baseURL= 'https://phdportal.thapar.edu/api/api';
export const rootURL= 'https://phdportal.thapar.edu/api';
// export const rootURL= 'http://localhost:8000';
// export const baseURL= rootURL+'/api';

// Cloudflare Turnstile Site Key (test key - replace with actual key in production)
export const CLOUDFLARE_SITE_KEY = '0x4AAAAAACC7RmZQ9q6PlXgB';
export const GOOGLE_CLIENT_ID='683418579182-cj20ju092avsu446p71jsojqrs8nhj8f.apps.googleusercontent.com'

export const ENDPOINTS = {
    LOGIN: `${baseURL}/login`,
    STUDENT_PROFILE: `${baseURL}/students`,
}
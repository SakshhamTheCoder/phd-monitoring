// Who may reach each area of the portal is the server's answer now (GET /me,
// read through useAccess in context/CapabilitiesContext.jsx), shared with the
// app. What stays here is the acting role itself.

// The acting role, as the server last told us at sign-in or role switch.
//
// Read in three dozen places to decide what to draw. It was read as
// localStorage.getItem('userRole') in every one of them, in two quote styles,
// so there was nowhere to change what "the current role" means.
export const currentRole = () => localStorage.getItem('userRole');

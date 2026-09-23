// Who may reach each area of the portal.
//
// The server is what actually enforces access; every controller answers 403 on
// its own. This file exists so the two places the client decides what to draw
// (the route table in App.jsx and the sidebar in CustomNavBar.jsx) read the
// same list instead of each keeping their own copy and drifting apart.
//
// One entry per area, named for the area rather than for the roles in it.

// The review chain above a supervisor. These roles appear together often enough
// that spelling them out each time is how the lists drifted.
const REVIEW_CHAIN = ['hod', 'phd_coordinator', 'dordc', 'adordc', 'dra', 'director'];

export const ACCESS = {
    home: ['student', 'ug_student', 'faculty', 'doctoral', 'external', 'admin', ...REVIEW_CHAIN],
    notifications: ['student', 'ug_student', 'faculty', 'doctoral', 'external', 'admin', ...REVIEW_CHAIN],

    projects: ['faculty', 'admin', ...REVIEW_CHAIN],
    presentations: ['student', 'faculty', 'doctoral', 'admin', ...REVIEW_CHAIN],

    // Everything hung off a scholar: their profile, their forms, their history.
    scholars: ['faculty', 'doctoral', 'external', 'admin', ...REVIEW_CHAIN],

    facultyDirectory: ['student', 'ug_student', 'faculty', 'doctoral', 'external', 'admin', ...REVIEW_CHAIN],

    departments: ['dordc', 'dra', 'director', 'admin'],
    supervisorApprovals: ['dordc', 'admin'],

    // Mentors reach URF too, but only while they mentor something, which is why
    // the sidebar pairs this with the can_read_urf_mentees capability.
    urf: ['faculty', 'admin', ...REVIEW_CHAIN],

    attendance: ['clerk', 'student', 'hod', 'admin'],

    courses: ['student', 'hod', 'phd_coordinator', 'admin'],
    courseManagement: ['hod', 'phd_coordinator', 'admin'],

    // HoD and coordinators manage their own department's areas only; the
    // server scopes them.
    areasOfSpecialization: ['hod', 'phd_coordinator', 'admin'],

    publications: ['student', 'ug_student'],
    openings: ['student'],

    admin: ['admin'],
};

export const allows = (area, role) => ACCESS[area].includes(role);

// The acting role, as the server last told us at sign-in or role switch.
//
// Read in three dozen places to decide what to draw. It was read as
// localStorage.getItem('userRole') in every one of them, in two quote styles,
// so there was nowhere to change what "the current role" means.
export const currentRole = () => localStorage.getItem('userRole');

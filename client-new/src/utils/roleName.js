export const getRoleName = (role) => {
    switch (role) {
        case 'student':
           return 'Student'
        case 'ug_student':
           return 'UG Student'
       case 'supervisor':
           return 'Supervisor';
        case 'faculty':
            return 'Supervisor';
        case 'hod':
            return 'HOD'
        case 'phd_coordinator':
            return 'PhD Coordinator';
        case 'dordc':
            return 'DORDC'
        case 'dra':
            return 'DRA'
        case 'external':
            return 'External Member'
        case 'doctoral':
            return 'Doctoral Committee'
        case 'complete':
            return 'Form Complete'
        case 'director':
            return 'Vice Chancellor'
        case 'adordc':
            return 'ADORDC';
        // A URF project's faculty mentor. A relationship rather than a role,
        // but it is a step on the URF chain and reads as one.
        case 'mentor':
            return 'Faculty Mentor';
        case 'admin':
            return 'Administrator';
        default:
            return role ? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
    }
}
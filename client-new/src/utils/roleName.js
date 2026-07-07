export const getRoleName = (role) => {
    switch (role) {
        case 'student':
           return 'Student'
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
        case 'admin':
            return 'Administrator';
        default:
            return role ? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
    }
}
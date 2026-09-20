// `formType` is only read for the one step whose name depends on the form it
// sits in: the doctoral committee reviews an IRB submission as the IRB
// committee. Callers that do not have it get the ordinary names.
export const getRoleName = (role, formType) => {
    if (role === 'doctoral' && formType === 'irb-submission') {
        return 'IRB Committee';
    }
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
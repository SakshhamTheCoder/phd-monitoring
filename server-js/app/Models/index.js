/**
 * Models Index File
 * Centralized export of all Sequelize models for easy importing
 * Uses correct import style (named vs default) based on each model's actual export
 */

// Core models - MIXED EXPORTS
import User from './User.js';
import Role from './Role.js';
import Student from './Student.js';
import { Faculty } from './Faculty.js';
import { Department } from './Department.js';
import Supervisor from './Supervisor.js';

// Form models - ALL NAMED EXPORTS
import { Forms } from './Forms.js';
import { Approval } from './Approval.js';
import { Filters } from './Filters.js';

// IRB models - ALL NAMED EXPORTS (except ConstituteOfIRB)
import { ConstituteOfIRB } from './ConstituteOfIRB.js';
import { IRBCommittee } from './IRBCommittee.js';
import { IrbSubForm } from './IrbSubForm.js';
import { IrbDoctoralApproval } from './IrbDoctoralApproval.js';
import { IrbExpertChairman } from './IrbExpertChairman.js';
import { IrbExpertDepartment } from './IrbExpertDepartment.js';
import { IrbNomineeCognate } from './IrbNomineeCognate.js';
import { IrbOutsideExpert } from './IrbOutsideExpert.js';
import { IrbSupervisorApproval } from './IrbSupervisorApproval.js';
import { ConstituteIrbSupervisorApproval } from './ConstituteIrbSupervisorApproval.js';

// Course models - NAMED EXPORTS
import { Course } from './Course.js';
import { Courses } from './Courses.js';
import StudentCourse from './StudentCourse.js';
import StudentCourses from './StudentCourses.js';

// Doctoral models - MIXED
import { DoctoralCommittee } from './DoctoralCommittee.js';
import OutsideExpert from './OutsideExpert.js';
import { ListOfExaminersForm } from './ListOfExaminersForm.js';
import { ExaminersDetail } from './ExaminersDetail.js';
import { ExaminersRecommendation } from './ExaminersRecommendation.js';

// Presentation models - DEFAULT EXPORTS
import Presentation from './Presentation.js';
import PresentationReview from './PresentationReview.js';

// Research models - MIXED
import Publication from './Publication.js';
import Patent from './Patent.js';
import PHDObjective from './PHDObjective.js';
import { AreaOfSpecialization } from './AreaOfSpecialization.js';
import { BroadAreaSpecialization } from './BroadAreaSpecialization.js';
import StudentBroadAreaSpecialization from './StudentBroadAreaSpecialization.js';

// Semester and status models - DEFAULT EXPORTS
import Semester from './Semester.js';
import StudentSemesterOff from './StudentSemesterOff.js';
import StudentSemesterOffForm from './StudentSemesterOffForm.js';
import StudentStatusChange from './StudentStatusChange.js';
import StudentStatusChangeForms from './StudentStatusChangeForms.js';

// Supervisor models - DEFAULT EXPORTS
import SupervisorAllocation from './SupervisorAllocation.js';
import SupervisorChangeForm from './SupervisorChangeForm.js';
import SupervisorDoctoralChange from './SupervisorDoctoralChange.js';

// Synopsis and Thesis models - DEFAULT EXPORTS
import SynopsisSubmission from './SynopsisSubmission.js';
import SynopsisObjectives from './SynopsisObjectives.js';
import ThesisExtension from './ThesisExtension.js';
import ThesisExtentionForm from './ThesisExtentionForm.js';
import ThesisSubmission from './ThesisSubmission.js';

// Research extension models - DEFAULT EXPORTS
import ResearchExtentions from './ResearchExtentions.js';
import ResearchExtentionsForm from './ResearchExtentionsForm.js';

// Other models - DEFAULT EXPORTS
import Notifications from './Notifications.js';
import PhdCoordinator from './PhdCoordinator.js';

// Export all models as named exports for consistent importing
export {
    // Core
    User,
    Role,
    Student,
    Faculty,
    Department,
    Supervisor,
    
    // Forms
    Forms,
    Approval,
    Filters,
    
    // IRB
    ConstituteOfIRB,
    IRBCommittee,
    IrbSubForm,
    IrbDoctoralApproval,
    IrbExpertChairman,
    IrbExpertDepartment,
    IrbNomineeCognate,
    IrbOutsideExpert,
    IrbSupervisorApproval,
    ConstituteIrbSupervisorApproval,
    
    // Courses
    Course,
    Courses,
    StudentCourse,
    StudentCourses,
    
    // Doctoral
    DoctoralCommittee,
    OutsideExpert,
    ListOfExaminersForm,
    ExaminersDetail,
    ExaminersRecommendation,
    
    // Presentation
    Presentation,
    PresentationReview,
    
    // Research
    Publication,
    Patent,
    PHDObjective,
    AreaOfSpecialization,
    BroadAreaSpecialization,
    StudentBroadAreaSpecialization,
    
    // Semester/Status
    Semester,
    StudentSemesterOff,
    StudentSemesterOffForm,
    StudentStatusChange,
    StudentStatusChangeForms,
    
    // Supervisor
    SupervisorAllocation,
    SupervisorChangeForm,
    SupervisorDoctoralChange,
    
    // Synopsis/Thesis
    SynopsisSubmission,
    SynopsisObjectives,
    ThesisExtension,
    ThesisExtentionForm,
    ThesisSubmission,
    
    // Research extensions
    ResearchExtentions,
    ResearchExtentionsForm,
    
    // Other
    Notifications,
    PhdCoordinator,
};

// Default export as object for convenience
export default {
    User,
    Role,
    Student,
    Faculty,
    Department,
    Supervisor,
    Forms,
    Approval,
    Filters,
    ConstituteOfIRB,
    IRBCommittee,
    IrbSubForm,
    IrbDoctoralApproval,
    IrbExpertChairman,
    IrbExpertDepartment,
    IrbNomineeCognate,
    IrbOutsideExpert,
    IrbSupervisorApproval,
    ConstituteIrbSupervisorApproval,
    Course,
    Courses,
    StudentCourse,
    StudentCourses,
    DoctoralCommittee,
    OutsideExpert,
    ListOfExaminersForm,
    ExaminersDetail,
    ExaminersRecommendation,
    Presentation,
    PresentationReview,
    Publication,
    Patent,
    PHDObjective,
    AreaOfSpecialization,
    BroadAreaSpecialization,
    StudentBroadAreaSpecialization,
    Semester,
    StudentSemesterOff,
    StudentSemesterOffForm,
    StudentStatusChange,
    StudentStatusChangeForms,
    SupervisorAllocation,
    SupervisorChangeForm,
    SupervisorDoctoralChange,
    SynopsisSubmission,
    SynopsisObjectives,
    ThesisExtension,
    ThesisExtentionForm,
    ThesisSubmission,
    ResearchExtentions,
    ResearchExtentionsForm,
    Notifications,
    PhdCoordinator,
};

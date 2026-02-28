/**
 * Model Relations
 * Comprehensive Sequelize associations ported from PHP Laravel Eloquent
 * 
 * This file defines all model relationships for the application
 */

import {
    User,
    Student,
    Faculty,
    Department,
    Role,
    Supervisor,
    DoctoralCommittee,
    Forms,
    Notifications,
    PhdCoordinator,
    Publication,
    Patent,
    Presentation,
    PresentationReview,
    PHDObjective,
    AreaOfSpecialization,
    BroadAreaSpecialization,
    StudentBroadAreaSpecialization,
    Semester,
    StudentSemesterOff,
    StudentSemesterOffForm,
    StudentStatusChange,
    StudentStatusChangeForms,
    Course,
    StudentCourse,
    OutsideExpert,
    ConstituteOfIRB,
    IRBCommittee,
    IrbSubForm,
    IrbSupervisorApproval,
    IrbDoctoralApproval,
    IrbExpertChairman,
    IrbExpertDepartment,
    IrbNomineeCognate,
    IrbOutsideExpert,
    ConstituteIrbSupervisorApproval,
    SynopsisSubmission,
    SynopsisObjectives,
    ThesisExtension,
    ThesisExtentionForm,
    ThesisSubmission,
    ResearchExtentions,
    ResearchExtentionsForm,
    SupervisorAllocation,
    SupervisorChangeForm,
    SupervisorDoctoralChange,
    ListOfExaminersForm,
    ExaminersDetail,
    ExaminersRecommendation
} from "../app/Models/index.js";

// ============================================
// USER RELATIONS
// ============================================

// User ↔ Role
User.belongsTo(Role, { foreignKey: "role_id", as: "role" });
User.belongsTo(Role, { foreignKey: "current_role_id", as: "current_role" });
User.belongsTo(Role, { foreignKey: "default_role_id", as: "default_role" });
Role.hasMany(User, { foreignKey: "role_id" });

// User ↔ Student / Faculty
// User.hasOne(Student, { foreignKey: "user_id", as: "student" });
// //Student.belongsTo(User, { foreignKey: "user_id", as: "user" });
// Student.belongsTo(User, { foreignKey: "user_id", as: "studentUser" });

Student.belongsTo(User, { 
  foreignKey: "user_id", 
  as: "user"   
});

User.hasOne(Student, { 
  foreignKey: "user_id", 
  as: "student" 
});



// User.hasOne(Faculty, { foreignKey: "user_id", as: "faculty" });
// // Faculty.belongsTo(User, { foreignKey: "user_id", as: "user" });
// Faculty.belongsTo(User, { foreignKey: "user_id", as: "facultyUser" });


User.hasOne(Faculty, { foreignKey: "user_id", as: "faculty" });
Faculty.belongsTo(User, { 
  foreignKey: "user_id", 
  as: "user" 
});

// User ↔ Notifications
User.hasMany(Notifications, { foreignKey: "user_id", as: "notifications" });
Notifications.belongsTo(User, { foreignKey: "user_id" });

// ============================================
// DEPARTMENT RELATIONS
// ============================================

// Department ↔ Student/Faculty
Student.belongsTo(Department, { foreignKey: "department_id", as: "department" });
Faculty.belongsTo(Department, { foreignKey: "department_id", as: "department" });
Department.hasMany(Student, { foreignKey: "department_id", as: "students" });
Department.hasMany(Faculty, { foreignKey: "department_id", as: "faculties" });

// Department ↔ HOD (Faculty)
Department.belongsTo(Faculty, { foreignKey: "hod_id", targetKey: "faculty_code", as: "hod" });

// // Department ↔ ADORDC (Faculty)
// Department.belongsTo(Faculty, { foreignKey: "adordc_id", targetKey: "faculty_code", as: "adordc" });
// Faculty.hasMany(Department, { foreignKey: "adordc_id", sourceKey: "faculty_code", as: "adordcDepartments" });

// Department ↔ PhD Coordinators
Department.hasMany(PhdCoordinator, { foreignKey: "department_id", as: "phdCoordinators" });
PhdCoordinator.belongsTo(Department, { foreignKey: "department_id" });
PhdCoordinator.belongsTo(Faculty, { foreignKey: "faculty_id", targetKey: "faculty_code", as: "faculty" });

// Department ↔ Broad Area Specialization
Department.hasMany(BroadAreaSpecialization, { foreignKey: "department_id", as: "broadAreaSpecializations" });
BroadAreaSpecialization.belongsTo(Department, { foreignKey: "department_id" });

// ============================================
// STUDENT RELATIONS
// ============================================

// Student ↔ Area of Specialization
// Student.belongsTo(AreaOfSpecialization, { foreignKey: "area_of_specialization_id", as: "areaOfSpecialization" });
// AreaOfSpecialization.hasMany(Student, { foreignKey: "area_of_specialization_id" });
// AreaOfSpecialization.belongsTo(Department, { foreignKey: "department_id" });

// Student ↔ Broad Area Specialization (many-to-many through StudentBroadAreaSpecialization)
Student.hasMany(StudentBroadAreaSpecialization, { foreignKey: "student_id", sourceKey: "roll_no", as: "broadAreaSpecializations" });
StudentBroadAreaSpecialization.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no" });
StudentBroadAreaSpecialization.belongsTo(BroadAreaSpecialization, { foreignKey: "specialization_id" });

// Student ↔ Supervisors (many-to-many through supervisors table)
Student.belongsToMany(Faculty, { 
    through: Supervisor, 
    foreignKey: "student_id", 
    otherKey: "faculty_id",
    sourceKey: "roll_no",
    targetKey: "faculty_code",
    as: "supervisors" 
});
Faculty.belongsToMany(Student, { 
    through: Supervisor, 
    foreignKey: "faculty_id", 
    otherKey: "student_id",
    sourceKey: "faculty_code",
    targetKey: "roll_no",
    as: "supervisedStudents" 
});

// Student ↔ Doctoral Committee (many-to-many)
Student.belongsToMany(Faculty, { 
    through: DoctoralCommittee, 
    foreignKey: "student_id", 
    otherKey: "faculty_id",
    as: "doctoralCommittee" 
});
Faculty.belongsToMany(Student, { 
    through: DoctoralCommittee, 
    foreignKey: "faculty_id", 
    otherKey: "student_id",
    as: "doctoredStudents" 
});

// Student ↔ Forms
Student.hasMany(Forms, { foreignKey: "student_id", sourceKey: "roll_no", as: "forms" });
Forms.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no", as: "student" });

// Student ↔ Publications
Student.hasMany(Publication, { foreignKey: "student_id", sourceKey: "roll_no", as: "publications" });
Publication.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no" });

// Student ↔ Patents
Student.hasMany(Patent, { foreignKey: "student_id", sourceKey: "roll_no", as: "patents" });
Patent.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no" });

// Student ↔ Presentations
Student.hasMany(Presentation, { foreignKey: "student_id", sourceKey: "roll_no", as: "presentations" });
Presentation.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no", as: "student" });

// Student ↔ PHD Objectives
Student.hasMany(PHDObjective, { foreignKey: "student_id", sourceKey: "roll_no", as: "objectives" });
PHDObjective.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no" });

// Student ↔ Status Changes
Student.hasMany(StudentStatusChange, { foreignKey: "student_id", sourceKey: "roll_no", as: "statusChanges" });
StudentStatusChange.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no" });

// Student ↔ Semester Offs
Student.hasMany(StudentSemesterOff, { foreignKey: "student_id", sourceKey: "roll_no", as: "semesterOffs" });
StudentSemesterOff.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no" });

// Student ↔ Courses (many-to-many)
Student.belongsToMany(Course, { 
    through: StudentCourse, 
    foreignKey: "student_id", 
    otherKey: "course_id",
    sourceKey: "roll_no",
    as: "courses" 
});
Course.belongsToMany(Student, { 
    through: StudentCourse, 
    foreignKey: "course_id", 
    otherKey: "student_id",
    targetKey: "roll_no",
    as: "students" 
});
Course.hasMany(StudentCourse, { foreignKey: "course_id", as: "studentCourses" });

// Student ↔ Thesis Extensions
Student.hasMany(ThesisExtension, { foreignKey: "student_id", sourceKey: "roll_no", as: "thesisExtentions" });
ThesisExtension.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no", as: "student" });

// Student ↔ Research Extensions
Student.hasMany(ResearchExtentions, { foreignKey: "student_id", sourceKey: "roll_no", as: "researchExtentions" });
ResearchExtentions.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no" });

// ============================================
// FORM RELATIONS
// ============================================

// Student ↔ IRB Committee
Student.hasMany(IRBCommittee, { foreignKey: "student_id", sourceKey: "roll_no", as: "irbCommittees" });
IRBCommittee.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no" });

// Student ↔ IRB Forms
Student.hasOne(ConstituteOfIRB, { foreignKey: "student_id", sourceKey: "roll_no", as: "irbForm" });
ConstituteOfIRB.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no", as: "student" });

Student.hasOne(IrbSubForm, { foreignKey: "student_id", sourceKey: "roll_no", as: "irbSubForm" });
IrbSubForm.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no", as: "student" });

// ConstituteOfIRB ↔ Related models
ConstituteOfIRB.hasMany(IrbNomineeCognate, { foreignKey: "irb_form_id", as: "nomineeCognates" });
IrbNomineeCognate.belongsTo(ConstituteOfIRB, { foreignKey: "irb_form_id" });
IrbNomineeCognate.belongsTo(Faculty, { foreignKey: "nominee_id", targetKey: "faculty_code", as: "nominee" });

ConstituteOfIRB.hasMany(IrbOutsideExpert, { foreignKey: "irb_form_id", as: "outsideExperts" });
IrbOutsideExpert.belongsTo(ConstituteOfIRB, { foreignKey: "irb_form_id" });
IrbOutsideExpert.belongsTo(OutsideExpert, { foreignKey: "expert_id", as: "expert" });

ConstituteOfIRB.hasMany(IrbExpertDepartment, { foreignKey: "irb_form_id", as: "departmentExperts" });
IrbExpertDepartment.belongsTo(ConstituteOfIRB, { foreignKey: "irb_form_id" });
IrbExpertDepartment.belongsTo(Faculty, { foreignKey: "expert_id", targetKey: "faculty_code", as: "expert" });

ConstituteOfIRB.hasMany(IrbExpertChairman, { foreignKey: "irb_form_id", as: "chairmanExperts" });
IrbExpertChairman.belongsTo(ConstituteOfIRB, { foreignKey: "irb_form_id" });

ConstituteOfIRB.hasMany(ConstituteIrbSupervisorApproval, { foreignKey: "irb_cons_form_id", as: "supervisorApprovals" });
ConstituteIrbSupervisorApproval.belongsTo(ConstituteOfIRB, { foreignKey: "irb_cons_form_id" });

ConstituteOfIRB.belongsTo(Faculty, { foreignKey: "supervisor_id", targetKey: "faculty_code", as: "supervisor" });
ConstituteOfIRB.belongsTo(Faculty, { foreignKey: "cognate_expert", targetKey: "faculty_code", as: "cognateExpert" });
ConstituteOfIRB.belongsTo(OutsideExpert, { foreignKey: "outside_expert", as: "outsideExpert" });

// IrbSubForm ↔ Related models
IrbSubForm.hasMany(IrbSupervisorApproval, { foreignKey: "irb_sub_form_id", as: "supervisorApprovals" });
IrbSupervisorApproval.belongsTo(IrbSubForm, { foreignKey: "irb_sub_form_id" });
IrbSupervisorApproval.belongsTo(Faculty, { foreignKey: "supervisor_id", targetKey: "faculty_code", as: "supervisor" });

IrbSubForm.hasMany(IrbDoctoralApproval, { foreignKey: "irb_sub_form_id", as: "doctoralApprovals" });
IrbDoctoralApproval.belongsTo(IrbSubForm, { foreignKey: "irb_sub_form_id" });
IrbDoctoralApproval.belongsTo(Faculty, { foreignKey: "doctoral_id", targetKey: "faculty_code", as: "doctoral" });

// Faculty ↔ IRB relations
Faculty.hasMany(IrbNomineeCognate, { foreignKey: "nominee_id", sourceKey: "faculty_code", as: "irbNominations" });
Faculty.hasMany(IrbExpertDepartment, { foreignKey: "expert_id", sourceKey: "faculty_code", as: "irbDepartmentExpert" });

// OutsideExpert ↔ IrbOutsideExpert
OutsideExpert.hasMany(IrbOutsideExpert, { foreignKey: "expert_id", as: "irbForms" });
OutsideExpert.belongsTo(Faculty, { foreignKey: "added_by", targetKey: "faculty_code", as: "addedBy" });

// Student Form Relations
Student.hasOne(StudentStatusChangeForms, { foreignKey: "student_id", sourceKey: "roll_no", as: "statusChangeForm" });
StudentStatusChangeForms.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no", as: "student" });

Student.hasOne(StudentSemesterOffForm, { foreignKey: "student_id", sourceKey: "roll_no", as: "semesterOffForm" });
StudentSemesterOffForm.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no", as: "student" });

Student.hasOne(ResearchExtentionsForm, { foreignKey: "student_id", sourceKey: "roll_no", as: "researchExtentionsForm" });
ResearchExtentionsForm.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no", as: "student" });

Student.hasOne(SupervisorChangeForm, { foreignKey: "student_id", sourceKey: "roll_no", as: "supervisorChangeForm" });
SupervisorChangeForm.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no", as: "student" });

Student.hasOne(SupervisorAllocation, { foreignKey: "student_id", sourceKey: "roll_no", as: "supervisorAllocation" });
SupervisorAllocation.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no", as: "student" });

// Thesis/Synopsis Forms
Student.hasOne(ThesisExtentionForm, { foreignKey: "student_id", sourceKey: "roll_no", as: "thesisExtentionForm" });
ThesisExtentionForm.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no", as: "student" });

Student.hasOne(ThesisSubmission, { foreignKey: "student_id", sourceKey: "roll_no", as: "thesisSubmission" });
ThesisSubmission.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no", as: "student" });
ThesisSubmission.hasMany(Publication, { foreignKey: "form_id", as: "publications" });
ThesisSubmission.hasMany(Patent, { foreignKey: "form_id", as: "patents" });

Student.hasOne(SynopsisSubmission, { foreignKey: "student_id", sourceKey: "roll_no", as: "synopsisSubmission" });
SynopsisSubmission.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no", as: "student" });
SynopsisSubmission.hasMany(SynopsisObjectives, { foreignKey: "synopsis_id", as: "objectives" });
SynopsisObjectives.belongsTo(SynopsisSubmission, { foreignKey: "synopsis_id" });
SynopsisSubmission.hasMany(Publication, { foreignKey: "form_id", as: "publications" });
SynopsisSubmission.hasMany(Patent, { foreignKey: "form_id", as: "patents" });

// List of Examiners Form
Student.hasOne(ListOfExaminersForm, { foreignKey: "student_id", sourceKey: "roll_no", as: "listOfExaminersForm" });
ListOfExaminersForm.belongsTo(Student, { foreignKey: "student_id", targetKey: "roll_no", as: "student" });
ListOfExaminersForm.hasMany(ExaminersDetail, { foreignKey: "form_id", as: "examinersDetails" });
ExaminersDetail.belongsTo(ListOfExaminersForm, { foreignKey: "form_id" });
ListOfExaminersForm.hasMany(ExaminersRecommendation, { foreignKey: "form_id", as: "recommendations" });
ExaminersRecommendation.belongsTo(ListOfExaminersForm, { foreignKey: "form_id" });

// ============================================
// PRESENTATION RELATIONS
// ============================================

Presentation.belongsTo(Department, { foreignKey: "department_id", as: "department" });
Presentation.hasMany(PresentationReview, { foreignKey: "presentation_id", as: "reviews" });
PresentationReview.belongsTo(Presentation, { foreignKey: "presentation_id" });
PresentationReview.belongsTo(Faculty, { foreignKey: "faculty_id", targetKey: "faculty_code", as: "reviewer" });

// ============================================
// SUPERVISOR DOCTORAL CHANGE
// ============================================

SupervisorDoctoralChange.belongsTo(Student, { foreignKey: "student_id", as: "student" });
SupervisorDoctoralChange.belongsTo(Faculty, { foreignKey: "faculty_id", targetKey: "faculty_code", as: "faculty" });

// ============================================
// EXPORT MESSAGE
// ============================================
console.log("✅ All model relations loaded successfully");

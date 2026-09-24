import ExaminerNominations from "../listOfExaminers/ExaminerNominations";
import ExaminerDecisions from "../listOfExaminers/ExaminerDecisions";

// Panels a form definition names instead of describing (FormDefinition::custom).
// Each takes the form's data and draws and submits itself.
const CUSTOM_PANELS = {
  "examiner-nominations": ExaminerNominations,
  "examiner-decisions": ExaminerDecisions,
};

export default CUSTOM_PANELS;

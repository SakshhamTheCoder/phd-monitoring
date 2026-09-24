import SupervisorPreferences from "../supervisorAllocation/SupervisorPreferences";

// Panels a form definition names instead of describing (FormDefinition::custom).
// Each takes the form's data and draws and submits itself.
const CUSTOM_PANELS = {
  "supervisor-preferences": SupervisorPreferences,
};

export default CUSTOM_PANELS;

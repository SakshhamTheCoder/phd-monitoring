// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const FORMS_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// The chain each form's controller stores on the row, which is what FormLadder
// renders from. Taken from the controller, not from AdminFormController's
// metadata: GeneralFormCreate::createForms writes $data['steps'], and the
// metadata table only seeds the forms index row.
const CHAINS = {
  'constituteOfIRB/ConstituteOfIRB.jsx': ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc'],
  'irbExtention/IrbExtention.jsx': ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'director'],
  'irbSubmission/IRBSubmission.jsx': ['student', 'faculty', 'external', 'doctoral', 'phd_coordinator', 'hod', 'dra', 'dordc'],
  'listOfExaminers/ListOfExaminers.jsx': ['faculty', 'dordc', 'director'],
  'presentations/PresentationForm.jsx': ['student', 'faculty', 'doctoral', 'hod', 'dordc'],
  'semesterOff/SemesterOff.jsx': ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'director'],
  'statusChange/StatusChange.jsx': ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'director'],
  // Three or more supervisors extends this one with 'dordc' and 'director'.
  'supervisorAllocation/SupervisorAllocation.jsx': ['student', 'phd_coordinator', 'hod', 'dordc', 'director'],
  // Three or more supervisors extends this one with 'director'.
  'supervisorChange/SupervisorChange.jsx': ['student', 'phd_coordinator', 'hod', 'dordc', 'director'],
  // The same roles answer twice, once on the written submission and again
  // after the viva. The row stores the chain once, so it is listed once.
  'synopsisSubmission/SynopsisSubmission.jsx': ['student', 'faculty', 'doctoral', 'phd_coordinator', 'hod', 'dordc'],
  'thesisExtention/ThesisExtention.jsx': ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'director'],
  'thesisSubmission/ThesisSubmission.jsx': ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc'],
};

// A step that collects the scholar's own answers rather than a recommendation.
// Falling through to the generic Recommendation here is not a cosmetic problem:
// it asks the scholar whether they recommend their own application.
const NEEDS_ITS_OWN_PANEL = 'student';

const read = (file) => fs.readFileSync(path.join(FORMS_DIR, file), 'utf8');

const panelsOf = (source) => {
  const match = source.match(/panels=\{\{([\s\S]*?)\}\}/);
  if (!match) return null;
  return [...match[1].matchAll(/(\w+)\s*:/g)].map((m) => m[1]);
};

describe('every form maps the steps that need their own panel', () => {
  it.each(Object.keys(CHAINS))('%s', (file) => {
    const source = read(file);
    const panels = panelsOf(source);

    expect(panels, `${file} renders no FormLadder panels map`).not.toBeNull();

    // Nothing may be mapped that the chain never contains: it would be dead, and
    // it hides the fact that the step is missing.
    for (const step of panels) {
      expect(CHAINS[file], `${file} maps "${step}", which its chain never contains`)
        .toContain(step);
    }

    if (CHAINS[file].includes(NEEDS_ITS_OWN_PANEL)) {
      expect(
        panels,
        `${file}: the chain starts at "student" but no panel is mapped for it, so the `
        + 'step falls through to a plain Recommendation and asks the scholar to '
        + 'recommend their own form',
      ).toContain(NEEDS_ITS_OWN_PANEL);
    }
  });
});

describe('FormLadder is the only thing choosing panels', () => {
  it('no form selects a panel by the order of its children', () => {
    for (const file of Object.keys(CHAINS)) {
      const source = read(file);
      expect(source, `${file} still uses the old position-based wrapper`)
        .not.toContain('RoleBasedWrapper');
      expect(source, `${file} does not render a FormLadder`).toContain('<FormLadder');
    }
  });

  it('every mapped panel is imported', () => {
    for (const file of Object.keys(CHAINS)) {
      const source = read(file);
      const match = source.match(/panels=\{\{([\s\S]*?)\}\}/);
      const components = [...match[1].matchAll(/:\s*(\w+)/g)].map((m) => m[1]);
      for (const component of components) {
        expect(source, `${file} maps ${component} without importing it`)
          .toMatch(new RegExp(`import\\s+${component}\\s+from`));
      }
    }
  });
});

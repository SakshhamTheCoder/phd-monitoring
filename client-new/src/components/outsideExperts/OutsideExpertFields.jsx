import React from 'react';
import InputField from '../forms/fields/InputField';
import GridContainer from '../forms/fields/GridContainer';

// A new expert's fields, empty. The server requires name, email, designation,
// department and institution; the rest are optional.
export const EMPTY_EXPERT = {
  full_name: '',
  designation: '',
  department: '',
  institution: '',
  email: '',
  phone: '',
  area_of_expertise: '',
  website: '',
};

/**
 * One outside expert's fields, for adding or editing one. Used by the Outside
 * Experts page and by the add shortcut in Manage supervisors/doctoral, so the
 * two cannot ask for different things.
 */
const OutsideExpertFields = ({ values, onChange }) => (
  <>
    <GridContainer
      elements={[
        <InputField
          label="Full Name"
          initialValue={values.full_name}
          onChange={(value) => onChange('full_name', value)}
          placeholder="e.g. Dr. Tarunpreet Bhatia"
          required
        />,
      ]}
    />
    <GridContainer
      elements={[
        <InputField
          label="Email"
          type="email"
          initialValue={values.email}
          onChange={(value) => onChange('email', value)}
          placeholder="expert@example.com"
          required
        />,
        <InputField
          label="Phone"
          initialValue={values.phone}
          onChange={(value) => onChange('phone', value)}
          placeholder="Enter phone number"
        />,
      ]}
    />
    <GridContainer
      elements={[
        <InputField
          label="Designation"
          initialValue={values.designation}
          onChange={(value) => onChange('designation', value)}
          placeholder="e.g., Professor"
          required
        />,
        <InputField
          label="Department"
          initialValue={values.department}
          onChange={(value) => onChange('department', value)}
          placeholder="e.g., Computer Science"
          required
        />,
      ]}
    />
    <GridContainer
      elements={[
        <InputField
          label="Institution"
          initialValue={values.institution}
          onChange={(value) => onChange('institution', value)}
          placeholder="e.g., University Name"
          required
        />,
      ]}
      space={2}
    />
    <GridContainer
      elements={[
        <InputField
          label="Area of Expertise"
          initialValue={values.area_of_expertise}
          onChange={(value) => onChange('area_of_expertise', value)}
          placeholder="Research areas"
        />,
      ]}
      space={2}
    />
    <GridContainer
      elements={[
        <InputField
          label="Website"
          initialValue={values.website}
          onChange={(value) => onChange('website', value)}
          placeholder="https://example.com"
        />,
      ]}
      space={2}
    />
  </>
);

export default OutsideExpertFields;

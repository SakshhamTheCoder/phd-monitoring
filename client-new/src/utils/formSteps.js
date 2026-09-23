// Where a form is in its approval chain. `formData.steps` names the chain and
// `maximum_step` is the index of the furthest step the form has been at; the
// server gates who may read a form on the same index (GeneralFormHandler).

// The supervisor's step is called "faculty" in `steps`, while the locks,
// approvals and comments maps call that person "supervisor".
const stepOf = (role) => (role === 'supervisor' ? 'faculty' : role);

// Whether the form has got as far as this role's step. Without a chain or an
// index to judge by, every step counts as reached, which is how the ladder
// behaved before it could tell.
export const stepReached = (formData, role) => {
  const index = (formData?.steps || []).indexOf(stepOf(role));
  if (index === -1 || formData?.maximum_step == null) return true;
  return index <= Number(formData.maximum_step);
};

// Whether a step's approval is an answer. The approval columns default to 0
// and every lock but the current one's is set, so without the reached check a
// step the form has not come to yet read as "Not recommend".
export const stepAnswered = (formData, role) => !!formData?.locks?.[role] && stepReached(formData, role);

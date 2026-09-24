import React from 'react';
import UserForm from '../../userForm/UserForm';

/**
 * A login's roles, status and password, created or edited. Closing it, saved
 * or not, reads the list again, as the page always did.
 */
const UserEditorBlock = ({ row, props, onClose, onChanged }) => (
  <UserForm
    edit={props?.edit}
    userData={props?.edit ? row : null}
    onClose={() => {
      onClose();
      onChanged();
    }}
  />
);

export default UserEditorBlock;

import React, { useState, useEffect } from 'react';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import { apiRoleList } from '../../api/lookups';
import { toast } from 'react-toastify';
import CustomButton from '../forms/fields/CustomButton';
import InputField from '../forms/fields/InputField';
import DropdownField from '../forms/fields/DropdownField';
import GridContainer from '../forms/fields/GridContainer';
import ToggleSwitch from '../forms/fields/ToggleSwitch';
import LoadError from '../common/LoadError';
import StatusNotice from '../common/StatusNotice';
import useBranches from '../../hooks/useBranches';
import './UserForm.css';

const UserForm = ({ edit, userData, onClose }) => {
  const [formData, setFormData] = useState({
    id: null,
    full_name: '',
    email: '',
    phone: '',
    gender: '',
    physically_handicapped: false,
    role_id: '',
    current_role_id: '',
    default_role_id: '',
    available_roles: [],
    status: 'active',
    password: '',
  });

  const [roles, setRoles] = useState([]);
  const [allRoleOptions, setAllRoleOptions] = useState([]);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [customPassword, setCustomPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [rolesFailed, setRolesFailed] = useState(false);
  // The URF details behind a ug_student account, which only that role has.
  const branches = useBranches();

  useEffect(() => {
    fetchRoles();
  }, []);

  // Filled without waiting on the role list: the role selects mount once it
  // arrives and read these values then, and a failed /roles no longer holds
  // every other field back.
  useEffect(() => {
    if (edit && userData) {
      setFormData({
        id: userData.id,
        full_name: userData.full_name || [userData.first_name, userData.last_name].filter(Boolean).join(' ') || '',
        email: userData.email || '',
        phone: userData.phone || '',
        gender: userData.gender || '',
        physically_handicapped: !!userData.physically_handicapped,
        role_id: userData.role_id || '',
        current_role_id: userData.current_role_id || '',
        default_role_id: userData.default_role_id || '',
        available_roles: userData.available_roles || [],
        status: userData.status || 'active',
        password: '',
        roll_no: userData.ug_student?.roll_no || '',
        branch_id: userData.ug_student?.branch_id || '',
        year: userData.ug_student?.year || '',
      });
    }
  // A new user starts from the blank state above. Resetting here as well ran
  // again when the role list arrived and wiped whatever had been typed.
  }, [edit, userData]);

  const fetchRoles = async () => {
    setRolesFailed(false);
    try {
      const response = await apiRoleList();
      // customFetch has already said why.
      if (!response.success) {
        setRolesFailed(true);
        return;
      }
      const roleData = response.response.map(r => ({
        value: r.id,
        title: r.role.charAt(0).toUpperCase() + r.role.slice(1),
        role_name: r.role
      }));
      setRoles(roleData);
      setAllRoleOptions(roleData.map(r => r.role_name));
      setRolesLoaded(true);
    } catch (error) {
      setRolesFailed(true);
      toast.error('Failed to fetch roles');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = { ...formData };
      
      if (customPassword) {
        payload.password = customPassword;
      }

      const response = await customFetch(
        baseURL + '/users',
        'POST',
        payload,
        true
      );

      // customFetch has already shown the server's reason for a refusal. This
      // said "created successfully" either way, and read the password and
      // warnings from the wrapper rather than from the server's answer.
      if (!response.success) {
        return;
      }
      const saved = response.response || {};
      if (saved.password) {
        toast.success(`User ${edit ? 'updated' : 'created'}. Password: ${saved.password}`);
      } else if (edit) {
        toast.success('User updated.');
      } else {
        // No password in the answer means none was typed, so the account was
        // mailed a link to choose its own.
        toast.success('User created. They are emailed a link to set their password.');
      }

      // Roles can be granted before the record backing them exists, so the save
      // succeeds but the role won't work yet. Surface that instead of letting it
      // fail silently later.
      (saved.warnings || []).forEach((warning) =>
        toast.warn(warning, { autoClose: 10000 })
      );

      onClose();
    } catch (error) {
      toast.error(error.message || `Failed to ${edit ? 'update' : 'create'} user`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!customPassword || customPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const result = await customFetch(
        baseURL + `/users/${formData.id}/reset-password`,
        'POST',
        { password: customPassword },
        true
      );
      if (!result.success) return;
      toast.success('Password reset.');
      setCustomPassword('');
      setShowPasswordSection(false);
    } catch (error) {
      toast.error('Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetEmail = async () => {
    setLoading(true);
    try {
      const result = await customFetch(
        baseURL + `/users/${formData.id}/send-reset-email`,
        'POST',
        {},
        true
      );
      if (!result.success) return;
      toast.success('Password reset email sent.');
    } catch (error) {
      toast.error('Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  // Ids arrive as numbers from /roles and as strings from the select, so a
  // strict comparison never matched once a role had been picked.
  const roleById = (id) => roles.find(r => String(r.value) === String(id));

  const handleRoleChange = (roleId) => {
    const selectedRole = roleById(roleId);
    setFormData(prev => ({
      ...prev,
      role_id: roleId,
      current_role_id: prev.current_role_id || roleId,
      default_role_id: prev.default_role_id || roleId,
      available_roles: prev.available_roles.length === 0 && selectedRole
        ? [selectedRole.role_name]
        : prev.available_roles
    }));
  };

  const toggleAvailableRole = (roleName) => {
    setFormData(prev => {
      const newRoles = prev.available_roles.includes(roleName)
        ? prev.available_roles.filter(r => r !== roleName)
        : [...prev.available_roles, roleName];
      return { ...prev, available_roles: newRoles };
    });
  };

  const genderOptions = [
    { value: 'Male', title: 'Male' },
    { value: 'Female', title: 'Female' },
  ];

  const statusOptions = [
    { value: 'active', title: 'Active' },
    { value: 'inactive', title: 'Inactive' },
    { value: 'suspended', title: 'Suspended' },
  ];



  return (
    <div className="user-form">
      <h2 className="modal-title">{edit ? 'Edit user' : 'Create new user'}</h2>
      
      <form onSubmit={handleSubmit}>
        <GridContainer
          elements={[
            <InputField
              label="Full name *"
              initialValue={formData.full_name}
              isLocked={false}
              onChange={(value) => setFormData((prev) => ({ ...prev, full_name: value }))}
              key={`full_name_${formData.id || 'new'}`}
            />
          ]}
          space={2}
        />

        <GridContainer
          elements={[
            <InputField
              label="Email *"
              initialValue={formData.email}
              isLocked={false}
              type="email"
              onChange={(value) => setFormData((prev) => ({ ...prev, email: value }))}
              key={`email_${formData.id || 'new'}`}
            />,
            <InputField
              label="Phone *"
              initialValue={formData.phone}
              isLocked={false}
              onChange={(value) => setFormData((prev) => ({ ...prev, phone: value }))}
              key={`phone_${formData.id || 'new'}`}
            />
          ]}
          space={2}
        />

        <GridContainer
          elements={[
            <DropdownField
              label="Gender"
              options={genderOptions}
              initialValue={formData.gender}
              onChange={(value) => setFormData((prev) => ({ ...prev, gender: value }))}
              key={`gender_${formData.id || 'new'}`}
            />,
            <DropdownField
              label="Status"
              options={statusOptions}
              initialValue={formData.status || 'active'}
              onChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
              key={`status_${formData.id || 'new'}`}
            />,
            <ToggleSwitch
              label="Physically handicapped"
              isOn={formData.physically_handicapped}
              onToggle={() => setFormData((prev) => ({ ...prev, physically_handicapped: !prev.physically_handicapped }))}
            />,
          ]}
          space={3}
        />

        <div className="user-form-row">
          {rolesLoaded && roles.length > 0 ? (
            // The label goes through the field so it is tied to the select; a
            // bare <label> beside it named nothing for a screen reader.
            <DropdownField
              label="Main role"
              required
              options={roles}
              initialValue={formData.role_id || ''}
              onChange={handleRoleChange}
              key={`role_${formData.id || 'new'}`}
            />
          ) : rolesFailed ? (
            <LoadError message="Could not load the roles. Check your connection and try again." onRetry={fetchRoles} />
          ) : (
            <StatusNotice tone="loading" title="Loading roles" />
          )}
        </div>

        <GridContainer
          elements={[
            <div>
              {rolesLoaded && roles.length > 0 ? (
                <DropdownField
                  label="Current role"
                  options={roles}
                  initialValue={formData.current_role_id || ''}
                  onChange={(value) => setFormData((prev) => ({ ...prev, current_role_id: value }))}
                  key={`current_role_${formData.id || 'new'}`}
                />
              ) : (
                !rolesFailed && <StatusNotice tone="loading" title="Loading roles" />
              )}
            </div>,
            <div>
              {rolesLoaded && roles.length > 0 ? (
                <DropdownField
                  label="Default role"
                  options={roles}
                  initialValue={formData.default_role_id || ''}
                  onChange={(value) => setFormData((prev) => ({ ...prev, default_role_id: value }))}
                  key={`default_role_${formData.id || 'new'}`}
                />
              ) : (
                !rolesFailed && <StatusNotice tone="loading" title="Loading roles" />
              )}
            </div>
          ]}
          space={2}
        />

        {roleById(formData.role_id)?.role_name === 'ug_student' && (
          <>
            <h3 className="user-form-section-label">URF details</h3>
            <GridContainer
              elements={[
                <InputField
                  label="Roll number"
                  initialValue={formData.roll_no || ''}
                  onChange={(value) => setFormData((prev) => ({ ...prev, roll_no: value }))}
                />,
                <DropdownField
                  label="Branch"
                  options={branches}
                  initialValue={formData.branch_id || ''}
                  onChange={(value) => setFormData((prev) => ({ ...prev, branch_id: value }))}
                  key={`branch_${formData.id || 'new'}`}
                />,
                <DropdownField
                  label="Year of study (blank counts from the roll number)"
                  options={[1, 2, 3, 4].map((year) => ({ title: `${year} Year`, value: year }))}
                  initialValue={formData.year || ''}
                  onChange={(value) => setFormData((prev) => ({ ...prev, year: value }))}
                  key={`ug_year_${formData.id || 'new'}`}
                />,
              ]}
              space={3}
            />
          </>
        )}

        <div className="user-form-row">
          <p className="user-form-block-label" id="user-form-available-roles">
            Available roles (select multiple)
          </p>
          <StatusNotice tone="warning">
            Ticking a role here grants it, but does not create the record it depends on.
            <strong>Hod</strong>, <strong>Phd_coordinator</strong> and <strong>Adordc</strong> are
            assigned from the Departments page, <strong>Clerk</strong> from Clerk Management.
            <strong>Faculty</strong>-type roles need a faculty record and <strong>Student</strong>
            needs a student record. Until those exist the user cannot switch into the role.
          </StatusNotice>
          <div className="user-form-role-grid" role="group" aria-labelledby="user-form-available-roles">
            {allRoleOptions.map(roleName => (
              <label
                key={roleName}
                className={'user-form-role' + (formData.available_roles.includes(roleName) ? ' is-chosen' : '')}
              >
                <input
                  type="checkbox"
                  checked={formData.available_roles.includes(roleName)}
                  onChange={() => toggleAvailableRole(roleName)}
                  className="user-form-check"
                />
                <span className="user-form-role-name">
                  {roleName}
                </span>
              </label>
            ))}
          </div>
        </div>

        {!edit && (
          <div className="user-form-row">
            <InputField
              label="Custom password (optional, min 8 characters)"
              type="password"
              initialValue={customPassword}
              isLocked={false}
              onChange={(value) => setCustomPassword(value)}
              key="password_new"
            />
            <p className="user-form-hint">
              Leave empty and they are emailed a link to set their own
            </p>
          </div>
        )}

        <div className="modal-actions">
          <CustomButton text="Cancel" variant="quiet" onClick={onClose} />
          <CustomButton
            type="submit"
            text={loading ? 'Saving...' : (edit ? 'Update user' : 'Create user')}
            disabled={loading}
          />
        </div>
      </form>

      {edit && (
        <div className="user-form-password">
          <h3 className="user-form-section-label">Password management</h3>
          
          {!showPasswordSection ? (
            <div className="user-form-button-row">
              <CustomButton
                text="Set custom password"
                variant="secondary"
                onClick={() => setShowPasswordSection(true)}
              />
              <CustomButton
                text="Send password reset email"
                variant="secondary"
                onClick={handleSendResetEmail}
                disabled={loading}
              />
            </div>
          ) : (
            <div>
              <InputField
                label="New password (min 8 characters)"
                type="password"
                initialValue={customPassword}
                isLocked={false}
                onChange={(value) => setCustomPassword(value)}
                key={`reset_password_${formData.id}`}
              />
              <div className="user-form-button-row user-form-button-row--spaced">
                <CustomButton
                  text="Cancel"
                  variant="quiet"
                  onClick={() => {
                    setShowPasswordSection(false);
                    setCustomPassword('');
                  }}
                />
                <CustomButton
                  text={loading ? 'Resetting...' : 'Reset password'}
                  variant="secondary"
                  onClick={handleResetPassword}
                  disabled={loading || !customPassword || customPassword.length < 8}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserForm;

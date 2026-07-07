import React, { useState, useEffect } from 'react';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import { toast } from 'react-toastify';
import CustomButton from '../forms/fields/CustomButton';
import InputField from '../forms/fields/InputField';
import DropdownField from '../forms/fields/DropdownField';
import GridContainer from '../forms/fields/GridContainer';
import './UserForm.css';

const UserForm = ({ edit, userData, onClose }) => {
  const [formData, setFormData] = useState({
    id: null,
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    gender: '',
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

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    if (edit && userData && rolesLoaded) {
      setFormData({
        id: userData.id,
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        email: userData.email || '',
        phone: userData.phone || '',
        gender: userData.gender || '',
        role_id: userData.role_id || '',
        current_role_id: userData.current_role_id || '',
        default_role_id: userData.default_role_id || '',
        available_roles: userData.available_roles || [],
        status: userData.status || 'active',
        password: '',
      });
    } else if (!edit) {
      // Reset form for new user
      setFormData({
        id: null,
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        gender: '',
        role_id: '',
        current_role_id: '',
        default_role_id: '',
        available_roles: [],
        status: 'active',
        password: '',
      });
    }
  }, [edit, userData, rolesLoaded]);

  const fetchRoles = async () => {
    try {
      const response = await customFetch(baseURL + '/roles', 'GET');
      const roleData = response.response.map(r => ({
        value: r.id,
        title: r.role.charAt(0).toUpperCase() + r.role.slice(1),
        role_name: r.role
      }));
      setRoles(roleData);
      setAllRoleOptions(roleData.map(r => r.role_name));
      setRolesLoaded(true);
    } catch (error) {
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

      if (response.password) {
        toast.success(`User ${edit ? 'updated' : 'created'} successfully! Password: ${response.password}`);
      } else {
        toast.success(`User ${edit ? 'updated' : 'created'} successfully!`);
      }
      
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
      await customFetch(
        baseURL + `/users/${formData.id}/reset-password`,
        'POST',
        { password: customPassword },
        true
      );
      toast.success('Password reset successfully!');
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
      await customFetch(
        baseURL + `/users/${formData.id}/send-reset-email`,
        'POST',
        {},
        true
      );
      toast.success('Password reset email sent successfully!');
    } catch (error) {
      toast.error('Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (roleId) => {
    const selectedRole = roles.find(r => r.value === roleId);
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
      <h2>{edit ? 'Edit User' : 'Create New User'}</h2>
      
      <form onSubmit={handleSubmit}>
        <GridContainer
          elements={[
            <InputField
              label="First Name *"
              initialValue={formData.first_name}
              isLocked={false}
              onChange={(value) => setFormData({ ...formData, first_name: value })}
              key={`first_name_${formData.id || 'new'}`}
            />,
            <InputField
              label="Last Name"
              initialValue={formData.last_name}
              isLocked={false}
              onChange={(value) => setFormData({ ...formData, last_name: value })}
              key={`last_name_${formData.id || 'new'}`}
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
              onChange={(value) => setFormData({ ...formData, email: value })}
              key={`email_${formData.id || 'new'}`}
            />,
            <InputField
              label="Phone *"
              initialValue={formData.phone}
              isLocked={false}
              onChange={(value) => setFormData({ ...formData, phone: value })}
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
              onChange={(value) => setFormData({ ...formData, gender: value })}
              key={`gender_${formData.id || 'new'}`}
            />,
            <DropdownField
              label="Status"
              options={statusOptions}
              initialValue={statusOptions.find(s => s.value === formData.status)?.title || 'Active'}
              onChange={(value) => setFormData({ ...formData, status: value })}
              key={`status_${formData.id || 'new'}`}
            />,
          ]}
          space={2}
        />

        <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
          <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
            Main Role *
          </label>
          {rolesLoaded && roles.length > 0 ? (
            <DropdownField
              options={roles}
              initialValue={formData.role_id ? roles.find(r => r.value === formData.role_id)?.title : ''}
              onChange={handleRoleChange}
              key={`role_${formData.id || 'new'}`}
            />
          ) : (
            <p>Loading roles...</p>
          )}
        </div>

        <GridContainer
          elements={[
            <div>
              {rolesLoaded && roles.length > 0 ? (
                <DropdownField
                  label="Current Role"
                  options={roles}
                  initialValue={formData.current_role_id ? roles.find(r => r.value === formData.current_role_id)?.title : ''}
                  onChange={(value) => setFormData({ ...formData, current_role_id: value })}
                  key={`current_role_${formData.id || 'new'}`}
                />
              ) : (
                <p>Loading...</p>
              )}
            </div>,
            <div>
              {rolesLoaded && roles.length > 0 ? (
                <DropdownField
                  label="Default Role"
                  options={roles}
                  initialValue={formData.default_role_id ? roles.find(r => r.value === formData.default_role_id)?.title : ''}
                  onChange={(value) => setFormData({ ...formData, default_role_id: value })}
                  key={`default_role_${formData.id || 'new'}`}
                />
              ) : (
                <p>Loading...</p>
              )}
            </div>
          ]}
          space={2}
        />

        <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
          <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
            Available Roles (Select multiple)
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '0.5rem',
            padding: '1rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            background: '#f9fafb'
          }}>
            {allRoleOptions.map(roleName => (
              <label
                key={roleName}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '0.25rem',
                  background: formData.available_roles.includes(roleName) ? '#dbeafe' : 'white',
                  border: '1px solid',
                  borderColor: formData.available_roles.includes(roleName) ? '#3b82f6' : '#d1d5db',
                  transition: 'all 0.2s'
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.available_roles.includes(roleName)}
                  onChange={() => toggleAvailableRole(roleName)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.875rem', textTransform: 'capitalize' }}>
                  {roleName}
                </span>
              </label>
            ))}
          </div>
        </div>

        {!edit && (
          <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
            <InputField
              label="Custom Password (Optional, min 8 characters)"
              type="password"
              initialValue={customPassword}
              isLocked={false}
              onChange={(value) => setCustomPassword(value)}
              key="password_new"
            />
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Leave empty to auto-generate a password
            </p>
          </div>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '1rem',
          marginTop: '1.5rem'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'white',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <CustomButton
            type="submit"
            text={loading ? 'Saving...' : (edit ? 'Update User' : 'Create User')}
            disabled={loading}
          />
        </div>
      </form>

      {edit && (
        <div style={{
          marginTop: '2rem',
          paddingTop: '2rem',
          borderTop: '2px solid #e5e7eb'
        }}>
          <h3 style={{ marginBottom: '1rem' }}>Password Management</h3>
          
          {!showPasswordSection ? (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowPasswordSection(true)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Set Custom Password
              </button>
              <button
                onClick={handleSendResetEmail}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  opacity: loading ? 0.6 : 1
                }}
              >
                Send Password Reset Email
              </button>
            </div>
          ) : (
            <div>
              <InputField
                label="New Password (min 8 characters)"
                type="password"
                initialValue={customPassword}
                isLocked={false}
                onChange={(value) => setCustomPassword(value)}
                key={`reset_password_${formData.id}`}
              />
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button
                  onClick={() => {
                    setShowPasswordSection(false);
                    setCustomPassword('');
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'white',
                    color: '#6b7280',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={loading || !customPassword || customPassword.length < 8}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: loading || !customPassword || customPassword.length < 8 ? '#9ca3af' : '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: loading || !customPassword || customPassword.length < 8 ? 'not-allowed' : 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserForm;

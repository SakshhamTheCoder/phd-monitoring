import React, { useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../forms/fields/CustomButton';
import InputField from '../forms/fields/InputField';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import './ChangePassword.css';

/**
 * Changing your own password, whatever your role.
 *
 * An account made through Google sign-up holds a random password nobody chose,
 * so there is no current one to ask for and being signed in is the proof. The
 * server decides that, and says so through `password_set` at sign-in.
 */
const ChangePassword = ({ onDone }) => {
  const user = JSON.parse(localStorage.getItem('user')) || {};
  // Anything but an explicit false means the account has a password already.
  const hasPassword = user.password_set !== false;

  const [body, setBody] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [saving, setSaving] = useState(false);

  const set = (key) => (value) => setBody((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (body.password.length < 8) {
      toast.error('Your new password must be at least 8 characters.');
      return;
    }
    if (body.password !== body.password_confirmation) {
      toast.error('The two new passwords do not match.');
      return;
    }

    setSaving(true);
    const res = await customFetch(`${baseURL}/change-password`, 'POST', body, true);
    setSaving(false);
    if (!res.success) return;

    localStorage.setItem('user', JSON.stringify({ ...user, password_set: true }));
    toast.success(hasPassword ? 'Your password is changed.' : 'Your password is set. You can now sign in with it.');
    onDone();
  };

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>{hasPassword ? 'Change password' : 'Set a password'}</h3>
      {!hasPassword && (
        <p style={{ color: '#4b5563', fontSize: '0.9rem' }}>
          You signed up with Google, so this account has no password yet. Setting one lets you sign
          in with your email as well.
        </p>
      )}

      {/* One field per row: the shared grid is three columns wide, which a
          modal this narrow cannot carry. */}
      <div className="change-password-fields">
        {hasPassword && (
          <InputField
            label="Current password"
            type="password"
            initialValue={body.current_password}
            onChange={set('current_password')}
            required
          />
        )}
        <InputField
          label="New password"
          type="password"
          initialValue={body.password}
          onChange={set('password')}
          required
        />
        <InputField
          label="Confirm new password"
          type="password"
          initialValue={body.password_confirmation}
          onChange={set('password_confirmation')}
          required
        />
      </div>

      <div className="change-password-actions">
        <CustomButton
          text={saving ? 'Saving…' : (hasPassword ? 'Change password' : 'Set password')}
          onClick={save}
          disabled={saving}
        />
      </div>
    </div>
  );
};

export default ChangePassword;

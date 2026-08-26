import React, { useEffect, useState } from 'react';
import Layout from '../../components/dashboard/layout';
import { toast } from 'react-toastify';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import CustomButton from '../../components/forms/fields/CustomButton';
import CustomModal from '../../components/forms/modal/CustomModal';
import './ClerkManagement.css';

/**
 * Admin-side clerk management. A clerk is just a user account holding the
 * 'clerk' role (created like any other user from Manage Users); this page only
 * handles the department tagging that makes the role usable.
 */
const ClerkManagement = () => {
  const [clerks, setClerks] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  // Which clerk's tagging editor is open: null (closed) or the clerk object.
  const [editing, setEditing] = useState(null);
  // Draft of the department ids the open clerk should end up tagged with.
  const [selectedDeptIds, setSelectedDeptIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const loadClerks = async () => {
    setLoading(true);
    const res = await customFetch(baseURL + '/clerks', 'GET', {}, true);
    setLoading(false);
    if (res.success) setClerks(res.response.data || []);
  };

  useEffect(() => {
    loadClerks();
    customFetch(baseURL + '/departments', 'GET', {}, false).then((res) => {
      if (res.success) setDepartments(res.response.data || []);
    });
  }, []);

  const openEditor = (clerk) => {
    setEditing(clerk);
    setSelectedDeptIds(clerk.departments.map((d) => d.department_id));
  };

  const toggleDepartment = (deptId) => {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId)
        ? prev.filter((id) => id !== deptId)
        : [...prev, deptId]
    );
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await customFetch(
      baseURL + `/clerks/${editing.id}/departments`,
      'POST',
      { department_ids: selectedDeptIds },
      true
    );
    setSaving(false);
    if (res.success) {
      toast.success(res.response.message || 'Departments updated');
      setEditing(null);
      loadClerks();
    }
  };

  return (
    <Layout>
      <div className="clerk-management">
        <div className="clerk-header">
          <h2>Clerk Management</h2>
          <p className="clerk-hint">
            Create clerk logins from Manage Users (role: <code>clerk</code>), then tag them with
            the departments whose PhD attendance they mark.
          </p>
        </div>

        <div className="clerk-table-wrap">
          <table className="clerk-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Departments</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="clerk-loading">Loading…</td></tr>
              ) : clerks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="clerk-loading">
                    No clerk accounts yet. Add a user with the &quot;clerk&quot; role first.
                  </td>
                </tr>
              ) : (
                clerks.map((clerk) => (
                  <tr key={clerk.id}>
                    <td>{clerk.name}</td>
                    <td>{clerk.email}</td>
                    <td>
                      <div className="dept-chips">
                        {clerk.departments.length === 0 ? (
                          <span className="dept-none">Not assigned</span>
                        ) : (
                          clerk.departments.map((d) => (
                            <span key={d.department_id} className="dept-chip">{d.name}</span>
                          ))
                        )}
                      </div>
                    </td>
                    <td>
                      <CustomButton text="Edit Departments" variant="secondary" onClick={() => openEditor(clerk)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <CustomModal isOpen={!!editing} onClose={() => setEditing(null)} title={`Departments for ${editing?.name || ''}`} width="560px">
          <div className="dept-picker">
            <p>Select every department this clerk marks attendance for:</p>
            <div className="dept-options">
              {departments.length === 0 && <span className="dept-none">No departments found.</span>}
              {departments.map((d) => (
                <label key={d.id} className="dept-option">
                  <input
                    type="checkbox"
                    checked={selectedDeptIds.includes(d.id)}
                    onChange={() => toggleDepartment(d.id)}
                  />
                  <span>{d.name} {d.code ? `(${d.code})` : ''}</span>
                </label>
              ))}
            </div>
            <div className="dept-picker-actions">
              <CustomButton text="Cancel" variant="secondary" onClick={() => setEditing(null)} />
              <CustomButton text={saving ? 'Saving…' : 'Save'} onClick={handleSave} disabled={saving} />
            </div>
          </div>
        </CustomModal>
      </div>
    </Layout>
  );
};

export default ClerkManagement;

import React, { useEffect, useState } from 'react';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import { toast } from 'react-toastify';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import CustomButton from '../../components/forms/fields/CustomButton';
import CustomModal from '../../components/forms/modal/CustomModal';

/**
 * Admin-side clerk management. A clerk is just a user account holding the
 * 'clerk' role (created from Manage Users as Office/Admin -> Clerk); this page
 * only handles the department tagging that makes the role usable.
 */
const ClerkManagement = () => {
  const [clerks, setClerks] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
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
      <PageHeader
        title="Clerk Management"
        subtitle="Create clerk logins from Manage Users (Office / Admin → Clerk), then tag them with the departments whose PhD attendance they mark."
      />

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : clerks.length === 0 ? (
        <div className="empty-state">
          No clerk accounts yet. Add a user with the “clerk” role from Manage Users first.
        </div>
      ) : (
        <div className="form-list-container">
          <table className="form-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Departments</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clerks.map((clerk) => (
                <tr key={clerk.id}>
                  <td>{clerk.name}</td>
                  <td>{clerk.email}</td>
                  <td>
                    {clerk.departments.length === 0 ? (
                      <span className="badge badge--neutral">Not assigned</span>
                    ) : (
                      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {clerk.departments.map((d) => (
                          <span key={d.department_id} className="badge badge--blue">
                            {d.name}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td>
                    <CustomButton
                      text="Manage"
                      variant="secondary"
                      onClick={() => openEditor(clerk)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CustomModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={`Departments for ${editing?.name || ''}`}
        width="560px"
      >
        <p className="modal-note" style={{ marginTop: 0 }}>
          Select every department this clerk marks attendance for. Saved departments are the only ones whose scholars appear on the clerk’s attendance roster.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '0.5rem',
            padding: '1rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            background: '#f9fafb',
            maxHeight: '50vh',
            overflowY: 'auto',
          }}
        >
          {departments.length === 0 ? (
            <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No departments found.</span>
          ) : (
            departments.map((d) => (
              <label
                key={d.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '0.25rem',
                  background: selectedDeptIds.includes(d.id) ? '#dbeafe' : 'white',
                  border: '1px solid',
                  borderColor: selectedDeptIds.includes(d.id) ? 'var(--primary-color)' : '#d1d5db',
                  transition: 'all 0.2s',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedDeptIds.includes(d.id)}
                  onChange={() => toggleDepartment(d.id)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.875rem' }}>
                  {d.name} {d.code ? `(${d.code})` : ''}
                </span>
              </label>
            ))
          )}
        </div>
        <div className="modal-actions">
          <CustomButton text="Cancel" variant="secondary" onClick={() => setEditing(null)} />
          <CustomButton text={saving ? 'Saving…' : 'Save'} onClick={handleSave} disabled={saving} />
        </div>
      </CustomModal>
    </Layout>
  );
};

export default ClerkManagement;

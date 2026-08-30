import React, { useEffect, useState, useMemo } from 'react';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import FilterBar from '../../components/filterBar/FilterBar';
import { toast } from 'react-toastify';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import CustomButton from '../../components/forms/fields/CustomButton';
import CustomModal from '../../components/forms/modal/CustomModal';
import ClerkForm from '../../components/clerkForm/ClerkForm';

/**
 * Admin → Clerk Management
 *
 * Mirrors StudentsPage / FacultyPage / UsersPage:
 *  - Layout + PageHeader (+ actions)
 *  - FilterBar → client-side filter (clerks endpoint is small and not paginated)
 *  - form-list-container / form-table + row-actions kebab + badges + empty-state
 *  - CustomModal (80vw create, 560px manage) + modal-note + modal-actions + CustomButton
 *  - Department picker reuses the available_roles grid pattern from UserForm
 */
const ClerkManagement = () => {
  const [clerks, setClerks] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filter, setFilter] = useState({ conditions: [] });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [selectedDeptIds, setSelectedDeptIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);

  const loadClerks = async () => {
    setLoading(true);
    const res = await customFetch(baseURL + '/clerks', 'GET', {}, true);
    setLoading(false);
    if (res.success) setClerks(res.response.data || []);
  };

  useEffect(() => {
    loadClerks();
    customFetch(baseURL + '/departments?rows=200', 'GET', {}, false).then((res) => {
      if (res.success) setDepartments(res.response.data || []);
    });
  }, []);

  // Close row-actions dropdown on outside click — same as PagenationTable:9
  useEffect(() => {
    if (openMenu === null) return;
    const close = () => setOpenMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenu]);

  const openEditor = (clerk) => {
    setEditing(clerk);
    setSelectedDeptIds(clerk.departments.map((d) => d.department_id));
  };

  const toggleDepartment = (deptId) => {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
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

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter || { conditions: [] });
  };

  // Client-side filter — mirrors FilterBar shape (combine + conditions[]) but
  // applied locally so the page feels like Students/Faculty without needing a
  // server-side /clerks/filters endpoint. Falls back to showing all when empty.
  const filteredClerks = useMemo(() => {
    const conds = filter.conditions || [];
    if (conds.length === 0) return clerks;
    return clerks.filter((c) => {
      const hay = `${c.name} ${c.email} ${c.phone} ${c.departments.map((d) => d.name).join(' ')}`.toLowerCase();
      return conds.every((cond) => {
        const val = String(cond.value || '').toLowerCase();
        if (!val) return true;
        const op = cond.op || '=';
        if (op === 'LIKE') return hay.includes(val);
        if (op === '!=') return !hay.includes(val);
        return hay.includes(val);
      });
    });
  }, [clerks, filter]);

  const closeCreate = (saved = false) => {
    setIsCreateOpen(false);
    if (saved) loadClerks();
  };

  return (
    <Layout>
      <PageHeader
        title="Clerk Management"
        subtitle="Create clerk logins and tag them with the departments whose PhD attendance they mark."
        actions={<CustomButton text="Add Clerk +" onClick={() => setIsCreateOpen(true)} />}
      />

      <FilterBar onSearch={handleFilterChange} />

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : filteredClerks.length === 0 ? (
        <div className="empty-state">
          {clerks.length === 0
            ? 'No clerk accounts yet. Add a user with the “clerk” role from Manage Users first.'
            : 'No clerks match the current filters.'}
        </div>
      ) : (
        <div className="form-list-container">
          <table className="form-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Name</th>
                <th>Email</th>
                <th>Departments</th>
                <th>Actions</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredClerks.map((clerk, idx) => (
                <tr key={clerk.id} className="form-row row-link" tabIndex={0}>
                  <td>{idx + 1}</td>
                  <td>{clerk.name}</td>
                  <td>{clerk.email}</td>
                  <td>
                    {clerk.departments.length === 0 ? (
                      <span style={{ color: 'var(--text-subtle)', fontStyle: 'italic' }}>Not assigned</span>
                    ) : (
                      clerk.departments.map((d) => d.name).join(', ')
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="row-actions-trigger"
                        title="Actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenu(openMenu === idx ? null : idx);
                        }}
                      >
                        <i className="fa-solid fa-ellipsis-vertical"></i>
                      </button>
                      {openMenu === idx && (
                        <div className="row-actions-menu" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="row-actions-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenu(null);
                              openEditor(clerk);
                            }}
                          >
                            <span className="ra-icon">
                              <i className="fa-solid fa-users-gear"></i>
                            </span>
                            <span>Manage Departments</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="row-go" title="Manage">
                    <i className="fa fa-angle-right"></i>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CustomModal
        isOpen={isCreateOpen}
        onClose={() => closeCreate(false)}
        width="80vw"
      >
        <ClerkForm
          onSuccess={() => closeCreate(true)}
          onClose={() => closeCreate(true)}
        />
      </CustomModal>

      <CustomModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={`Departments for ${editing?.name || ''}`}
        width="560px"
      >
        <p className="modal-note" style={{ marginTop: 0 }}>
          Select every department this clerk marks attendance for. Saved departments are the only ones whose scholars appear on the clerk&apos;s attendance roster.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '0.5rem',
            padding: '1rem',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius)',
            background: '#f9fafb',
            maxHeight: '50vh',
            overflowY: 'auto',
          }}
        >
          {departments.length === 0 ? (
            <span style={{ color: 'var(--text-subtle)', fontStyle: 'italic' }}>No departments found.</span>
          ) : (
            departments.map((d) => {
              const selected = selectedDeptIds.includes(d.id);
              return (
                <label
                  key={d.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    borderRadius: '0.25rem',
                    background: selected ? '#DBEAFE' : 'white',
                    border: '1px solid',
                    borderColor: selected ? 'var(--primary-color)' : 'var(--border-color)',
                    transition: 'all 0.2s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleDepartment(d.id)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.875rem' }}>
                    {d.name} {d.code ? `(${d.code})` : ''}
                  </span>
                </label>
              );
            })
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

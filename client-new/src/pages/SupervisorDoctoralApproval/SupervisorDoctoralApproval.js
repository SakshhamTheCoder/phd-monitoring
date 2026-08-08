import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';

import CustomButton from '../../components/forms/fields/CustomButton';
import CustomModal from '../../components/forms/modal/CustomModal';
import GridContainer from '../../components/forms/fields/GridContainer';
import InputField from '../../components/forms/fields/InputField';
import Layout from '../../components/dashboard/layout';

const SupervisorDoctoralApproval = () => {
  const [pendingChanges, setPendingChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedChange, setSelectedChange] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchPendingChanges = async () => {
    setLoading(true);
    try {
      const response = await customFetch(
        `${baseURL}/supervisor-doctoral-changes/pending`,
        'GET',
        {},
        false,
        false
      );

      if (response?.success) {
        setPendingChanges(response.response?.data || []);
      } else {
        toast.error('Failed to fetch pending changes');
      }
    } catch (error) {
      console.error('Error fetching pending changes:', error);
      toast.error('Error loading pending changes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingChanges();
  }, []);

  const handleApprove = async (changeId) => {
    if (!window.confirm('Are you sure you want to approve this change?')) {
      return;
    }

    try {
      const response = await customFetch(
        `${baseURL}/supervisor-doctoral-changes/approve/${changeId}`,
        'PUT',
        {},
        false,
        false
      );

      if (response?.success) {
        toast.success('Change approved successfully');
        fetchPendingChanges(); // Refresh the list
      } else {
        toast.error(response?.message || 'Failed to approve change');
      }
    } catch (error) {
      console.error('Error approving change:', error);
      toast.error('Error approving change');
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    try {
      const response = await customFetch(
        `${baseURL}/supervisor-doctoral-changes/reject/${selectedChange.id}`,
        'PUT',
        { reason: rejectReason },
        false,
        false
      );

      if (response?.success) {
        toast.success('Change rejected successfully');
        setShowRejectModal(false);
        setRejectReason('');
        setSelectedChange(null);
        fetchPendingChanges(); // Refresh the list
      } else {
        toast.error(response?.message || 'Failed to reject change');
      }
    } catch (error) {
      console.error('Error rejecting change:', error);
      toast.error('Error rejecting change');
    }
  };

  const openRejectModal = (change) => {
    setSelectedChange(change);
    setShowRejectModal(true);
  };

  const getChangeDescription = (change) => {
    const memberType = change.member_type === 'supervisor' ? 'Supervisor' : 'Doctoral Committee Member';
    
    if (change.change_type === 'add') {
      const facultyName = change.new_member 
        ? change.new_member.name
        : (change.faculty_type === 'internal' ? 'Internal Faculty' : 'External Expert');
      return `Add ${memberType}: ${facultyName}`;
    } else if (change.change_type === 'remove') {
      const facultyName = change.old_member ? change.old_member.name : 'Unknown';
      return `Remove ${memberType}: ${facultyName}`;
    } else if (change.change_type === 'replace') {
      const oldFaculty = change.old_member ? change.old_member.name : 'Unknown';
      const newFaculty = change.new_member ? change.new_member.name : 'Unknown';
      return `Replace ${memberType}: ${oldFaculty} → ${newFaculty}`;
    }
    
    return 'Unknown Change';
  };

  const tableData = pendingChanges.map(change => ({
    student: change.student_name || 'Unknown',
    roll_no: change.student_roll_no || '—',
    department: change.department || '—',
    change: getChangeDescription(change),
    reason: change.reason || '—',
    requested_by: change.requested_by || 'Unknown',
    requested_at: change.requested_at ? new Date(change.requested_at).toLocaleDateString() : '—',
    actions: (
      <GridContainer
        space={1}
        elements={[
          <CustomButton
            text="Approve"
            onClick={() => handleApprove(change.id)}
          />,
          <CustomButton
            text="Reject"
            variant="danger"
            onClick={() => openRejectModal(change)}
          />
        ]}
      />
    )
  }));

  return (
    <Layout>
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Supervisor &amp; Doctoral Committee Change Approvals</h1>
          <p className="page-subtitle">
            Review and approve/reject pending change requests from HOD and PhD Coordinators
          </p>
        </div>
      </div>

      <CustomButton
        text="Refresh"
        onClick={fetchPendingChanges}
        style={{ marginBottom: '1rem' }}
      />

      {loading ? (
        <p>Loading pending changes...</p>
      ) : pendingChanges.length === 0 ? (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#f9fafb',
          borderRadius: '0.5rem',
          border: '1px solid #e5e7eb'
        }}>
          <p style={{ fontSize: '1.125rem', color: '#6b7280' }}>
            No pending changes to review
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>S.No</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Student</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Roll No</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Department</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Change Description</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Reason</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Requested By</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Requested Date</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem' }}>{index + 1}</td>
                  <td style={{ padding: '0.75rem' }}>{row.student}</td>
                  <td style={{ padding: '0.75rem' }}>{row.roll_no}</td>
                  <td style={{ padding: '0.75rem' }}>{row.department}</td>
                  <td style={{ padding: '0.75rem' }}>{row.change}</td>
                  <td style={{ padding: '0.75rem' }}>{row.reason}</td>
                  <td style={{ padding: '0.75rem' }}>{row.requested_by}</td>
                  <td style={{ padding: '0.75rem' }}>{row.requested_at}</td>
                  <td style={{ padding: '0.75rem' }}>{row.actions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject Modal */}
      <CustomModal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectReason('');
          setSelectedChange(null);
        }}
      >
        <div style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Reject Change Request</h3>
          
          {selectedChange && (
            <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#fef2f2', borderRadius: '0.5rem' }}>
              <p><strong>Student:</strong> {selectedChange.student_name}</p>
              <p><strong>Change:</strong> {getChangeDescription(selectedChange)}</p>
              <p><strong>Requested By:</strong> {selectedChange.requested_by}</p>
            </div>
          )}
          
          <InputField
            label="Reason for Rejection"
            type="textarea"
            value={rejectReason}
            onChange={setRejectReason}
            placeholder="Please provide a reason for rejecting this change request..."
            rows={4}
          />

          <GridContainer
            space={2}
            elements={[
              <CustomButton
                text="Cancel"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setSelectedChange(null);
                }}
              />,
              <CustomButton
                text="Reject Change"
                variant="danger"
                onClick={handleReject}
              />
            ]}
            style={{ marginTop: '1.5rem' }}
          />
        </div>
      </CustomModal>
    </div>
    </Layout>
  );
};

export default SupervisorDoctoralApproval;

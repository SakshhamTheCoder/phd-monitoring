import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import GridContainer from '../forms/fields/GridContainer';
import CustomButton from '../forms/fields/CustomButton';
import CustomModal from '../forms/modal/CustomModal';
import InputSuggestions from '../forms/fields/InputSuggestions';
import DropdownField from '../forms/fields/DropdownField';
import TableComponent from '../forms/table/TableComponent';
import { facultyNameCell } from '../facultyLink/FacultyLink';
import Panel, { PanelSection } from '../panel/Panel';
import StatusNotice from '../common/StatusNotice';


const SupervisorDoctoralManager = ({ studentId, supervisors = [], doctoralCommittee = [], onClose }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [changeType, setChangeType] = useState(null); // 'supervisor' or 'doctoral'
  const [operationType, setOperationType] = useState('add'); // 'add', 'remove', 'replace'
  const [facultyType, setFacultyType] = useState('internal');
  const [selectedOldMember, setSelectedOldMember] = useState(null);
  const [selectedNewFaculty, setSelectedNewFaculty] = useState(null);
  const [selectedOutsideExpert, setSelectedOutsideExpert] = useState(null);
  const [reason, setReason] = useState('');
  const [pendingChanges, setPendingChanges] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPendingChanges();
  }, [studentId]);

  const fetchPendingChanges = async () => {
    try {
      const response = await customFetch(
        `${baseURL}/supervisor-doctoral-changes/student/${studentId}/pending`,
        'GET'
      );
      if (response.success) {
        setPendingChanges(response.response.data || []);
      }
    } catch (error) {
      console.error('Error fetching pending changes:', error);
    }
  };

  const handleProposeChange = async () => {
    if (!changeType || !operationType) {
      toast.error('Please select change type and operation');
      return;
    }

    if (operationType === 'remove' && !selectedOldMember) {
      toast.error('Please select a member to remove');
      return;
    }

    if (operationType !== 'remove' && !facultyType) {
      toast.error('Please select a faculty type');
      return;
    }

    if (operationType === 'add') {
      if (facultyType === 'internal' && !selectedNewFaculty) {
        toast.error('Please select a faculty member');
        return;
      }
      if (facultyType === 'external' && !selectedOutsideExpert) {
        toast.error('Please select an outside expert');
        return;
      }
    }

    if (operationType === 'replace') {
      if (!selectedOldMember) {
        toast.error('Please select a member to replace');
        return;
      }
      if (facultyType === 'internal' && !selectedNewFaculty) {
        toast.error('Please select a new faculty member');
        return;
      }
      if (facultyType === 'external' && !selectedOutsideExpert) {
        toast.error('Please select a new outside expert');
        return;
      }
    }

    const payload = {
      student_id: studentId,
      change_type: operationType,
      member_type: changeType,
      faculty_type: facultyType,
      old_faculty_code: selectedOldMember,
      new_faculty_code: facultyType === 'internal' ? selectedNewFaculty : null,
      outside_expert_id: facultyType === 'external' ? selectedOutsideExpert : null,
      reason: reason,
    };

    try {
      setLoading(true);
      const response = await customFetch(
        `${baseURL}/supervisor-doctoral-changes/propose`,
        'POST',
        payload,
        false
      );

      if (response.success) {
        const message = response.response?.message || 'Change request submitted successfully';
        toast.success(message);
        setShowAddModal(false);
        resetForm();
        fetchPendingChanges();
        // If admin or doctoral applied directly, also call onClose to refresh parent
        if (message.includes('direct change')) {
          onClose();
        }
      } else {
        toast.error(response.response?.message || 'Failed to submit change request');
      }
    } catch (error) {
      console.error('Error proposing change:', error);
      toast.error('Failed to submit change request');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setChangeType(null);
    setOperationType('add');
    setFacultyType('internal');
    setSelectedOldMember(null);
    setSelectedNewFaculty(null);
    setSelectedOutsideExpert(null);
    setReason('');
  };

  const openAddModal = (type) => {
    setChangeType(type);
    setOperationType('add');
    setShowAddModal(true);
  };

  const openRemoveModal = (type, facultyCode) => {
    setChangeType(type);
    setOperationType('remove');
    setSelectedOldMember(facultyCode);
    setShowAddModal(true);
  };

  const openReplaceModal = (type, facultyCode) => {
    setChangeType(type);
    setOperationType('replace');
    setSelectedOldMember(facultyCode);
    setShowAddModal(true);
  };

  const supervisorTableData = supervisors.map((sup) => ({
    ...sup,
    faculty_code: sup.faculty_code || sup.id,
    actions: { faculty_code: sup.faculty_code || sup.id, type: 'supervisor' },
  }));

  const doctoralTableData = doctoralCommittee.map((doc) => ({
    ...doc,
    faculty_code: doc.faculty_code || doc.id,
    actions: { faculty_code: doc.faculty_code || doc.id, type: 'doctoral' },
  }));

  return (
    <>
      <h2 className="modal-title">Manage supervisors and doctoral committee</h2>

      {pendingChanges.length > 0 && (
        <StatusNotice tone="warning" title="Pending approval">
          {pendingChanges.length} change request(s) awaiting DORDC approval
        </StatusNotice>
      )}

      {/* Remove only proposes a change for approval, it deletes nothing, so it
          is drawn as quietly as Replace. */}
      <Panel>
        <PanelSection
          title="Supervisors"
          actions={
            <CustomButton
              text="Add supervisor"
              variant="secondary"
              size="sm"
              onClick={() => openAddModal('supervisor')}
            />
          }
        >
          <TableComponent
            data={supervisorTableData}
            keys={['name', 'email', 'phone', 'designation', 'actions']}
            titles={['Name', 'Email', 'Phone', 'Designation', 'Actions']}
            components={[
              facultyNameCell,
              {
                key: 'actions',
                component: ({ row }) => (
                  <div className="row-actions-inline">
                    <CustomButton
                      text="Replace"
                      variant="quiet"
                      size="sm"
                      onClick={() => openReplaceModal('supervisor', row.actions.faculty_code)}
                    />
                    <CustomButton
                      text="Remove"
                      variant="quiet"
                      size="sm"
                      onClick={() => openRemoveModal('supervisor', row.actions.faculty_code)}
                    />
                  </div>
                ),
              },
            ]}
          />
        </PanelSection>

        <PanelSection
          title="Doctoral committee"
          actions={
            <CustomButton
              text="Add member"
              variant="secondary"
              size="sm"
              onClick={() => openAddModal('doctoral')}
            />
          }
        >
          <TableComponent
            data={doctoralTableData}
            keys={['name', 'email', 'phone', 'designation', 'actions']}
            titles={['Name', 'Email', 'Phone', 'Designation', 'Actions']}
            components={[
              facultyNameCell,
              {
                key: 'actions',
                component: ({ row }) => (
                  <div className="row-actions-inline">
                    <CustomButton
                      text="Replace"
                      variant="quiet"
                      size="sm"
                      onClick={() => openReplaceModal('doctoral', row.actions.faculty_code)}
                    />
                    <CustomButton
                      text="Remove"
                      variant="quiet"
                      size="sm"
                      onClick={() => openRemoveModal('doctoral', row.actions.faculty_code)}
                    />
                  </div>
                ),
              },
            ]}
          />
        </PanelSection>
      </Panel>

      <CustomModal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); resetForm(); }}
        title={`${operationType === 'add' ? 'Add' : operationType === 'remove' ? 'Remove' : 'Replace'} ${changeType === 'supervisor' ? 'supervisor' : 'doctoral committee member'}`}
        maxWidth="600px"
        minHeight="auto"
      >
            
            {operationType !== 'remove' && (
              <>
                <GridContainer
                  elements={[
                    <DropdownField
                      label="Faculty Type*"
                      initialValue={facultyType}
                      options={[
                        { value: 'internal', title: 'Internal' },
                        { value: 'external', title: 'External' },
                      ]}
                      // A pick from the other type would otherwise still be
                      // held, and switching back proposed it unseen.
                      onChange={(val) => {
                        setFacultyType(val);
                        setSelectedNewFaculty(null);
                        setSelectedOutsideExpert(null);
                      }}
                    />,
                  ]}
                />

                {facultyType === 'internal' ? (
                  <GridContainer
                    elements={[
                      <InputSuggestions
                        label="Select Faculty*"
                        apiUrl={`${baseURL}/suggestions/faculty`}
                        onSelect={(val) => setSelectedNewFaculty(val.id)}
                        fields={['name', 'department', 'designation']}
                      />,
                    ]}
                  />
                ) : facultyType === 'external' && (
                  <GridContainer
                    elements={[
                      <InputSuggestions
                        label="Select Outside Expert*"
                        apiUrl={`${baseURL}/outside-experts/all`}
                        onSelect={(val) => setSelectedOutsideExpert(val.id)}
                        fields={['first_name', 'last_name', 'institution', 'designation']}
                      />,
                    ]}
                  />
                )}
              </>
            )}

            <GridContainer
              elements={[
                <textarea
                  className="input-field"
                  aria-label="Reason for change"
                  placeholder="Reason for change"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows="3"
                />
              ]}
            />
        <div className="modal-actions">
          <CustomButton
            text="Cancel"
            variant="quiet"
            onClick={() => { setShowAddModal(false); resetForm(); }}
          />
          <CustomButton
            text={loading ? 'Submitting...' : 'Submit request'}
            onClick={handleProposeChange}
            disabled={loading}
          />
        </div>
      </CustomModal>

      <div className="modal-actions">
        <CustomButton text="Close" variant="quiet" onClick={onClose} />
      </div>
    </>
  );
};

export default SupervisorDoctoralManager;

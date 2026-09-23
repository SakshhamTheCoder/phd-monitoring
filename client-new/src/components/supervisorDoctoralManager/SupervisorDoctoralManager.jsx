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
import OutsideExpertFields, { EMPTY_EXPERT } from '../outsideExperts/OutsideExpertFields';
import useCapabilities from '../../context/CapabilitiesContext';


/**
 * `outsideExpert` (undefined when the caller does not know it) adds the IRB
 * outside expert: with the doctoral committee, the IRB committee. It is set
 * directly, not proposed, and only when `canSetOutsideExpert`; the server
 * refuses anyone else. `onOutsideExpertSaved` refreshes the caller's copy.
 */
const SupervisorDoctoralManager = ({ studentId, supervisors = [], doctoralCommittee = [], onClose, outsideExpert, canSetOutsideExpert = false, onOutsideExpertSaved }) => {
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
  const [pickingExpert, setPickingExpert] = useState(false);
  const [expertPick, setExpertPick] = useState(null);
  const [savingExpert, setSavingExpert] = useState(false);
  // Adding to the expert list is the Outside Experts page's job, so only
  // someone who may manage that list is offered the shortcut here.
  const can = useCapabilities();
  const [addingExpert, setAddingExpert] = useState(false);
  const [newExpert, setNewExpert] = useState(EMPTY_EXPERT);
  const [creatingExpert, setCreatingExpert] = useState(false);

  const createOutsideExpert = async () => {
    setCreatingExpert(true);
    const res = await customFetch(`${baseURL}/outside-experts/add`, 'POST', newExpert, false);
    setCreatingExpert(false);
    if (!res.success) {
      // 422 carries a bare "Validation failed"; the field errors say what to fix.
      const { errors, message } = res.response || {};
      toast.error(errors ? Object.values(errors).flat().join(' ') : message || 'The expert could not be added.');
      return;
    }
    const created = res.response.data;
    toast.success('Outside expert added to the list.');
    // Picked at once, so Save sets them for this scholar.
    setExpertPick({ id: created.id, name: `${created.first_name} ${created.last_name}`.trim() });
    setAddingExpert(false);
    setNewExpert(EMPTY_EXPERT);
  };

  const saveOutsideExpert = async () => {
    setSavingExpert(true);
    const res = await customFetch(`${baseURL}/students/${studentId}/outside-expert`, 'POST', { outside_expert_id: expertPick.id });
    setSavingExpert(false);
    if (res.success) {
      toast.success(res.response.message);
      setPickingExpert(false);
      setExpertPick(null);
      onOutsideExpertSaved?.();
    }
  };

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

        {outsideExpert !== undefined && (
          <PanelSection
            title="IRB outside expert"
            description="With the doctoral committee, the IRB committee. The revised IRB's external review goes to them."
            actions={canSetOutsideExpert && !pickingExpert && (
              <CustomButton
                text={outsideExpert ? 'Change' : 'Set expert'}
                variant="secondary"
                size="sm"
                onClick={() => setPickingExpert(true)}
              />
            )}
          >
            {outsideExpert ? (
              <TableComponent
                data={[outsideExpert]}
                keys={['name', 'email', 'designation', 'institution']}
                titles={['Name', 'Email', 'Designation', 'Institution']}
              />
            ) : (
              <p className="modal-note">None on record, so the revised IRB skips the external review.</p>
            )}
            {pickingExpert && (
              <div className="outside-expert-picker">
                <InputSuggestions
                  // Remounted with the name once a new expert is added and picked.
                  key={expertPick?.id ?? 'search'}
                  initialValue={expertPick?.name}
                  label={outsideExpert ? 'New outside expert' : 'Outside expert'}
                  apiUrl={`${baseURL}/suggestions/outside-expert`}
                  hint="Search the expert list by name, email or institution"
                  fields={['name', 'institution']}
                  onSelect={setExpertPick}
                />
                <CustomButton text="Save" onClick={saveOutsideExpert} busy={savingExpert} disabled={!expertPick} />
                <CustomButton text="Cancel" variant="quiet" onClick={() => { setPickingExpert(false); setExpertPick(null); }} />
              </div>
            )}
            {pickingExpert && can('can_manage_users') && (
              <p className="outside-expert-add">
                An expert already on the list can serve any number of scholars; search for them first.{' '}
                <button type="button" className="cell-link" onClick={() => setAddingExpert(true)}>Not on the list? Add a new expert</button>
              </p>
            )}
          </PanelSection>
        )}
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
                        apiUrl={`${baseURL}/suggestions/outside-expert`}
                        onSelect={(val) => setSelectedOutsideExpert(val.id)}
                        fields={['name', 'institution', 'designation']}
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
            text="Submit request"
            onClick={handleProposeChange}
            busy={loading}
          />
        </div>
      </CustomModal>

      <CustomModal
        isOpen={addingExpert}
        onClose={() => { setAddingExpert(false); setNewExpert(EMPTY_EXPERT); }}
        title="Add new outside expert"
        closeOnOutsideClick={false}
      >
        <p className="modal-note">They join the expert list, so any scholar's committee can use them after this.</p>
        <OutsideExpertFields values={newExpert} onChange={(field, value) => setNewExpert((prev) => ({ ...prev, [field]: value }))} />
        <div className="modal-actions">
          <CustomButton text="Cancel" variant="quiet" onClick={() => { setAddingExpert(false); setNewExpert(EMPTY_EXPERT); }} />
          <CustomButton text="Add expert" onClick={createOutsideExpert} busy={creatingExpert} />
        </div>
      </CustomModal>

      <div className="modal-actions">
        <CustomButton text="Close" variant="quiet" onClick={onClose} />
      </div>
    </>
  );
};

export default SupervisorDoctoralManager;

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import { facultyNameCell } from '../facultyLink/FacultyLink';
import CustomButton from '../forms/fields/CustomButton';
import CustomModal from '../forms/modal/CustomModal';
import GridContainer from "../forms/fields/GridContainer";
import InputSuggestions from "../forms/fields/InputSuggestions";
import { useLoading } from '../../context/LoadingContext';
import TableComponent from '../forms/table/TableComponent';
import './DepartmentManager.css';

const DepartmentManager = ({ departmentId, departmentName, hodEmail, currentHod, currentAdordc, currentCoordinators = [], onClose, onUpdate }) => {
  const [showHodModal, setShowHodModal] = useState(false);
  const [showAdordcModal, setShowAdordcModal] = useState(false);
  const [showCoordinatorModal, setShowCoordinatorModal] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [loading, setLoadingState] = useState(false);
  const { setLoading } = useLoading();

  const hodTableData = currentHod ? [{
    faculty_code: currentHod.faculty_code,
    name: currentHod.user?.name || 'N/A',
    email: currentHod.user?.email || 'N/A',
    phone: currentHod.user?.phone || 'N/A',
    designation: currentHod.designation || 'N/A',
    department: currentHod.department?.name || 'N/A',
    actions: { faculty_code: currentHod.faculty_code }
  }] : [];

  const adordcTableData = currentAdordc ? [{
    faculty_code: currentAdordc.faculty_code,
    name: currentAdordc.user?.name || 'N/A',
    email: currentAdordc.user?.email || 'N/A',
    phone: currentAdordc.user?.phone || 'N/A',
    designation: currentAdordc.designation || 'N/A',
    department: currentAdordc.department?.name || 'N/A',
    actions: { faculty_code: currentAdordc.faculty_code }
  }] : [];

  const coordinatorsTableData = currentCoordinators.map(coord => ({
    faculty_code: coord.faculty?.faculty_code,
    name: coord.faculty?.user?.name || 'N/A',
    email: coord.faculty?.user?.email || 'N/A',
    phone: coord.faculty?.user?.phone || 'N/A',
    designation: coord.faculty?.designation || 'N/A',
    department: coord.faculty?.department?.name || 'N/A',
    actions: { 
      faculty_code: coord.faculty?.faculty_code,
      coordinator_id: coord.id
    }
  }));

  const handleAssignHod = async () => {
    if (!selectedFaculty) {
      toast.error('Please select a faculty');
      return;
    }

    try {
      setLoadingState(true);
      setLoading(true);

      const response = await customFetch(`${baseURL}/departments/add-hod`, 'POST', {
        department_id: departmentId,
        faculty_code: selectedFaculty,
        user_id: selectedFaculty // This will be resolved by backend
      });

      if (response.success) {
        toast.success('HOD assigned successfully');
        setShowHodModal(false);
        setSelectedFaculty(null);
        if (onUpdate) onUpdate();
      } else {
        toast.error(response.message || 'Failed to assign HOD');
      }
    } catch (error) {
      console.error('Error assigning HOD:', error);
      toast.error('Failed to assign HOD');
    } finally {
      setLoadingState(false);
      setLoading(false);
    }
  };

  const handleAssignAdordc = async () => {
    if (!selectedFaculty) {
      toast.error('Please select a faculty');
      return;
    }

    try {
      setLoadingState(true);
      setLoading(true);

      const response = await customFetch(`${baseURL}/departments/add-adordc`, 'POST', {
        department_id: departmentId,
        faculty_code: selectedFaculty,
        user_id: selectedFaculty
      });

      if (response.success) {
        toast.success('ADORDC assigned successfully');
        setShowAdordcModal(false);
        setSelectedFaculty(null);
        if (onUpdate) onUpdate();
      } else {
        toast.error(response.message || 'Failed to assign ADORDC');
      }
    } catch (error) {
      console.error('Error assigning ADORDC:', error);
      toast.error('Failed to assign ADORDC');
    } finally {
      setLoadingState(false);
      setLoading(false);
    }
  };

  const handleAddCoordinator = async () => {
    if (!selectedFaculty) {
      toast.error('Please select a faculty');
      return;
    }

    try {
      setLoadingState(true);
      setLoading(true);

      const response = await customFetch(`${baseURL}/departments/add-coordinator`, 'POST', {
        department_id: departmentId,
        faculty_code: selectedFaculty
      });

      if (response.success) {
        toast.success('PhD Coordinator added successfully');
        setShowCoordinatorModal(false);
        setSelectedFaculty(null);
        if (onUpdate) onUpdate();
      } else {
        toast.error(response.message || 'Failed to add coordinator');
      }
    } catch (error) {
      console.error('Error adding coordinator:', error);
      toast.error('Failed to add coordinator');
    } finally {
      setLoadingState(false);
      setLoading(false);
    }
  };

  const handleRemoveCoordinator = async (coordinatorId, facultyCode) => {
    if (!window.confirm('Are you sure you want to remove this PhD Coordinator?')) {
      return;
    }

    try {
      setLoading(true);

      const response = await customFetch(`${baseURL}/departments/remove-coordinator/${coordinatorId}`, 'DELETE');

      if (response.success) {
        toast.success('PhD Coordinator removed successfully');
        if (onUpdate) onUpdate();
      } else {
        toast.error(response.message || 'Failed to remove coordinator');
      }
    } catch (error) {
      console.error('Error removing coordinator:', error);
      toast.error('Failed to remove coordinator');
    } finally {
      setLoading(false);
    }
  };

  // The same shape three times: a role, the action that changes it, and who
  // currently holds it. It was three GridContainers used only for their label,
  // which stacked a button straight onto a full-width table with no grouping.
  const RoleSection = ({ title, action, isEmpty, emptyText, children }) => (
    <section className="card dm-section">
      <div className="dm-section-head">
        <h3 className="section-heading">{title}</h3>
        {action}
      </div>
      {isEmpty ? <p className="dm-none">{emptyText}</p> : children}
    </section>
  );

  const roleColumns = {
    keys: ['name', 'email', 'phone', 'designation', 'department'],
    titles: ['Name', 'Email', 'Phone', 'Designation', 'Department'],
    components: [facultyNameCell],
  };

  return (
    <div className="department-manager">
      <div className="page-header">
        <div>
          <h2 className="modal-title">Manage Department: {departmentName}</h2>
          {hodEmail && (
            <p className="page-subtitle">
              Official HOD email: <strong>{hodEmail}</strong>. It belongs to the
              department and stays the same when the HOD changes.
            </p>
          )}
        </div>
      </div>

      <RoleSection
        title="Head of Department (HOD)"
        action={
          <CustomButton
            text={currentHod ? 'Change HOD' : 'Assign HOD'}
            variant={currentHod ? 'secondary' : undefined}
            onClick={() => { setSelectedFaculty(null); setShowHodModal(true); }}
          />
        }
        isEmpty={!currentHod}
        emptyText="No HOD assigned yet."
      >
        <TableComponent data={hodTableData} {...roleColumns} />
      </RoleSection>

      <RoleSection
        title="Associate Dean of R&D (ADORDC)"
        action={
          <CustomButton
            text={currentAdordc ? 'Change ADORDC' : 'Assign ADORDC'}
            variant={currentAdordc ? 'secondary' : undefined}
            onClick={() => { setSelectedFaculty(null); setShowAdordcModal(true); }}
          />
        }
        isEmpty={!currentAdordc}
        emptyText="No ADORDC assigned yet."
      >
        <TableComponent data={adordcTableData} {...roleColumns} />
      </RoleSection>

      <RoleSection
        title="PhD Coordinators"
        action={
          <CustomButton
            text="Add PhD Coordinator"
            onClick={() => { setSelectedFaculty(null); setShowCoordinatorModal(true); }}
          />
        }
        isEmpty={coordinatorsTableData.length === 0}
        emptyText="No PhD coordinators for this department yet."
      >
        <TableComponent
          data={coordinatorsTableData}
          keys={['name', 'email', 'phone', 'designation', 'actions']}
          titles={['Name', 'Email', 'Phone', 'Designation', 'Actions']}
          components={[
            facultyNameCell,
            {
              key: 'actions',
              component: ({ row }) => (
                <CustomButton
                  text="Remove"
                  variant="danger"
                  onClick={() => handleRemoveCoordinator(row.actions.coordinator_id, row.actions.faculty_code)}
                />
              ),
            },
          ]}
        />
      </RoleSection>

      {/* HOD Assignment Modal */}
      <CustomModal
        isOpen={showHodModal}
        onClose={() => { setShowHodModal(false); setSelectedFaculty(null); }}
        title={currentHod ? 'Change HOD' : 'Assign HOD'}
        maxWidth="600px"
        minHeight="auto"
      >
        <div className="modal-note">
          <strong>Note:</strong> Assigning a new HOD will update the faculty's role to HOD (role_id: 3).
          {currentHod && ' The current HOD\'s role will be reverted to Faculty.'}
        </div>

        <GridContainer
          elements={[
            <InputSuggestions
              label="Select Faculty from Department*"
              apiUrl={`${baseURL}/suggestions/faculty?department_id=${departmentId}`}
              onSelect={(val) => setSelectedFaculty(val.id)}
              fields={['name', 'designation', 'email']}
            />
          ]}
          space={3}
        />

        <div className="modal-actions">
          <CustomButton
            text="Cancel"
            variant="secondary"
            onClick={() => { setShowHodModal(false); setSelectedFaculty(null); }}
          />
          <CustomButton
            text={loading ? 'Assigning...' : 'Assign as HOD'}
            onClick={handleAssignHod}
            disabled={loading || !selectedFaculty}
          />
        </div>
      </CustomModal>

      {/* ADORDC Assignment Modal */}
      <CustomModal
        isOpen={showAdordcModal}
        onClose={() => { setShowAdordcModal(false); setSelectedFaculty(null); }}
        title={currentAdordc ? 'Change ADORDC' : 'Assign ADORDC'}
        maxWidth="600px"
        minHeight="auto"
      >
        <div className="modal-note">
          <strong>Note:</strong> Assigning a new ADORDC will update the faculty's role to ADORDC.
          {currentAdordc && " The current ADORDC's role will be reverted to Faculty."}
        </div>

        <GridContainer
          elements={[
            <InputSuggestions
              label="Select Faculty from Department*"
              apiUrl={`${baseURL}/suggestions/faculty`}
              onSelect={(val) => setSelectedFaculty(val.id)}
              fields={['name', 'designation', 'email']}
            />
          ]}
          space={3}
        />

        <div className="modal-actions">
          <CustomButton
            text="Cancel"
            variant="secondary"
            onClick={() => { setShowAdordcModal(false); setSelectedFaculty(null); }}
          />
          <CustomButton
            text={loading ? 'Assigning...' : 'Assign as ADORDC'}
            onClick={handleAssignAdordc}
            disabled={loading || !selectedFaculty}
          />
        </div>
      </CustomModal>

      {/* Coordinator Assignment Modal */}
      <CustomModal
        isOpen={showCoordinatorModal}
        onClose={() => { setShowCoordinatorModal(false); setSelectedFaculty(null); }}
        title="Add PhD Coordinator"
        maxWidth="600px"
        minHeight="auto"
      >
        <div className="modal-note">
          <strong>Note:</strong> Adding a PhD Coordinator will update the faculty's role to PhD Coordinator (role_id: 2).
        </div>

        <GridContainer
          elements={[
            <InputSuggestions
              label="Select Faculty from Department*"
              apiUrl={`${baseURL}/suggestions/faculty?department_id=${departmentId}`}
              onSelect={(val) => setSelectedFaculty(val.id)}
              fields={['name', 'designation', 'email']}
            />
          ]}
          space={3}
        />

        <div className="modal-actions">
          <CustomButton
            text="Cancel"
            variant="secondary"
            onClick={() => { setShowCoordinatorModal(false); setSelectedFaculty(null); }}
          />
          <CustomButton
            text={loading ? 'Adding...' : 'Add Coordinator'}
            onClick={handleAddCoordinator}
            disabled={loading || !selectedFaculty}
          />
        </div>
      </CustomModal>

      <div style={{ marginTop: '2rem', textAlign: 'right' }}>
        <CustomButton text="Close" onClick={onClose} />
      </div>

      <style jsx>{`
        .department-manager {
          padding: 1rem;
        }
      `}</style>
    </div>
  );
};

export default DepartmentManager;

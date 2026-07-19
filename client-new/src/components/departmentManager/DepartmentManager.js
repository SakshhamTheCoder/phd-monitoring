import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import CustomButton from '../forms/fields/CustomButton';
import GridContainer from "../forms/fields/GridContainer";
import InputSuggestions from "../forms/fields/InputSuggestions";
import { useLoading } from '../../context/LoadingContext';
import TableComponent from '../forms/table/TableComponent';

const DepartmentManager = ({ departmentId, departmentName, hodEmail, currentHod, currentAdordc, currentCoordinators = [], onClose, onUpdate }) => {
  const [showHodModal, setShowHodModal] = useState(false);
  const [showAdordcModal, setShowAdordcModal] = useState(false);
  const [showCoordinatorModal, setShowCoordinatorModal] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [loading, setLoadingState] = useState(false);
  const { setLoading } = useLoading();

  const hodTableData = currentHod ? [{
    name: currentHod.user?.name || 'N/A',
    email: currentHod.user?.email || 'N/A',
    phone: currentHod.user?.phone || 'N/A',
    designation: currentHod.designation || 'N/A',
    department: currentHod.department?.name || 'N/A',
    actions: { faculty_code: currentHod.faculty_code }
  }] : [];

  const adordcTableData = currentAdordc ? [{
    name: currentAdordc.user?.name || 'N/A',
    email: currentAdordc.user?.email || 'N/A',
    phone: currentAdordc.user?.phone || 'N/A',
    designation: currentAdordc.designation || 'N/A',
    department: currentAdordc.department?.name || 'N/A',
    actions: { faculty_code: currentAdordc.faculty_code }
  }] : [];

  const coordinatorsTableData = currentCoordinators.map(coord => ({
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

  return (
    <div className="department-manager">
      <h2>Manage Department: {departmentName}</h2>

      {hodEmail && (
        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#374151' }}>
          <strong>Official HOD email:</strong> {hodEmail}
          <span style={{ color: '#6b7280' }}>
            {' '}(belongs to the department, stays the same when the HOD changes)
          </span>
        </p>
      )}

      <GridContainer
        label="Head of Department (HOD)"
        elements={[
          <div>
            <CustomButton
              text={currentHod ? "Change HOD" : "Assign HOD"}
              onClick={() => {
                setSelectedFaculty(null);
                setShowHodModal(true);
              }} 
            />
            {currentHod && (
              <TableComponent
                data={hodTableData}
                keys={['name', 'email', 'phone', 'designation', 'department']}
                titles={['Name', 'Email', 'Phone', 'Designation', 'Department']}
              />
            )}
          </div>
        ]}
        space={3}
      />

      <GridContainer
        label="Associate Dean of R&D (ADORDC)"
        elements={[
          <div>
            <CustomButton 
              text={currentAdordc ? "Change ADORDC" : "Assign ADORDC"} 
              onClick={() => {
                setSelectedFaculty(null);
                setShowAdordcModal(true);
              }} 
            />
            {currentAdordc && (
              <TableComponent
                data={adordcTableData}
                keys={['name', 'email', 'phone', 'designation', 'department']}
                titles={['Name', 'Email', 'Phone', 'Designation', 'Department']}
              />
            )}
          </div>
        ]}
        space={3}
      />

      <GridContainer
        label="PhD Coordinators"
        elements={[
          <div>
            <CustomButton 
              text="Add PhD Coordinator +" 
              onClick={() => {
                setSelectedFaculty(null);
                setShowCoordinatorModal(true);
              }} 
            />
            {coordinatorsTableData.length > 0 && (
              <TableComponent
                data={coordinatorsTableData}
                keys={['name', 'email', 'phone', 'designation', 'actions']}
                titles={['Name', 'Email', 'Phone', 'Designation', 'Actions']}
                components={[
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
            )}
          </div>
        ]}
        space={3}
      />

      {/* HOD Assignment Modal */}
      {showHodModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '0.5rem',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3>{currentHod ? 'Change HOD' : 'Assign HOD'}</h3>
            
            <div style={{
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
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

            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              justifyContent: 'flex-end',
              marginTop: '1rem'
            }}>
              <CustomButton
                text="Cancel"
                onClick={() => {
                  setShowHodModal(false);
                  setSelectedFaculty(null);
                }}
              />
              <CustomButton
                text={loading ? 'Assigning...' : 'Assign as HOD'}
                onClick={handleAssignHod}
                disabled={loading || !selectedFaculty}
              />
            </div>
          </div>
        </div>
      )}

      {/* ADORDC Assignment Modal */}
      {showAdordcModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '0.5rem',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3>{currentAdordc ? 'Change ADORDC' : 'Assign ADORDC'}</h3>
            
            <div style={{
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              <strong>Note:</strong> Assigning a new ADORDC will update the faculty's role to ADORDC.
              {currentAdordc && ' The current ADORDC\'s role will be reverted to Faculty.'}
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

            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              justifyContent: 'flex-end',
              marginTop: '1rem'
            }}>
              <CustomButton
                text="Cancel"
                onClick={() => {
                  setShowAdordcModal(false);
                  setSelectedFaculty(null);
                }}
              />
              <CustomButton
                text={loading ? 'Assigning...' : 'Assign as ADORDC'}
                onClick={handleAssignAdordc}
                disabled={loading || !selectedFaculty}
              />
            </div>
          </div>
        </div>
      )}

      {/* Coordinator Assignment Modal */}
      {showCoordinatorModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '0.5rem',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3>Add PhD Coordinator</h3>
            
            <div style={{
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              <strong>Note:</strong> Adding a PhD Coordinator will update the faculty's role to PhD Coordinator (role_id: 2).
              Multiple coordinators can be assigned per department.
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

            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              justifyContent: 'flex-end',
              marginTop: '1rem'
            }}>
              <CustomButton
                text="Cancel"
                onClick={() => {
                  setShowCoordinatorModal(false);
                  setSelectedFaculty(null);
                }}
              />
              <CustomButton
                text={loading ? 'Adding...' : 'Add Coordinator'}
                onClick={handleAddCoordinator}
                disabled={loading || !selectedFaculty}
              />
            </div>
          </div>
        </div>
      )}

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

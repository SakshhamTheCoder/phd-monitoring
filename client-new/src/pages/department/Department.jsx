import React, { useState } from 'react';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import { useLoading } from '../../context/LoadingContext';
import { useLocation } from 'react-router-dom';
import FilterBar from '../../components/filterBar/FilterBar';
import PagenationTable from '../../components/pagenationTable/PagenationTable';
import CustomModal from '../../components/forms/modal/CustomModal';
import DepartmentManager from '../../components/departmentManager/DepartmentManager';
import AddDepartmentForm from './AddDepartmentForm';
import CustomButton from '../../components/forms/fields/CustomButton';
import useCapabilities from '../../hooks/useCapabilities';

const DepartmentPage = () => {
  const [filter, setFilter] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { setLoading } = useLoading();
  const location = useLocation();
  const can = useCapabilities();
  // Every department write is gated on can_add_department server side, so a
  // role without it is shown the directory, not the controls.
  const mayManage = can('can_add_department');

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
  };

  const openForm = async (data) => {
    if (data) {
      setLoading(true);
      setEditData(data);
      console.log(data);
      setIsOpen(true);
      setLoading(false);
    } else {
      setEditData(null);
      setIsOpen(true);
    }
  };

  const handleUpdate = () => {
    setIsOpen(false);
    setEditData(null);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <Layout
      children={
        <>
          <PageHeader title="Departments" subtitle="Departments, their HoD and PhD coordinators." />
          <FilterBar onSearch={handleFilterChange} />
          <PagenationTable
            key={refreshKey}
            endpoint={location.pathname}
            filters={filter}
            enableApproval={false}
            rowClickable={mayManage}
            customOpenForm={openForm}
            extraTopbarComponents={
              mayManage ? (
                <CustomButton text="Add Department +" onClick={() => openForm()} />
              ) : null
            }
            actions={mayManage ? [
              {
                icon: <i className="fa-solid fa-users-gear"></i>,
                tooltip: 'Manage HOD & Coordinators',
                onClick: (deptData) => openForm(deptData),
              },
            ] : []}
          />
          <CustomModal
            isOpen={isOpen}
            onClose={() => {
              setIsOpen(false);
              setEditData(null);
            }}
            width="90vw"
          >
            {editData ? (
              <DepartmentManager
                departmentId={editData.id}
                departmentName={editData.name || editData.department_name}
                hodEmail={editData.hod_email}
                currentHod={editData.hod}
                currentAdordc={editData.adordc}
                currentCoordinators={editData.phd_coordinators || []}
                onClose={() => {
                  setIsOpen(false);
                  setEditData(null);
                }}
                onUpdate={handleUpdate}
              />
            ) : (
              <AddDepartmentForm
                onClose={() => {
                  setIsOpen(false);
                  setEditData(null);
                }}
                onCreated={handleUpdate}
              />
            )}
          </CustomModal>
        </>
      }
    />
  );
};

export default DepartmentPage;

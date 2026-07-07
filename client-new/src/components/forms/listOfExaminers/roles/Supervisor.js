import React, { useState } from 'react';
import CustomButton from '../../fields/CustomButton';
import GridContainer from '../../fields/GridContainer';
import { baseURL } from '../../../../api/urls';
import InputSuggestions from '../../fields/InputSuggestions';
import TableComponent from '../../table/TableComponent';
import CustomModal from '../../modal/CustomModal';
import AddExaminer from '../../AddExaminer/AddExaminer';
import { customFetch } from '../../../../api/base';
import { useLoading } from '../../../../context/LoadingContext';
import { useLocation } from 'react-router-dom';
import RadioButtonGroup from '../../fields/RadioButtonGroup';
import { toast } from 'react-toastify';

const ExaminerManager = ({
  type,
  formData,
  examData,
  apiUrl,
  onAddExaminer,
}) => {
  const [examiners, setExaminers] = useState(examData || []);
  const [modalData, setModalData] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSearchSelect = (selectedExaminer) => {
    setModalData(selectedExaminer);
    setIsModalOpen(true);
  };

  const handleOpenModal = () => {
    setModalData({});
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleAddExaminer = (examiner) => {
    setExaminers([...examiners, examiner]);
    onAddExaminer(examiner);
    setIsModalOpen(false);
  };

  return (
    <div>
      <CustomModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        minWidth='700px'
        maxWidth='800px'
        minHeight='300px'
        maxHeight='500px'
      >
        <AddExaminer data={modalData} onSubmit={handleAddExaminer} />
      </CustomModal>
      {console.log(formData)}
      {!formData.locks.supervisor && formData.role === 'faculty' && (
        <>
          <GridContainer
            elements={[
              <InputSuggestions
                apiUrl={apiUrl}
                hint='Search here...'
                onSelect={handleSearchSelect}
                label=''
                showLabel={false}
              />,
              <CustomButton
                text={`Add New ${type}`}
                onClick={handleOpenModal}
              />,
            ]}
            ratio={[2, 1]}
            space={2}
            label={`${type} Examiners`}
          />
        </>
      )}
      {formData.role !== 'dordc' && (
        <>
          {' '}
          <GridContainer
            elements={[
              <TableComponent
                data={examiners}
                titles={[
                  'Name',
                  'Email',
                  'Department',
                  'Designation',
                  'Institution',
                  'Status',
                ]}
                keys={[
                  'name',
                  'email',
                  'department',
                  'designation',
                  'institution',
                  'recommendation',
                ]}
              />,
            ]}
            space={3}
          />
        </>
      )}
    </div>
  );
};

const Supervisor = ({ formData }) => {
  const [national, setNational] = useState(formData.national || []);
  const [international, setInternational] = useState(
    formData.international || []
  );
  const { setLoading } = useLoading();
  const location = useLocation();
  const handleAddNationalExaminer = (examiner) => {
    console.log('National Examiner Added:', examiner);
    setNational([...national, examiner]);
  };

  const handleAddInternationalExaminer = (examiner) => {
    console.log('International Examiner Added:', examiner);
    setInternational([...international, examiner]);
  };

  const submitExaminers = () => {
    setLoading(true);
    customFetch(baseURL + location.pathname, 'POST', {
      national: national,
      international: international,
    }).then((data) => {
      if (data && data.success) {
        toast.success("Form submitted successfully");
        setTimeout(() => window.location.reload(), 1200);
      } else {
        toast.error((data && data.response && data.response.message) || "Failed to submit the form");
      }
      setLoading(false);
    });
  };

  return (
    <div>
      <ExaminerManager
        type='National'
        formData={formData}
        examData={formData.national}
        apiUrl={`${baseURL}/suggestions/examiner`}
        onAddExaminer={handleAddNationalExaminer}
      />
      <ExaminerManager
        type='International'
        formData={formData}
        examData={formData.international}
        apiUrl={`${baseURL}/suggestions/examiner`}
        onAddExaminer={handleAddInternationalExaminer}
      />
       {!formData.locks.supervisor && formData.role === 'faculty' && (
      <GridContainer
        elements={[<CustomButton text='Submit' onClick={submitExaminers} />]}
      />)}
    </div>
  );
};

export default Supervisor;

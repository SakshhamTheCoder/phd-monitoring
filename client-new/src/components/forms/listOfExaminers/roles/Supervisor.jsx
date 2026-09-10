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
  onRemoveExaminer,
}) => {
  const [examiners, setExaminers] = useState(examData || []);
  const [modalData, setModalData] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  const canEdit = !formData.locks.supervisor && formData.role === 'faculty';

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

  // A row already saved on the form has an id and has to go from the server.
  // One only added in this sitting has not been saved yet, so dropping it from
  // the list is all there is to do.
  const handleRemove = async (row) => {
    if (row.id) {
      const res = await customFetch(
        `${baseURL}/forms/list-of-examiners/${formData.form_id}/examiners/${row.id}`,
        'DELETE'
      );
      if (!res || !res.success) return;
      toast.success('Examiner removed');
    }
    setExaminers((prev) => prev.filter((item) => item !== row));
    onRemoveExaminer(row);
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
      {canEdit && (
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
                  ...(canEdit ? [''] : []),
                ]}
                keys={[
                  'name',
                  'email',
                  'department',
                  'designation',
                  'institution',
                  'recommendation',
                  ...(canEdit ? ['remove'] : []),
                ]}
                components={
                  canEdit
                    ? [
                        {
                          key: 'remove',
                          component: ({ row }) =>
                            row.recommendation && row.recommendation !== 'pending' ? null : (
                              <button
                                type="button"
                                className="examiner-remove"
                                aria-label={`Remove ${row.name}`}
                                onClick={() => handleRemove(row)}
                              >
                                <i className="fa fa-trash" aria-hidden="true"></i>
                              </button>
                            ),
                        },
                      ]
                    : []
                }
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
    setNational([...national, examiner]);
  };

  const handleAddInternationalExaminer = (examiner) => {
    setInternational([...international, examiner]);
  };

  const removeFrom = (setList) => (examiner) =>
    setList((prev) => prev.filter((item) => item.email !== examiner.email));

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
        onRemoveExaminer={removeFrom(setNational)}
      />
      <ExaminerManager
        type='International'
        formData={formData}
        examData={formData.international}
        apiUrl={`${baseURL}/suggestions/examiner`}
        onAddExaminer={handleAddInternationalExaminer}
        onRemoveExaminer={removeFrom(setInternational)}
      />
       {!formData.locks.supervisor && formData.role === 'faculty' && (
      <GridContainer
        elements={[<CustomButton text='Submit' onClick={submitExaminers} />]}
      />)}
    </div>
  );
};

export default Supervisor;

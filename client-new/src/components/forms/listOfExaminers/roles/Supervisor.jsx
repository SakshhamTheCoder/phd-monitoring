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
import { insertAt, toastUndo } from '../../../../utils/undoToast';

// `examiners` is the list Supervisor submits. A second copy kept here drifted
// from it: this one dropped a row by identity, that one by email, so two blank
// or equal emails left the table and the payload disagreeing.
const ExaminerManager = ({
  type,
  formData,
  examiners,
  allExaminers,
  apiUrl,
  onAddExaminer,
  onRemoveExaminer,
}) => {
  const [modalData, setModalData] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  // The saved row being deleted, so its button cannot send a second DELETE.
  const [removing, setRemoving] = useState(null);
  // Marks where the examiner just added landed in the table.
  const [lastAdded, setLastAdded] = useState(null);

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
    onAddExaminer(examiner);
    setLastAdded(examiner);
    setIsModalOpen(false);
  };

  // A row already saved on the form has an id and has to go from the server.
  // One only added in this sitting has not been saved yet, so dropping it from
  // the list is all there is to do.
  const handleRemove = async (row) => {
    if (row.id) {
      if (!window.confirm(`Remove ${row.name || 'this examiner'} from the list? The saved examiner is deleted straight away.`)) return;
      setRemoving(row);
      const res = await customFetch(
        `${baseURL}/forms/list-of-examiners/${formData.form_id}/examiners/${row.id}`,
        'DELETE'
      );
      setRemoving(null);
      if (!res || !res.success) return;
      toast.success('Examiner removed');
    }
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
        <AddExaminer data={modalData} onSubmit={handleAddExaminer} existing={allExaminers} />
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
                text={`Add new ${type.toLowerCase()} examiner`}
                variant="secondary"
                onClick={handleOpenModal}
              />,
            ]}
            ratio={[2, 1]}
            space={2}
            label={`${type} examiners`}
          />
        </>
      )}
      {formData.role !== 'dordc' && (
        <>
          <GridContainer
            elements={[
              <TableComponent
                data={examiners}
                rowClassName={(row) => (row === lastAdded ? 'just-added' : undefined)}
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
                                disabled={removing === row}
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
  // Stays on after a success until the reload, as submitForm does, so Submit
  // cannot be pressed again in the gap.
  const [submitting, setSubmitting] = useState(false);
  const location = useLocation();
  const handleAddNationalExaminer = (examiner) => {
    setNational([...national, examiner]);
  };

  const handleAddInternationalExaminer = (examiner) => {
    setInternational([...international, examiner]);
  };

  // A saved examiner is already gone from the server, so only an unsaved one
  // can be put back.
  const removeFrom = (list, setList) => (examiner) => {
    const index = list.indexOf(examiner);
    setList((prev) => prev.filter((item) => item !== examiner));
    if (!examiner.id) {
      toastUndo(`${examiner.name || 'Examiner'} removed.`, () => setList((now) => insertAt(now, index, examiner)));
    }
  };

  const submitExaminers = () => {
    setSubmitting(true);
    setLoading(true);
    customFetch(baseURL + location.pathname, 'POST', {
      national: national,
      international: international,
    }).then((data) => {
      if (data && data.success) {
        toast.success("Form submitted successfully");
        setTimeout(() => window.location.reload(), 1200);
        return;
      }
      toast.error((data && data.response && data.response.message) || "Failed to submit the form");
      setSubmitting(false);
      setLoading(false);
    });
  };

  return (
    <div>
      <ExaminerManager
        type='National'
        formData={formData}
        examiners={national}
        allExaminers={[...national, ...international]}
        apiUrl={`${baseURL}/suggestions/examiner`}
        onAddExaminer={handleAddNationalExaminer}
        onRemoveExaminer={removeFrom(national, setNational)}
      />
      <ExaminerManager
        type='International'
        formData={formData}
        examiners={international}
        allExaminers={[...national, ...international]}
        apiUrl={`${baseURL}/suggestions/examiner`}
        onAddExaminer={handleAddInternationalExaminer}
        onRemoveExaminer={removeFrom(international, setInternational)}
      />
       {!formData.locks.supervisor && formData.role === 'faculty' && (
      <GridContainer
        elements={[<CustomButton text='Submit' onClick={submitExaminers} disabled={submitting} />]}
      />)}
    </div>
  );
};

export default Supervisor;

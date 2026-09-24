import React, { Suspense, lazy, useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../../forms/fields/CustomButton';
import GridContainer from '../../forms/fields/GridContainer';
import InputField from '../../forms/fields/InputField';
import ToggleSwitch from '../../forms/fields/ToggleSwitch';
import FileUploadField from '../../forms/fields/FileUploadField';
import Loader from '../../loader/loader';
import { customFetch } from '../../../api/base';
import { baseURL } from '../../../api/urls';
import { toDateValue } from '../../../utils/timeParse';

// Only this dialog uses the picker, so it and its stylesheet load when it opens.
const DatePicker = lazy(() =>
  Promise.all([
    import('react-datepicker'),
    import('react-datepicker/dist/react-datepicker.css'),
  ]).then(([picker]) => picker)
);

/**
 * A past semester's deadline, notification switch and PPT template, edited by
 * the office. `row` is the semester as stored.
 */
const SemesterEditorBlock = ({ row, onClose, onChanged }) => {
  const [editForm, setEditForm] = useState({
    semester_name: row.semester_name,
    start_date: new Date(row.start_date),
    end_date: new Date(row.end_date),
    notification: row.notification || false,
    ppt_file: row.ppt_file || null,
  });
  // Saving carries a file, so a second press while the first is in flight
  // posted it twice.
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('semester_name', editForm.semester_name);
      formData.append('start_date', toDateValue(editForm.start_date));
      formData.append('end_date', toDateValue(editForm.end_date));
      // Laravel's boolean rule refuses the strings "true" and "false".
      formData.append('notification', editForm.notification ? '1' : '0');
      if (editForm.ppt_file && editForm.ppt_file instanceof File) {
        formData.append('ppt_file', editForm.ppt_file);
      }

      const response = await customFetch(baseURL + '/semester', 'POST', formData, true, true);
      if (!response.success) return;
      toast.success('Semester updated.');
      onClose();
      // The table and the stats card both show this semester.
      onChanged();
    } catch (err) {
      console.error('PUT error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <GridContainer
        elements={[
          <InputField
            label="Period of report"
            isLocked={true}
            initialValue={editForm.semester_name}
          />,
        ]}
        space={2}
      />

      <Suspense fallback={<Loader scope="content" />}>
      <label className="input-label" htmlFor="presentation-semester-evaluation-start-date">Evaluation start date</label>
      <DatePicker id="presentation-semester-evaluation-start-date"
        selected={editForm.start_date}
        readOnly
        disabled
        className="input-field field-readonly"
      />

      <label className="input-label" htmlFor="presentation-semester-evaluation-end-date">Evaluation end date</label>
      <DatePicker id="presentation-semester-evaluation-end-date"
        selected={editForm.end_date}
        onChange={(date) => setEditForm({ ...editForm, end_date: date })}
        className="input-field"
      />

      <label className="input-label">Notification</label>
      <ToggleSwitch
        isOn={editForm.notification}
        onToggle={() =>
          setEditForm((prev) => ({
            ...prev,
            notification: !prev.notification,
          }))
        }
      />

      <FileUploadField
        label="Sample PPT template (optional)"
        initialValue={editForm.ppt_file}
        isLocked={false}
        onChange={(file) => setEditForm({ ...editForm, ppt_file: file })}
        showLabel={true}
        acceptedTypes=".ppt,.pptx"
        maxSizeMB={15}
        fileTypeLabel="PPT/PPTX"
      />

      <div className="modal-actions">
        <CustomButton onClick={save} text="Save changes" busy={saving} />
      </div>
      </Suspense>
    </>
  );
};

export default SemesterEditorBlock;

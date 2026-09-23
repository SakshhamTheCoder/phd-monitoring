import React, { useId, useState } from 'react';
import './Fields.css';
import { toast } from 'react-toastify';
import { storedFileUrl, storedFileClick } from '../../../api/fileAccess';

const FileUploadField = ({
  label,
  initialValue = null,
  isLocked = false,
  onChange,
  showLabel = true,
  acceptedTypes = '.pdf',
  maxSizeMB = 15,
  fileTypeLabel = 'PDF',
  required = false,
}) => {
  const fieldId = useId();
  const [fileName, setFileName] = useState(
    initialValue ? 'View Uploaded File' : `Upload ${fileTypeLabel} (Max ${maxSizeMB}MB)`
  );

  // The parent keeps the last file it accepted, and a refused pick empties the
  // input, so without this the field looked empty while that file still went
  // with the form.
  const [attached, setAttached] = useState(null);
  const refuse = (e, message) => {
    toast.error(attached ? `${message} ${attached} is still attached.` : message);
    e.target.value = '';
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];

    if (file) {
      // Validate file type based on accepted types
      const acceptedExtensions = acceptedTypes.split(',').map(ext => ext.trim());
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
      
      // A refused file is cleared from the input, which otherwise kept showing
      // its name as though it had been attached.
      if (!acceptedExtensions.includes(fileExtension)) {
        refuse(e, `Only ${fileTypeLabel} files are allowed.`);
        return;
      }
      
      if (file.size > maxSizeMB * 1024 * 1024) {
        refuse(e, `File size should be less than ${maxSizeMB} MB.`);
        return;
      }
      setFileName(file.name);
      setAttached(file.name);
      onChange(file); // Pass the file to the parent component
    }
  };

  return (
    <div className='file-upload-container'>
      {showLabel && (
        <label className='input-label' htmlFor={isLocked ? undefined : fieldId}>
          {label}{required && <span className="req" aria-hidden="true">*</span>}
        </label>
      )}

      {isLocked ? (
        initialValue ? (
          <a
            href={storedFileUrl(initialValue)}
            target='_blank'
            rel='noopener noreferrer'
            className='file-link'
            onClick={storedFileClick(initialValue)}
          >
            <div className='preview-file'> {fileName}</div>
          </a>
        ) : (
          // Same read only treatment as every other empty locked field, rather
          // than the dashed box that reads as a drop zone.
          <div className='input-field field-readonly'>Not provided</div>
        )
      ) : (
        <input
          id={fieldId}
          type='file'
          aria-required={required || undefined}
          accept={acceptedTypes}
          className='file-input'
          onChange={handleFileChange}
          disabled={isLocked}
        />
      )}
    </div>
  );
};

export default FileUploadField;

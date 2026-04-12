import React, { useState } from 'react';
import './Fields.css';
import { toast } from 'react-toastify';
import {  rootURL } from '../../../api/urls';

const FileUploadField = ({
  label,
  initialValue = null,
  isLocked = false,
  onChange,
  showLabel = true,
  acceptedTypes = '.pdf',
  maxSizeMB = 2,
  fileTypeLabel = 'PDF',
  required = false,
}) => {
  const [fileName, setFileName] = useState(
    initialValue ? 'View Uploaded File' : `Upload ${fileTypeLabel} (Max ${maxSizeMB}MB)`
  );

  const handleFileChange = (e) => {
    const file = e.target.files[0];

    if (file) {
      // Validate file type based on accepted types
      const acceptedExtensions = acceptedTypes.split(',').map(ext => ext.trim());
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
      
      if (!acceptedExtensions.includes(fileExtension)) {
        toast.error(`Only ${fileTypeLabel} files are allowed.`);
        return;
      }
      
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`File size should be less than ${maxSizeMB} MB.`);
        return;
      }
      setFileName(file.name);
      onChange(file); // Pass the file to the parent component
    }
  };

  return (
    <div className='file-upload-container'>
      {showLabel && <label className='input-label'>{label}{required && <span style={{ color: 'red', marginLeft: '4px' }}>*</span>}</label>}

      {initialValue && isLocked ? (
        <a
          href={rootURL + initialValue.replace('app/public', 'storage')}
          target='_blank'
          rel='noopener noreferrer'
          className='file-link'
        >
          <div className='preview-file'> {fileName}</div>
        </a>
      ) : (
        <input
          type='file'
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

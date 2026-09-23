import React, { useEffect, useId, useState } from 'react';
import "./Fields.css";

const InputField = ({ label, initialValue, isLocked, onChange,hint=null,showLabel=true, required = false, type = "text", placeholder = null }) => {
    const [hintText, setHintText] = useState(placeholder || hint || '');
    const [value, updateValue] = useState(initialValue);
    const fieldId = useId();
    useEffect(() => {
        if (initialValue !== undefined) {
            updateValue(initialValue);
        }
      }, [initialValue]);

      
    return (
        <div className="input-field-container">
            {showLabel && (
                <label className="input-label" htmlFor={fieldId}>
                    {label}{required && <span className="req" aria-hidden="true">*</span>}
                </label>
            )}
            <input
                id={fieldId}
                type={type}
                aria-label={showLabel ? undefined : label}
                aria-required={required || undefined}
                className="input-field"
                value={value}
                placeholder={isLocked && !value ? 'Not provided' : hintText}
                onChange={(e) => {updateValue(e.target.value); onChange(e.target.value)}}
                readOnly={isLocked} 
            />
        </div>
    );
};

export default InputField;

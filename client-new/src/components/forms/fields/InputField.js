import React, { useEffect, useState } from 'react';
import "./Fields.css";

const InputField = ({ label, initialValue, isLocked, onChange,hint=null,showLabel=true, required = false, type = "text", placeholder = null }) => {
    const [hintText, setHintText] = useState(placeholder || hint || 'Enter Value...');
    const [value, updateValue] = useState(initialValue);
    useEffect(() => {
        if (initialValue !== undefined) {
            updateValue(initialValue);
        }
      }, [initialValue]);

      
    return (
        <div className="input-field-container">
            {showLabel && (<label className="input-label">{label}{required && <span className="req">*</span>}</label>)}
            <input
                type={type}
                className="input-field"
                value={value}
                placeholder={hintText}
                onChange={(e) => {updateValue(e.target.value); onChange(e.target.value)}}
                readOnly={isLocked} 
                disabled={isLocked}
            />
        </div>
    );
};

export default InputField;

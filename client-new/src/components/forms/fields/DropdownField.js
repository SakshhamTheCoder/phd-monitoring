import React, { useState } from 'react';
import "./Fields.css";

const DropdownField = ({ label, options, initialValue, isLocked, onChange, required = false }) => {
    const [value, updateValue] = useState(initialValue || "");
    const [showInitialValue, setShowInitialValue] = useState(!!initialValue);

    const handleDropdownChange = (e) => {
        updateValue(e.target.value);
        onChange(e.target.value);
    };

    const handleDropdownClick = () => {
        setShowInitialValue(false);
    };

    return (
        <div className="input-field-container">
            {label && (  <label className="input-label">{label}{required && <span style={{ color: 'red', marginLeft: '4px' }}>*</span>}</label>)}
            <select
                className="input-field"
                value={value}
                onChange={handleDropdownChange}
                onClick={handleDropdownClick}
                disabled={isLocked}
            >
                {!showInitialValue && <option value="">Select</option>}
                {showInitialValue ? (
                    <option value={value}>{initialValue}</option>
                ) : (
                    <>{options && options?.map((option, index) => (
                        <option key={index} value={option.value}>
                            {option.title}
                        </option>
                    ))}</>
                    
                )}
            </select>
        </div>
    );
};

export default DropdownField;

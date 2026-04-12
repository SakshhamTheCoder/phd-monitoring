import React, { useState, useEffect } from 'react';
import "./Fields.css";

const DateField = ({ label, initialValue, isLocked, onChange, hint = null, showLabel = true, required = false }) => {
    const [hintText] = useState(hint || 'Select Date...');
    const [value, updateValue] = useState('');

    // Format the initial value to "YYYY-MM-DD" if it’s in ISO format
    useEffect(() => {
        if (initialValue) {
            const formattedDate = new Date(initialValue).toISOString().split('T')[0];
            updateValue(formattedDate);
        }
    }, [initialValue]);

    return (
        <div className="input-field-container">
            {showLabel && (<label className="input-label">{label}{required && <span style={{ color: 'red', marginLeft: '4px' }}>*</span>}</label>)}
            <input
                type="date"
                className="input-field"
                value={value}
                placeholder={hintText}
                onChange={(e) => {
                    updateValue(e.target.value);
                    onChange(e.target.value);
                }}
                readOnly={isLocked}
                disabled={isLocked}
            />
        </div>
    );
};

export default DateField;

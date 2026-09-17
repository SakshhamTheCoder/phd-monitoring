import React, { useState, useEffect, useId } from 'react';
import "./Fields.css";

const TimeField = ({ label, initialValue, isLocked, onChange, hint = null, showLabel = true, required = false }) => {
    const [hintText] = useState(hint || 'Select Time...');
    const [value, updateValue] = useState('');
    const fieldId = useId();

    // Format the initial value to "HH:MM" if it’s provided
    useEffect(() => {
        if (!initialValue) return;
        // A stored time arrives as "10:30" or "10:30:00", which new Date() cannot
        // read, and toISOString() on the invalid date throws and takes the page down.
        if (/^\d{2}:\d{2}/.test(initialValue)) {
            updateValue(initialValue.slice(0, 5));
            return;
        }
        const date = new Date(initialValue);
        if (!Number.isNaN(date.getTime())) updateValue(date.toISOString().slice(11, 16));
    }, [initialValue]);

    return (
        <div className="input-field-container">
            {showLabel && (
                <label className="input-label" htmlFor={fieldId}>
                    {label}{required && <span className="req" aria-hidden="true">*</span>}
                </label>
            )}
            {isLocked && !value ? (
                <div className="input-field field-readonly">Not provided</div>
            ) : (
                <input
                    id={fieldId}
                    type="time"
                    aria-required={required || undefined}
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
            )}
        </div>
    );
};

export default TimeField;

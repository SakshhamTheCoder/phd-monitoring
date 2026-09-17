import React, { useEffect, useId, useState } from 'react';
import "./Fields.css";

const DropdownField = ({ label, options, initialValue, isLocked, onChange, required = false }) => {
    const [value, updateValue] = useState(initialValue ?? "");
    const fieldId = useId();

    // Keep in sync when initialValue arrives/changes after mount (e.g. edit-form prefill).
    useEffect(() => {
        if (initialValue !== undefined && initialValue !== null && initialValue !== "") {
            updateValue(initialValue);
        }
    }, [initialValue]);

    const list = options || [];
    const selected = list.find((option) => String(option.value) === String(value));

    // A prefilled value is often an id, so the list has to be able to show the
    // option it names. This used to be done by replacing the whole list with a
    // single option until a mouse `onClick` fired, which meant a keyboard user
    // who tabbed in and pressed the arrow keys saw a select with one choice and
    // no way to change it. Carrying the value as an extra option instead leaves
    // the real list in place for everyone.
    const showsUnlistedValue = value !== "" && !selected;

    const handleChange = (event) => {
        updateValue(event.target.value);
        onChange(event.target.value);
    };

    // A locked select is unreachable by keyboard and hidden from assistive tech,
    // so a locked value is read as text, the way a locked date is.
    if (isLocked) {
        return (
            <div className="input-field-container">
                {label && <span className="input-label">{label}</span>}
                <div className="input-field field-readonly">
                    {selected?.title ?? (value !== "" ? String(value) : 'Not provided')}
                </div>
            </div>
        );
    }

    return (
        <div className="input-field-container">
            {label && (
                <label className="input-label" htmlFor={fieldId}>
                    {label}{required && <span className="req" aria-hidden="true">*</span>}
                </label>
            )}
            <select
                id={fieldId}
                aria-required={required || undefined}
                className="input-field"
                value={value}
                onChange={handleChange}
            >
                <option value="">Select</option>
                {showsUnlistedValue && <option value={value}>{String(initialValue)}</option>}
                {list.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.title}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default DropdownField;

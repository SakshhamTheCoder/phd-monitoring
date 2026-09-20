import React, { useState, useEffect, useId } from 'react';
import { formatDate } from '../../../utils/timeParse';
import "./Fields.css";

// `min` and `max` are the input's own, for a pair of dates that bound each
// other: giving the closing date the opening one as its minimum is what stops
// a round that ends before it starts, at the point of picking rather than at
// the point of saving.
const DateField = ({ label, initialValue, isLocked, onChange, hint = null, showLabel = true, required = false, min = undefined, max = undefined }) => {
    const [hintText] = useState(hint || 'Select Date...');
    const [value, updateValue] = useState('');
    const fieldId = useId();

    // Format the initial value to "YYYY-MM-DD" if it’s in ISO format
    useEffect(() => {
        if (initialValue) {
            const parsed = new Date(initialValue);
            if (!Number.isNaN(parsed.getTime())) {
                updateValue(parsed.toISOString().split('T')[0]);
            } else {
                updateValue('');
            }
        } else {
            updateValue('');
        }
    }, [initialValue]);

    return (
        <div className="input-field-container">
            {showLabel && (
                <label className="input-label" htmlFor={isLocked ? undefined : fieldId}>
                    {label}{required && <span className="req" aria-hidden="true">*</span>}
                </label>
            )}
            {isLocked ? (
                // A locked date is text, not a disabled control. `input type=date`
                // draws itself in the browser's locale, so a read-only date sat
                // next to one rendered through formatDate showed the same kind of
                // value two ways: "12/05/2026" beside "13 Feb 2026". Reading it
                // through formatDate as well settles on one format everywhere, and
                // a disabled input was unreachable by keyboard anyway.
                //
                // The time is pinned so the date is read in the reader's own zone
                // rather than shifting a day behind UTC.
                <div className="input-field field-readonly">
                    {value ? formatDate(`${value}T00:00:00`) : 'Not provided'}
                </div>
            ) : (
                <input
                    id={fieldId}
                    type="date"
                    aria-required={required || undefined}
                    className="input-field"
                    min={min}
                    max={max}
                    value={value}
                    placeholder={hintText}
                    onChange={(e) => {
                        updateValue(e.target.value);
                        onChange(e.target.value);
                    }}
                />
            )}
        </div>
    );
};

export default DateField;

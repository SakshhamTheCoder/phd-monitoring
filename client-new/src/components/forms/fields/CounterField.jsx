import React, { useState } from 'react';
import "./Fields.css";

const CounterField = ({ label, initialValue = 0, isLocked = false, onChange, showLabel = true }) => {
    const [count, setCount] = useState(initialValue);

    const handleIncrement = () => {
        if (!isLocked) {
            const newValue = count + 1;
            setCount(newValue);
            onChange(newValue);
        }
    };

    const handleDecrement = () => {
        if (!isLocked && count > 0) {
            const newValue = count - 1;
            setCount(newValue);
            onChange(newValue);
        }
    };

    return (
        <div className="counter-field-container">
            {showLabel && <label className="counter-label">{label}</label>}
            <div className="counter-field">
                <button onClick={handleDecrement} disabled={isLocked || count <= 0} className="counter-button">-</button>
                <span className="counter-value">{count}</span>
                <button onClick={handleIncrement} disabled={isLocked} className="counter-button">+</button>
            </div>
        </div>
    );
};

export default CounterField;

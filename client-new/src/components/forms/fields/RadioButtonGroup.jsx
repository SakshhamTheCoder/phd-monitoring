import React, { useState, useEffect } from "react";
import "./Fields.css";

const RadioButtonGroup = ({
    titles = [],
    values = [],
    onSelect,
    name = `radio-group-${Math.random()}`, // Generate a unique name if not provided
    defaultValue = null,
}) => {
      const [selectedValue, setSelectedValue] = useState(defaultValue);
    
      // Sync `defaultValue` with `selectedValue` only if `defaultValue` changes
      useEffect(() => {
        if (defaultValue !== selectedValue) {
          setSelectedValue(defaultValue);
        }
      }, [defaultValue]);
    
      const handleSelection = (value) => {
        if (value !== selectedValue) {
          setSelectedValue(value);
          if (onSelect) {
            onSelect(value); // Notify parent about selection
          }
        }
      };
    
      return (
        <div className="radio-group-container">
          {titles.map((title, index) => (
            <label key={index} className="radio-label">
              <input
                type="radio"
                name={name}
                value={values[index]}
                checked={selectedValue === values[index]}
                onChange={() => handleSelection(values[index])}
                className="radio-input"
              />
              {title}
            </label>
          ))}
        </div>
      );
    };
    
    export default RadioButtonGroup;
    
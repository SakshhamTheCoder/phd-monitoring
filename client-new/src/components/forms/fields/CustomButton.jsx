import React from 'react';
import "./Fields.css";
// `type` defaults to "button". An HTML button inside a <form> submits it unless
// told otherwise, which is how Cancel and Close ended up submitting the form
// they were meant to dismiss.
const CustomButton = ({ text, onClick, disabled = false, label, variant, size, style, type = "button" }) => {
    return (
        <>
         {label && (<label className="input-label">{label}</label>)}
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            style={style}
            className={`custom-button${variant ? ` custom-button--${variant}` : ""}${size ? ` custom-button--${size}` : ""}`}
        >
            {text}
        </button>
        </>
    );
};
export default CustomButton;

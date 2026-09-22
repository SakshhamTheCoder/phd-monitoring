import React from 'react';
import "./Fields.css";
// `className` is how a page adds a one-off treatment. `style` predates it and
// is still accepted, but an inline style beats every stylesheet, so prefer the
// class.
// `type` defaults to "button". An HTML button inside a <form> submits it unless
// told otherwise, which is how Cancel and Close ended up submitting the form
// they were meant to dismiss.
const CustomButton = ({ text, onClick, disabled = false, label, variant, size, style, className, type = "button" }) => {
    return (
        <>
         {label && (<label className="input-label">{label}</label>)}
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            style={style}
            className={`custom-button${variant ? ` custom-button--${variant}` : ""}${size ? ` custom-button--${size}` : ""}${className ? ` ${className}` : ""}`}
        >
            {text}
        </button>
        </>
    );
};
export default CustomButton;

import React, { useEffect, useRef, useState } from 'react';
import "./Fields.css";
// `className` is how a page adds a one-off treatment. `style` predates it and
// is still accepted, but an inline style beats every stylesheet, so prefer the
// class.
// `type` defaults to "button". An HTML button inside a <form> submits it unless
// told otherwise, which is how Cancel and Close ended up submitting the form
// they were meant to dismiss.
//
// Busy: an onClick that returns a promise holds the button busy (spinner,
// disabled, aria-busy) until it settles, so a slow save cannot be pressed
// twice. `busy` does the same for work the page tracks itself.
// `done` shows a check for a finished action; see hooks/useDoneFlash.js.
const CustomButton = ({ text, onClick, disabled = false, busy = false, done = false, label, variant, size, style, className, type = "button" }) => {
    const [pending, setPending] = useState(false);
    const mounted = useRef(false);
    // Set in the effect, not the initializer: StrictMode unmounts and remounts
    // once in development, and the flag has to come back after that.
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    const handleClick = onClick && ((event) => {
        const result = onClick(event);
        if (typeof result?.then !== 'function') return;
        setPending(true);
        const settle = () => mounted.current && setPending(false);
        // The page handles its own failure; this only ends the busy state.
        result.then(settle, settle);
    });

    const isBusy = busy || pending;
    const showsDone = done && !isBusy;
    const classes = [
        'custom-button',
        variant && `custom-button--${variant}`,
        size && `custom-button--${size}`,
        isBusy && 'is-busy',
        showsDone && 'is-done',
        className,
    ].filter(Boolean).join(' ');

    return (
        <>
         {label && (<label className="input-label">{label}</label>)}
        <button
            type={type}
            onClick={handleClick}
            disabled={disabled || isBusy}
            aria-busy={isBusy || undefined}
            style={style}
            className={classes}
        >
            {/* Faded rather than hidden, so the button keeps its width and its
                accessible name while the spinner or check sits over it. */}
            <span className="custom-button-label">{text}</span>
            {isBusy && <span className="custom-button-spinner" aria-hidden="true" />}
            {showsDone && <i className="fa fa-check custom-button-check" aria-hidden="true" />}
        </button>
        </>
    );
};
export default CustomButton;

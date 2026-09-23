import React, { useCallback, useEffect, useId, useRef } from 'react';
import './CustomModal.css';

const FOCUSABLE = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

const CustomModal = ({
    isOpen,
    onClose,
    children,
    title,
    width,
    minWidth = '300px',
    maxWidth = '800px',
    minHeight = '200px',
    maxHeight = '600px',
    closeOnOutsideClick = true
}) => {
    const panelRef = useRef(null);
    const returnFocusRef = useRef(null);
    const titleId = useId();

    // Escape closes, and Tab is kept inside the panel. Without either, the page
    // behind the overlay still took focus, so a keyboard user tabbed into a
    // screen they could not see.
    const handleKeyDown = useCallback((event) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
            return;
        }
        if (event.key !== 'Tab') return;

        const targets = panelRef.current?.querySelectorAll(FOCUSABLE);
        if (!targets?.length) return;

        const first = targets[0];
        const last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return undefined;

        returnFocusRef.current = document.activeElement;
        // The page behind must not scroll under the overlay.
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // A dialog whose content carries its own heading (StudentForm, the
        // publication picker) is named by that heading, so it is not given a
        // second title on top.
        if (!title && panelRef.current) {
            const heading = panelRef.current.querySelector('.modal-title');
            if (heading) {
                heading.id = heading.id || `${titleId}-inner`;
                panelRef.current.setAttribute('aria-labelledby', heading.id);
                panelRef.current.removeAttribute('aria-label');
            }
        }
        // Focus the panel itself rather than guessing at a field, so the reader
        // hears the dialog's name before its contents.
        panelRef.current?.focus();

        return () => {
            document.body.style.overflow = previousOverflow;
            // Put focus back where it was, so closing a dialog does not dump the
            // reader at the top of the page.
            if (returnFocusRef.current instanceof HTMLElement) {
                returnFocusRef.current.focus();
            }
        };
    }, [isOpen]);

    if (!isOpen) return null;

    // Close only when the click lands on THIS overlay — not on the content, and not on
    // a nested modal's overlay bubbling up. Fixes nested modals closing the parent.
    const handleOverlayClick = (e) => {
        if (closeOnOutsideClick && e.target === e.currentTarget) {
            onClose();
        }
    };

    // Every width is capped at what the overlay actually has. A dialog asking
    // for 520px on a 390px phone used to draw 520px and push the page sideways,
    // because an inline width beats any stylesheet. min() resolves to the asked
    // width wherever there is room, so nothing moves on a desktop.
    const fit = (value) => `min(${value}, 100%)`;

    // When an explicit width is given, let it win over the default maxWidth cap.
    const sizeStyle = width
        ? { width: fit(width), minWidth: fit(minWidth), maxWidth: fit(width), minHeight, maxHeight }
        : { minWidth: fit(minWidth), maxWidth: fit(maxWidth), minHeight, maxHeight };

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div
                ref={panelRef}
                className="modal-content"
                style={sizeStyle}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                aria-label={title ? undefined : 'Dialog'}
                tabIndex={-1}
                onKeyDown={handleKeyDown}
            >
                <button type="button" className="modal-close-button" onClick={onClose} aria-label="Close">
                    <i className="fa fa-times" aria-hidden="true"></i>
                </button>
                {title && <div className="modal-title" id={titleId}>{title}</div>}
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default CustomModal;

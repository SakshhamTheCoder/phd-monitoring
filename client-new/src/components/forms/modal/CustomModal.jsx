import React from 'react';
import './CustomModal.css'; // Ensure you have this CSS file

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
    if (!isOpen) return null;

    // Close only when the click lands on THIS overlay — not on the content, and not on
    // a nested modal's overlay bubbling up. Fixes nested modals closing the parent.
    const handleOverlayClick = (e) => {
        if (closeOnOutsideClick && e.target === e.currentTarget) {
            onClose();
        }
    };

    // When an explicit width is given, let it win over the default maxWidth cap.
    const sizeStyle = width
        ? { width, minWidth, maxWidth: width, minHeight, maxHeight }
        : { minWidth, maxWidth, minHeight, maxHeight };

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal-content" style={sizeStyle}>
                <button className="modal-close-button" onClick={onClose} aria-label="Close">
                    <i className="fa fa-times" aria-hidden="true"></i>
                </button>
                {title && <div className="modal-title">{title}</div>}
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default CustomModal;

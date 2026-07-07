import React from "react";
import "./FormGrid.css";
import { useLocation } from 'react-router-dom';

// Required lifecycle milestones (left column) vs situational / as-needed forms
// (right column). The order within each column is fixed, so the layout stays
// stable even when only a subset of forms is enabled for a student — a disabled
// form never lets another slide into its place across the mandatory/optional divide.
const MANDATORY_ORDER = [
    "supervisor-allocation",
    "irb-constitution",
    "irb-submission",
    "synopsis-submission",
    "list-of-examiners",
    "thesis-submission",
];
const OPTIONAL_ORDER = [
    "status-change",
    "semester-off",
    "irb-extension",
    "supervisor-change",
    "thesis-extension",
    "revise-title",
];

const FormGrid = ({ forms }) => {
    const location = useLocation();

    const handleClick = (form) => {
        let path = location.pathname;
        if (path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        const newUrl = `${path}/${form.form_type}`;
        window.location.href = newUrl;
    };

    const pick = (order) =>
        order
            .map((type) => forms.find((f) => f.form_type === type))
            .filter(Boolean);

    const known = new Set([...MANDATORY_ORDER, ...OPTIONAL_ORDER]);
    const mandatory = pick(MANDATORY_ORDER);
    // Any unclassified / new form type falls back to the optional column so nothing
    // is ever silently dropped from the grid.
    const optional = [
        ...pick(OPTIONAL_ORDER),
        ...forms.filter((f) => !known.has(f.form_type)),
    ];

    const renderCard = (form) => (
        <div
            key={form.form_type}
            onClick={() => handleClick(form)}
            className="form-card"
            title={form.action_required ? "Action required" : undefined}
        >
            <span
                className={`form-status-dot ${form.action_required ? "active" : ""}`}
                aria-hidden="true"
            ></span>
            <h3 className="form-card-title">{form.form_name}</h3>
            <i className="fa-solid fa-chevron-right form-card-arrow" aria-hidden="true"></i>
        </div>
    );

    return (
        <>
            <div className="forms-list-header">
                <h2 className="form-grid-heading">Available Forms</h2>
                {forms.length > 0 && (
                    <div className="form-legend">
                        <span className="legend-item"><span className="legend-dot green"></span>Action required</span>
                        <span className="legend-item"><span className="legend-dot"></span>No action needed</span>
                    </div>
                )}
            </div>
            {forms.length > 0 ? (
                <div className="form-grid-container">
                    <div className="form-grid-column">{mandatory.map(renderCard)}</div>
                    <div className="form-grid-column">{optional.map(renderCard)}</div>
                </div>
            ) : (
                <p>No forms to display</p>
            )}
        </>
    );
};

export default FormGrid;

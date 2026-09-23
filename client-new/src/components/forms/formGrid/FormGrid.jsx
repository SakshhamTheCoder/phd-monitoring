import React from "react";
import "./FormGrid.css";
import { useLocation, useNavigate } from 'react-router-dom';

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
    // URF: the application and its additional information on the left...
    "urf-application",
    "urf-additional-info",
];
const OPTIONAL_ORDER = [
    "status-change",
    "semester-off",
    "irb-extension",
    "supervisor-change",
    "thesis-extension",
    "revise-title",
    // ...and the two reports on the right.
    "urf-half-yearly-report",
    "urf-final-report",
];

// A form may carry its own `path`; `title={null}` leaves out the heading, for a
// page that shows several grids under headings of its own.
const FormGrid = ({ forms, title = "Available Forms", loading = false }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const handleClick = (form) => {
        let path = location.pathname;
        if (path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        const newUrl = `${path}/${form.form_type}`;
        const target = form.path || newUrl;
        // An app path is routed in place; a full page load would restart the app.
        // Anything else, such as an absolute URL, still gets a real navigation.
        if (target.startsWith('/') && !target.startsWith('//')) {
            navigate(target);
        } else {
            window.location.href = target;
        }
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
            <i className="fa fa-chevron-right form-card-arrow" aria-hidden="true"></i>
        </div>
    );

    return (
        <>
            {title && (
            <div className="forms-list-header">
                <h1 className="page-title">{title}</h1>
                {forms.length > 0 && (
                    <div className="form-legend">
                        <span className="legend-item"><span className="legend-dot green"></span>Action required</span>
                        <span className="legend-item"><span className="legend-dot"></span>No action needed</span>
                    </div>
                )}
            </div>
            )}
            {forms.length > 0 ? (
                <div className="form-grid-container">
                    <div className="form-grid-column">{mandatory.map(renderCard)}</div>
                    <div className="form-grid-column">{optional.map(renderCard)}</div>
                </div>
            ) : (
                <p>{loading ? 'Loading forms…' : 'No forms yet.'}</p>
            )}
        </>
    );
};

export default FormGrid;

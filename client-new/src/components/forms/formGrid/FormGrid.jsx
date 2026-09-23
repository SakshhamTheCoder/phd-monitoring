import React from "react";
import "./FormGrid.css";
import { Link, useLocation } from 'react-router-dom';
import Panel from "../../panel/Panel";
import StatusNotice from "../../common/StatusNotice";

// Required lifecycle milestones (left column) vs situational / as-needed forms
// (right column). The order within each column is fixed, so the layout stays
// stable even when only a subset of forms is enabled for a student: a disabled
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

// A form may carry its own `path`. With a `title` the grid is a panel of its
// own; `title={null}` draws the tiles alone, for a page that shows several
// grids inside panels of its own.
const FormGrid = ({ forms, title = "Available forms", loading = false }) => {
    const location = useLocation();

    const targetOf = (form) => {
        let path = location.pathname;
        if (path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        return form.path || `${path}/${form.form_type}`;
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

    // A real link, so the card is reachable by keyboard and opens in a new tab
    // like any other. An app path is routed in place, since a full page load
    // would restart the app; anything else, such as an absolute URL, still gets
    // a real navigation.
    const renderCard = (form) => {
        const target = targetOf(form);
        const inApp = target.startsWith('/') && !target.startsWith('//');
        const content = (
            <>
                <span
                    className={`form-status-dot ${form.action_required ? "active" : ""}`}
                    aria-hidden="true"
                ></span>
                <h3 className="form-card-title">
                    {form.form_name}
                    {form.action_required && <span className="sr-only"> (action required)</span>}
                </h3>
                <i className="fa fa-chevron-right form-card-arrow" aria-hidden="true"></i>
            </>
        );
        const cardProps = {
            className: "form-card",
            title: form.action_required ? "Action required" : undefined,
        };
        return inApp
            ? <Link key={form.form_type} {...cardProps} to={target}>{content}</Link>
            : <a key={form.form_type} {...cardProps} href={target}>{content}</a>;
    };

    const grid = forms.length > 0 ? (
        <div className="form-grid-container reveal">
            <div className="form-grid-column">{mandatory.map(renderCard)}</div>
            <div className="form-grid-column">{optional.map(renderCard)}</div>
        </div>
    ) : loading ? (
        <StatusNotice tone="loading" title="Loading forms" />
    ) : (
        <StatusNotice tone="empty" title="No forms yet" />
    );

    if (!title) return grid;

    const legend = forms.length > 0 && (
        <div className="form-legend">
            <span className="legend-item"><span className="legend-dot green"></span>Action required</span>
            <span className="legend-item"><span className="legend-dot"></span>No action needed</span>
        </div>
    );

    return <Panel title={title} actions={legend}>{grid}</Panel>;
};

export default FormGrid;

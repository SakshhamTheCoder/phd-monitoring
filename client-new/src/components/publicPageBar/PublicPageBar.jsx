import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

/**
 * The bar on the pages a signed-out visitor can reach: team, support, privacy.
 *
 * All three had their own copy of it, and they had started to differ. One
 * shape: the logo in the left corner, the page's own label beside it when it
 * has one, and the two ways out on the right.
 *
 * `title` is optional. Support and Privacy carry their title in the page, where
 * a long document wants it; the team page has no room for a second one.
 */
const PublicPageBar = ({ title, containerClassName = '' }) => {
    const navigate = useNavigate();

    return (
        <nav className="page-navbar">
            <div className={`nav-container ${containerClassName}`.trim()}>
                <div className="nav-left">
                    <Link to="/" className="nav-logo-link" aria-label="Home">
                        <img src="/images/tiet_logo.png" alt="Thapar Institute" className="nav-logo" />
                    </Link>
                    {title && <h1 className="nav-title">{title}</h1>}
                </div>
                <div className="nav-right">
                    <button type="button" onClick={() => navigate(-1)} className="back-button">
                        ← Back
                    </button>
                    <Link to="/" className="nav-home-link">Home</Link>
                </div>
            </div>
        </nav>
    );
};

export default PublicPageBar;

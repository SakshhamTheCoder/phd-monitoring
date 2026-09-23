import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './PublicPageBar.css';

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
    const location = useLocation();
    // Opened directly (a shared link, a new tab), there is no page of ours to
    // go back to, and navigate(-1) would leave the site.
    const goBack = () => (location.key === 'default' ? navigate('/') : navigate(-1));

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
                    <button type="button" onClick={goBack} className="back-button">
                        ← Back
                    </button>
                    <Link to="/" className="nav-home-link">Home</Link>
                </div>
            </div>
        </nav>
    );
};

export default PublicPageBar;

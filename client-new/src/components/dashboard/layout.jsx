import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './layout.css';
import TopBar from '../topbar/TopBar';
import NavBar from '../navbar/CustomNavBar';

const Layout = ({ children }) => {
    // The sidebar is a fixed column on a desktop and a drawer below the mobile
    // breakpoint, where 225px of a 375px screen is most of the page.
    const [navOpen, setNavOpen] = useState(false);
    const { pathname } = useLocation();
    const toggleRef = useRef(null);

    // Following a link should leave the drawer closed behind you.
    useEffect(() => setNavOpen(false), [pathname]);

    useEffect(() => {
        if (!navOpen) return undefined;
        const closeOnEscape = (event) => {
            if (event.key !== 'Escape') return;
            setNavOpen(false);
            toggleRef.current?.focus();
        };
        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [navOpen]);

    return (
        <div className={`layout ${navOpen ? 'layout--nav-open' : ''}`}>
            <a className="skip-link" href="#main">Skip to content</a>
            <div className="sidebar" id="main-nav">
                <NavBar />
            </div>
            {/* Catches the tap outside the drawer. Hidden from assistive tech,
                which closes the drawer with Escape or the toggle instead. */}
            <div
                className="sidebar-scrim"
                onClick={() => setNavOpen(false)}
                aria-hidden="true"
            />
            <div className="main-content">
                <header className="topbar">
                    <button
                        type="button"
                        ref={toggleRef}
                        className="nav-toggle"
                        aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
                        aria-expanded={navOpen}
                        aria-controls="main-nav"
                        onClick={() => setNavOpen((open) => !open)}
                    >
                        <i className={`fa ${navOpen ? 'fa-times' : 'fa-bars'}`} aria-hidden="true" />
                    </button>
                    <TopBar />
                </header>
                <main className="content" id="main" tabIndex={-1}>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Layout;

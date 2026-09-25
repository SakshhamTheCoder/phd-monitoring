import React, { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAccess } from '../../context/CapabilitiesContext';
import './NavBar.css';

const CustomNavBar = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // The sidebar for this role, already filtered by the server for its areas,
    // switched-off modules and capabilities (config/navigation.php).
    const visibleButtons = useAccess().nav;

    const activeIndex = visibleButtons.findIndex(({ path }) => location.pathname.startsWith(path));

    // One highlight that slides to the new link, so a navigation shows where it
    // went. It only animates after its first placement, or it would slide down
    // from the top on every load.
    const listRef = useRef(null);
    const [highlight, setHighlight] = useState(null);
    useLayoutEffect(() => {
        let live = true;
        const place = () => {
            const link = live && listRef.current?.querySelectorAll('.menu-button')[activeIndex];
            if (live) setHighlight((previous) => (link
                ? { top: link.offsetTop, height: link.offsetHeight, placed: previous !== null }
                : null));
        };
        place();
        // A two-line label can rewrap once the web font arrives.
        document.fonts?.ready.then(place);
        return () => { live = false; };
    }, [activeIndex, visibleButtons.length]);

    return (
        <nav className="side-left-menu" aria-label="Main">
            <div className="tietlogo">
                <img src="/images/tiet_logo.png" alt="Thapar Institute of Engineering and Technology" />
            </div>
            <div className="icons" ref={listRef}>
                {highlight && (
                    <span
                        className={`menu-highlight${highlight.placed ? ' menu-highlight--moves' : ''}`}
                        style={{ transform: `translateY(${highlight.top}px)`, height: highlight.height }}
                        aria-hidden="true"
                    />
                )}
                {visibleButtons.map(({ path, icon, label: text }, index) => {
                    const isActive = index === activeIndex;
                    return (
                        <button
                            key={`${path}-${text}`}
                            type="button"
                            className={`menu-button ${isActive ? 'active' : ''}`}
                            aria-current={isActive ? 'page' : undefined}
                            onClick={() => navigate(path)}
                        >
                            <span className="icon"><i className={`fa fa-${icon}`} aria-hidden="true" /></span>
                            <span className="text">{text}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default CustomNavBar;

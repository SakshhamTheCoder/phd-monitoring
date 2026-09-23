import React, { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFeatures } from '../../context/FeaturesContext';
import { useCapabilities } from '../../context/CapabilitiesContext';
import { ACCESS, currentRole } from '../../auth/access';
import './NavBar.css';

// Exported so the breadcrumb names a route the same way the nav does, instead
// of keeping a second list that drifts.
//
// `roles` comes from src/auth/access.js, which the route table in App.jsx reads
// too, so a link and the page behind it can no longer disagree.
export const buttonConfig = [
    // A UG student's home is their profile, so it is named for what it shows.
    { path: '/home', icon: 'fa fa-user', text: 'Profile', roles: ['ug_student'] },
    { path: '/home', icon: 'fa fa-home', text: 'Home', roles: ACCESS.home.filter(r => r !== 'ug_student') },
    { path: '/projects', icon: 'fa fa-briefcase', text: 'Projects', roles: ACCESS.projects, feature: 'project_management' },
    { path: '/forms', icon: 'fa fa-file-text', text: 'Forms', roles: ACCESS.home },
    { path: '/presentation', icon: 'fa fa-tasks', text: 'Progress Monitoring', roles: ACCESS.presentations },
    { path: '/publications', icon: 'fa fa-book', text: 'Publications', roles: ACCESS.publications },
    // The office owns the page and a mentor reaches it while they mentor
    // something, so either capability opens it. Listing only the mentor one hid
    // the entry from the office, whose can_read_urf_mentees is false.
    { path: '/urf', icon: 'fa fa-flask', text: 'URF', roles: ACCESS.urf, capability: ['can_manage_urf', 'can_read_urf_mentees'] },
    { path: '/openings', icon: 'fa fa-bullhorn', text: 'Openings', roles: ACCESS.openings, feature: 'job_openings' },
    { path: '/courses', icon: 'fa fa-graduation-cap', text: 'Courses', roles: ACCESS.courses },
    { path: '/students', icon: 'fa fa-users', text: 'Students', roles: ACCESS.scholars },
    { path: '/faculty', icon: 'fa fa-id-badge', text: 'Faculty', roles: ACCESS.facultyDirectory },
    { path: '/clerks', icon: 'fa fa-id-card-o', text: 'Clerks', roles: ACCESS.admin },
    { path: '/departments', icon: 'fa fa-building', text: 'Departments', roles: ACCESS.departments },
    { path: '/supervisor-doctoral-approvals', icon: 'fa fa-user-plus', text: 'Supervisor Approvals', roles: ACCESS.supervisorApprovals },
    { path: '/attendance', icon: 'fa fa-calendar-check-o', text: 'Attendance', roles: ACCESS.attendance },
    { path: '/configuration', icon: 'fa fa-sliders', text: 'Configuration', roles: ACCESS.admin },
    { path: '/logs', icon: 'fa fa-history', text: 'Logs', roles: ACCESS.admin },
    { path: '/users', icon: 'fa fa-cogs', text: 'Manage Users', roles: ACCESS.admin },
    { path: '/notifications', icon: 'fa fa-bell', text: 'Notifications', roles: ACCESS.notifications },
    { path: '/areasOfSpecialization', icon: 'fa fa-list', text: 'Areas of Specialization', roles: ACCESS.areasOfSpecialization },
    { path: '/outside-experts', icon: 'fa fa-user-o', text: 'Outside Experts', roles: ACCESS.admin },
];

const CustomNavBar = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const userRole = currentRole();
    const features = useFeatures();
    const can = useCapabilities();
    // `capability` is for a page a role may reach only sometimes; the server
    // decides. A list means any one of them opens it, for a page two different
    // roles reach for two different reasons.
    const holds = (capability) => !capability
        || (Array.isArray(capability) ? capability.some(can) : can(capability));

    const visibleButtons = buttonConfig.filter(
        button => button.roles.includes(userRole)
            && (!button.feature || features[button.feature])
            && holds(button.capability)
    );

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
                {visibleButtons.map(({ path, icon, text }, index) => {
                    const isActive = index === activeIndex;
                    return (
                        <button
                            key={`${path}-${text}`}
                            type="button"
                            className={`menu-button ${isActive ? 'active' : ''}`}
                            aria-current={isActive ? 'page' : undefined}
                            onClick={() => navigate(path)}
                        >
                            <span className="icon"><i className={icon} aria-hidden="true" /></span>
                            <span className="text">{text}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default CustomNavBar;

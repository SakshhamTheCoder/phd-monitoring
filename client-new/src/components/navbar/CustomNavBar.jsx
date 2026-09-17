import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFeatures } from '../../context/FeaturesContext';
import { useCapabilities } from '../../context/CapabilitiesContext';
import { ACCESS } from '../../auth/access';
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
    // Mentors reach it too, but only while they mentor something.
    { path: '/urf', icon: 'fa fa-flask', text: 'URF', roles: ACCESS.urf, capability: 'can_read_urf_mentees' },
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
    { path: '/areasOfSpecialization', icon: 'fa fa-list', text: 'Areas of Specialization', roles: ACCESS.admin },
    { path: '/outside-experts', icon: 'fa fa-user-o', text: 'Outside Experts', roles: ACCESS.admin },
];

const CustomNavBar = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const userRole = localStorage.getItem('userRole');
    const features = useFeatures();
    const can = useCapabilities();
    // `capability` is for a page a role may reach only sometimes; the server decides.
    const visibleButtons = buttonConfig.filter(
        button => button.roles.includes(userRole)
            && (!button.feature || features[button.feature])
            && (!button.capability || can(button.capability))
    );

    return (
        <nav className="side-left-menu" aria-label="Main">
            <div className="tietlogo">
                <img src="/images/tiet_logo.png" alt="Thapar Institute of Engineering and Technology" />
            </div>
            <div className="icons">
                {visibleButtons.map(({ path, icon, text }) => {
                    const isActive = location.pathname.startsWith(path);
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

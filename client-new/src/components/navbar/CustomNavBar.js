import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFeatures } from '../../context/FeaturesContext';
import './NavBar.css';

// Exported so the breadcrumb names a route the same way the nav does, instead
// of keeping a second list that drifts.
export const buttonConfig = [
    { path: '/home', icon: <i class="fa fa-home" aria-hidden="true"></i>, text: 'Home', roles: ['student', 'hod', 'phd_coordinator', 'faculty', 'dordc', 'adordc', 'dra', 'director', 'doctoral', 'external', 'admin'] },
    { path: '/projects', icon: <i class="fa fa-briefcase" aria-hidden="true"></i>, text: 'Projects', roles: ['faculty', 'hod', 'phd_coordinator', 'dordc', 'adordc', 'dra', 'director', 'admin'], feature: 'project_management' },
    { path: '/forms', icon: <i class="fa fa-file-text" aria-hidden="true"></i>, text: 'Forms', roles: ['student', 'hod', 'phd_coordinator', 'faculty', 'dordc', 'adordc', 'dra', 'director', 'doctoral', 'external', 'admin'] },
    { path: '/presentation', icon: <i class="fa fa-tasks" aria-hidden="true"></i>, text: 'Progress Monitoring', roles: ['student', 'hod', 'phd_coordinator', 'faculty', 'dordc', 'adordc', 'dra', 'director', 'doctoral', 'admin'] },
    { path: '/publications', icon: <i class="fa fa-book" aria-hidden="true"></i>, text: 'Publications', roles: ['student'] },
    { path: '/openings', icon: <i class="fa fa-bullhorn" aria-hidden="true"></i>, text: 'Openings', roles: ['student'], feature: 'job_openings' },
    { path: '/courses', icon: <i class="fa fa-graduation-cap" aria-hidden="true"></i>, text: 'Courses', roles: ['student', 'hod', 'phd_coordinator', 'admin'] },
    { path: '/students', icon: <i class="fa fa-users" aria-hidden="true"></i>, text: 'Students', roles: ['hod', 'phd_coordinator', 'faculty', 'dordc', 'adordc', 'dra', 'director', 'doctoral', 'external', 'admin'] },
    { path: '/faculty', icon: <i class="fa-solid fa-person-chalkboard"></i>, text: 'Faculty', roles: ['hod', 'phd_coordinator', 'dordc', 'adordc', 'dra', 'director', 'admin'] },
    { path: '/departments', icon: <i class="fa-solid fa-building"></i>, text: 'Departments', roles: ['dordc', 'adordc', 'dra', 'director', 'admin'] },
    { path: '/supervisor-doctoral-approvals', icon: <i class="fa-solid fa-check-circle"></i>, text: 'Supervisor Approvals', roles: ['dordc', 'admin'] },
    { path: '/logs', icon: <i class="fa-solid fa-history"></i>, text: 'Logs', roles: ['admin'] },
    { path: '/users', icon: <i class="fa-solid fa-users-cog"></i>, text: 'Manage Users', roles: ['admin'] },
    { path: '/notifications', icon: <i class="fa-solid fa-bell"></i>, text: 'Notifications', roles: ['student', 'hod', 'phd_coordinator', 'faculty', 'dordc', 'adordc', 'dra', 'director', 'doctoral', 'external', 'admin'] },
    { path: '/areasOfSpecialization', icon: <i class="fa fa-list" aria-hidden="true"></i>, text: 'Areas of Specialization', roles: ['admin'] },
    { path: '/outside-experts', icon: <i class="fa fa-user-tie" aria-hidden="true"></i>, text: 'Outside Experts', roles: ['admin'] },
    { path: '/research-profile', icon: <i class="fa fa-user-circle" aria-hidden="true"></i>, text: 'Research Profile', roles: ['faculty', 'hod', 'phd_coordinator', 'dordc', 'adordc', 'dra', 'director', 'admin'], feature: 'research_profile' },
];

const CustomNavBar = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const userRole = localStorage.getItem('userRole');
    const features = useFeatures();
    const visibleButtons = buttonConfig.filter(
        button => button.roles.includes(userRole) && (!button.feature || features[button.feature])
    );

    return (
        <div className="side-left-menu">
            <div className="tietlogo">
                <img src="/images/tiet_logo.png" alt="Logo" />
            </div>
            <div className="icons">
                {visibleButtons.map(({ path, icon, text }) => (
                    <button
                        key={path}
                        className={`menu-button ${location.pathname.startsWith(path) ? 'active' : ''}`}
                        onClick={() => navigate(path)}
                    >
                        <span className="icon">{icon}</span>
                        <span className="text">{text}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default CustomNavBar;

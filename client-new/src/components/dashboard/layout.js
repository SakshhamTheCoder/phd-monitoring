import React from 'react';
import './layout.css';
import TopBar from '../topbar/TopBar';
import NavBar from '../navbar/CustomNavBar';

const Layout = ({ children }) => {
    return (
        <div className="layout">
            <div className="sidebar">
                <NavBar />
            </div>
            <div className="main-content">
                <header className="topbar">
                    <TopBar />
                </header>
                <div className="content">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Layout;

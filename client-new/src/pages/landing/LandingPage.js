import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  const features = [
    {
      title: 'Online Form Submission',
      description: 'Submit and track important PhD forms digitally without manual paperwork'
    },
    {
      title: 'Supervisor Management',
      description: 'Streamlined supervisor allocation and change request workflows'
    },
    {
      title: 'IRB Constitution',
      description: 'Institutional Review Board setup and related submission management'
    },
    {
      title: 'Progress Tracking',
      description: 'Real-time visibility of academic progress for students and supervisors'
    },
    {
      title: 'Synopsis & Thesis',
      description: 'Digital submission and approval workflow for synopsis and thesis'
    },
    {
      title: 'Centralized Communication',
      description: 'All academic documents and communication in one platform'
    }
  ];

  const workflow = [
    { name: 'Supervisor Allocation', type: 'main' },
    { name: 'IRB Submission', type: 'main' },
    { name: 'Revised IRB Submission', type: 'main' },
    { name: 'Coursework / 6 Month Progress', type: 'main' },
    { name: 'Synopsis Submission', type: 'main', note: 'Supervisor submits List of Examiners in parallel' },
    { name: 'Thesis Submission', type: 'main' }
  ];

  const optionalForms = [
    'Status Change',
    'Semester Off',
    'IRB Extension',
    'Supervisor Change',
    'Thesis Extension',
    'Revised Title or Objectives'
  ];

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="nav-brand">
            <img src="/images/tiet_logo.png" alt="University Logo" className="nav-logo" />
            <span className="nav-title">PhD Portal <span className="beta-badge">BETA</span></span>
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#workflow">Workflow</a>
            <Link to="/login" className="nav-login-btn">Login</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">PhD Monitoring & Management Portal</h1>
            <div className="beta-notice">
              <span className="beta-highlight">●</span>
              <span>Currently in Beta Testing Phase</span>
            </div>
            <p className="hero-subtitle">
              Platform to streamline and automate every stage of the PhD journey
            </p>
            <p className="hero-description">
              Bringing scholars, supervisors, doctoral committees, and administrative authorities together on a unified system
            </p>
            <div className="hero-buttons">
              <Link to="/login" className="btn btn-primary">Login to Portal</Link>
              <a href="#features" className="btn btn-secondary">Explore Features</a>
            </div>
          </div>
          <div className="hero-image">
            <div className="hero-graphic">
              <div className="graphic-circle"></div>
              <div className="graphic-dots"></div>
              <img src="/images/tiet_logo.png" alt="PhD Excellence" className="hero-logo" />
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="about-section">
        <div className="container">
          <h2 className="section-title">About the Portal</h2>
          <div className="about-content">
            <p className="about-text">
              The PhD Portal is a comprehensive digital platform designed to streamline and automate every stage of the PhD journey. 
              It eliminates manual paperwork, miscommunication, and delays traditionally associated with the PhD lifecycle.
            </p>
            <p className="about-text">
              By digitizing forms, approvals, document management, communication, and progress monitoring, the PhD Portal ensures 
              accuracy, accountability, and real-time visibility for all stakeholders. It reduces dependency on physical files and 
              offline follow-ups, enabling a smooth and organized PhD experience.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <h2 className="section-title">Key Features</h2>
          <p className="section-subtitle">
            Comprehensive tools to manage every aspect of the PhD journey
          </p>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="workflow-section">
        <div className="container">
          <h2 className="section-title">PhD Workflow</h2>
          <p className="section-subtitle">
            Track your progress through the complete PhD lifecycle
          </p>
          
          <div className="workflow-layout">
            {/* Circular Workflow */}
            <div className="workflow-circle-wrapper">
              <div className="workflow-circle-container">
                <div className="workflow-circle">
                  {workflow.map((stage, index) => {
                    const angle = (index / workflow.length) * 360 - 90;
                    const radius = 200;
                    const x = Math.cos((angle * Math.PI) / 180) * radius;
                    const y = Math.sin((angle * Math.PI) / 180) * radius;
                    
                    return (
                      <div
                        key={index}
                        className="workflow-node"
                        style={{
                          transform: `translate(${x}px, ${y}px)`
                        }}
                      >
                        <div className="workflow-node-circle">
                          <span className="workflow-node-number">{index + 1}</span>
                        </div>
                        <div className="workflow-node-label">
                          {stage.name}
                          {stage.note && <span className="workflow-note">{stage.note}</span>}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Center decoration */}
                  <div className="workflow-center">
                    <div className="workflow-center-icon">PhD</div>
                    <div className="workflow-center-text">Journey</div>
                  </div>
                  
                  {/* Connection lines (SVG overlay) */}
                  <svg className="workflow-connections" viewBox="-250 -250 500 500">
                    <defs>
                      <marker
                        id="arrowhead"
                        markerWidth="10"
                        markerHeight="10"
                        refX="9"
                        refY="3"
                        orient="auto"
                      >
                        <polygon points="0 0, 10 3, 0 6" fill="var(--primary-color)" />
                      </marker>
                    </defs>
                    {workflow.map((_, index) => {
                      if (index === workflow.length - 1) return null;
                      const angle1 = (index / workflow.length) * 360 - 90;
                      const angle2 = ((index + 1) / workflow.length) * 360 - 90;
                      const radius = 200;
                      const x1 = Math.cos((angle1 * Math.PI) / 180) * radius;
                      const y1 = Math.sin((angle1 * Math.PI) / 180) * radius;
                      const x2 = Math.cos((angle2 * Math.PI) / 180) * radius;
                      const y2 = Math.sin((angle2 * Math.PI) / 180) * radius;
                      
                      return (
                        <line
                          key={index}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="var(--primary-color)"
                          strokeWidth="2"
                          markerEnd="url(#arrowhead)"
                          opacity="0.6"
                        />
                      );
                    })}
                  </svg>
                </div>
              </div>
            </div>

            {/* Optional Forms */}
            <div className="optional-forms-section">
              <h3 className="optional-forms-title">Optional Forms</h3>
              <p className="optional-forms-subtitle">
                Available Anytime
              </p>
              <div className="optional-forms-grid">
                {optionalForms.map((form, index) => (
                  <div key={index} className="optional-form-card">
                    <div className="optional-form-dot">●</div>
                    <span>{form}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2 className="cta-title">Empowering Research Through Technology</h2>
            <p className="cta-subtitle">
              Simplifying processes. Enhancing collaboration. Supporting excellence in research.
            </p>
            <Link to="/login" className="btn btn-large">Login to Continue →</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <img src="/images/tiet_logo.png" alt="University Logo" className="footer-logo" />
              <p className="footer-text">PhD Monitoring & Management Portal</p>
              <p className="footer-text">Thapar Institute of Engineering & Technology</p>
            </div>
            <div className="footer-section">
              <h4>Quick Links</h4>
              <ul className="footer-links">
                <li><Link to="/login">Login</Link></li>
                <li><Link to="/openings">Research Openings</Link></li>
                <li><Link to="/support">Support</Link></li>
                <li><Link to="/privacy">Privacy Policy</Link></li>
                <li><Link to="/team">Our Team</Link></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Contact</h4>
              <p className="footer-text">Email: dordc@thapar.edu</p>
              <p className="footer-text">Office Hours: Mon-Fri, 9 AM - 5 PM</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 Thapar Institute of Engineering & Technology. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

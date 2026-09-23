import React from 'react';
import { Link } from 'react-router-dom';
import { useFeatures } from '../../context/FeaturesContext';
// Signed out, nothing else has loaded the button styles the links borrow.
import '../../components/forms/fields/Fields.css';
import './LandingPage.css';

// The PhD workflow section is off the page for now. It is switched rather than
// deleted because it is coming back, and rather than commented out because the
// block holds JSX comments, which do not nest.
const SHOW_WORKFLOW = false;

const LandingPage = () => {
  const featureFlags = useFeatures();
  const features = [
    {
      title: 'Online form submission',
      description: 'Submit and track important PhD forms digitally without manual paperwork'
    },
    {
      title: 'Supervisor management',
      description: 'Streamlined supervisor allocation and change request workflows'
    },
    {
      title: 'IRB Constitution',
      description: 'Institutional Review Board setup and related submission management'
    },
    {
      title: 'Progress tracking',
      description: 'Real-time visibility of academic progress for students and supervisors'
    },
    {
      title: 'Presentations',
      description: 'Schedule semester presentations and record doctoral committee evaluation'
    },
    {
      title: 'Publication records',
      description: 'Log journal and conference publications in one verified record'
    },
    {
      title: 'Synopsis and thesis',
      description: 'Digital submission and approval workflow for synopsis and thesis'
    },
    {
      title: 'Research projects',
      description: 'Create projects, track milestones, and manage project teams'
    },
    {
      title: 'Centralized communication',
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

  // Where each stage sits on the ring. The nodes and the arrows between them
  // used to work this out separately, from the same two constants.
  const RING_RADIUS = 200;
  const nodePoints = workflow.map((_, index) => {
    const angle = (((index / workflow.length) * 360 - 90) * Math.PI) / 180;
    return { x: Math.cos(angle) * RING_RADIUS, y: Math.sin(angle) * RING_RADIUS };
  });

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
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <img src="/images/tiet_logo.png" alt="University Logo" className="landing-logo" />
            <span className="landing-brand-name">Doctoral, Research and Innovation Management Portal <span className="badge badge--accent">Beta</span></span>
          </div>
          <div className="landing-links">
            <a href="#features">Features</a>
            {SHOW_WORKFLOW && <a href="#workflow">Workflow</a>}
            <Link to="/team">Team</Link>
            <Link to="/login" className="custom-button custom-button--secondary">Login</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">Doctoral, Research and Innovation Management Portal</h1>
            <div className="beta-notice">
              <span className="beta-highlight">●</span>
              <span>Currently in beta testing phase</span>
            </div>
            <p className="hero-subtitle">
              Platform to streamline and automate every stage of the research and innovation journey
            </p>
            <p className="hero-description">
              Bringing scholars, supervisors, doctoral committees, and administrative authorities together on a unified system
            </p>
            <div className="hero-buttons">
              <Link to="/login" className="custom-button">Login to portal</Link>
              <a href="#features" className="custom-button custom-button--secondary">Explore features</a>
            </div>
          </div>
          <div className="hero-image">
            <div className="hero-graphic">
              <div className="graphic-circle"></div>
              <div className="graphic-dots"></div>
              <img src="/images/tiet_logo.png" alt="University Logo" className="hero-logo" />
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="about-section">
        <div className="landing-container">
          <h2 className="landing-section-title">About the portal</h2>
          <div className="about-content">
            <p className="about-text">
              The Doctoral, Research and Innovation Management Portal is a comprehensive digital platform designed to streamline and automate every stage of the research and innovation journey. 
              It eliminates manual paperwork, miscommunication, and delays traditionally associated with the PhD lifecycle.
            </p>
            <p className="about-text">
              By digitizing forms, approvals, document management, communication, and progress monitoring, the portal ensures 
              accuracy, accountability, and real-time visibility for all stakeholders. It reduces dependency on physical files and 
              offline follow-ups, enabling a smooth and organized PhD experience.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="landing-container">
          <h2 className="landing-section-title">Key features</h2>
          <p className="landing-section-subtitle">
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
      {SHOW_WORKFLOW && (
      <section id="workflow" className="workflow-section">
        <div className="landing-container">
          <h2 className="landing-section-title">PhD workflow</h2>
          <p className="landing-section-subtitle">
            Track your progress through the complete PhD lifecycle
          </p>
          
          <div className="workflow-layout">
            {/* Circular Workflow */}
            <div className="workflow-circle-wrapper">
              <div className="workflow-circle-container">
                <div className="workflow-circle">
                  {workflow.map((stage, index) => {
                    const { x, y } = nodePoints[index];

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
                    {nodePoints.slice(0, -1).map((from, index) => {
                      const to = nodePoints[index + 1];

                      return (
                        <line
                          key={index}
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
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
              <h3 className="optional-forms-title">Optional forms</h3>
              <p className="optional-forms-subtitle">
                Available anytime
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
      )}

      {/* CTA Section */}
      <section className="cta-section">
        <div className="landing-container">
          <div className="cta-content">
            <h2 className="cta-title">Empowering research through technology</h2>
            <p className="cta-subtitle">
              Simplifying processes. Enhancing collaboration. Supporting excellence in research.
            </p>
            <Link to="/login" className="cta-button">Login to continue</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="footer-content">
            <div className="footer-section">
              <img src="/images/tiet_logo.png" alt="University Logo" className="footer-logo" />
              <p className="footer-text">Doctoral, Research and Innovation Management Portal</p>
              <p className="footer-text">Thapar Institute of Engineering & Technology</p>
            </div>
            <div className="footer-section">
              <h4>Quick links</h4>
              <ul className="footer-links">
                <li><Link to="/login">Login</Link></li>
                {featureFlags.job_openings && <li><Link to="/openings">Research openings</Link></li>}
                <li><Link to="/support">Support</Link></li>
                <li><Link to="/privacy">Privacy policy</Link></li>
                <li><Link to="/team">Our team</Link></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Contact</h4>
              <p className="footer-text">Email: dordc@thapar.edu</p>
              <p className="footer-text">Office Hours: Mon-Fri, 9 AM - 5 PM</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} Thapar Institute of Engineering & Technology. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

import React from 'react';
import './HomePage.css'; 

const HomePage = () => {
  return (
    <div className="home-container">
      <div className="content-data">
        <h1>Welcome to PHD Monitoring</h1>
        <p>Explore the latest updates and data on your research.</p>
        <a href="/login" className="login-link">Login</a>
      </div>
    </div>
  );
}

export default HomePage;

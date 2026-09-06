import React from 'react';
import './NotFound.css'; 
import SCIJournal from '../../components/publications/SCIJournal';
import Conference from '../../components/publications/Conference';
import Patents from '../../components/publications/Patents';
import AddPublication from '../../components/publications/AddPublication';
import Layout from '../../components/dashboard/layout';
const NotFound = () => {
  return (
    // <Layout children={<AddPublication></AddPublication>}/>
    <div className="not-found-container">
      <div className="not-found-box">
        <h1>404</h1>
        <p>Page Not Found</p>
        <a href="/home" className="back-link">Home</a>
      </div>
    </div>
  );
}

export default NotFound;

// Loader.js
import React from 'react';
import './Loader.css'; // Import CSS for loader styles

const Loader = () => {
  return (
    <div className="loader">
      {/* You can customize this with an image or spinner */}
      <div className="spinner"></div>
    </div>
  );
};

export default Loader;

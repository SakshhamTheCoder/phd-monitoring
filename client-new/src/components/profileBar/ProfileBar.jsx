import React from 'react';
import './ProfileBar.css';
import { CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { formatDate } from '../../utils/timeParse';

const ProfileBar = ({ progress, phdTitle, studentName, irbDate, synopsisDate, rollNumber }) => {
return (
    <div className="profile-bar">
       
        <div className="profile-details">
            <div className="student-name">{studentName}</div>
            <div className="roll-number">Roll No: {rollNumber}</div>
        </div>
        <div className="dates">
            <div className="irb-date">IRB Date: {formatDate(irbDate)}</div>
            <div className="synopsis-date">Synopsis Date: {formatDate(synopsisDate)}</div>
        </div>
        <div className="progress-container">
            <CircularProgressbar 
                value={progress} 
                text={`${progress}%`} 
                styles={{
                    path: { stroke: `rgba(62, 152, 199, ${progress / 100})` },
                    text: { fill: '#f88', fontSize: '16px' },
                    trail: { stroke: '#d6d6d6' },
                }}
                strokeWidth={10}
                height={100}
            />
        </div>
    </div>
);
};

export default ProfileBar;

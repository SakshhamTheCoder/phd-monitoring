import React from 'react';
import './HistoryTimeline.css'; // Ensure you have this CSS file

const HistoryTimeline = ({ formData }) => {
    const {history}=formData;
    return (
        <div className="history-timeline-container">
            {history?.map((item, index) => (
                <div key={index} className="history-timeline-item-wrapper">
                    <div className="history-timeline-item">
                        <div className="history-timeline-dot"></div>
                        <div className="history-timeline-content">
                        <span className="history-timeline-timestamp">
                                {new Date(item.timestamp).toLocaleDateString('en-US', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </span>
                            <span className="history-timeline-text">{item.action}</span>
                           {item.comment && (<span className="history-timeline-text">Comments: {item.comment}</span>)} 
                           
                        </div>
                    </div>
                    {/* Add line between dots, except for the last item */}
                    {index < history.length - 1 && <div className="history-timeline-line"></div>}
                </div>
            ))}
        </div>
    );
};

export default HistoryTimeline;

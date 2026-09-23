import React from 'react';
import './Timeline.css'; // Add your styling here
import { getRoleName } from '../../../utils/roleName';

const StepTimeline = ({ formData}) => {
    const steps = formData?.steps || [];
    const current_step = formData?.current_step;
    return (
        <div className="timeline-container">
            {steps.map((step, index) => {
                step=getRoleName(step, formData.form_type);
                let stepColor = 'default';
                if (index < current_step) {
                    stepColor = 'green'; 
                } else if (index === current_step) {
                    stepColor = 'yellow'; 
                }

                return (
                    <div key={index} className="timeline-item-wrapper">
                    <div key={index} className={`timeline-item ${stepColor}`}>
                        <div className="timeline-dot"></div>
                        <span className="timeline-step">
                            {step}
                            {/* The dot's colour says done or current; say it in words too. */}
                            {stepColor === 'green' && <span className="sr-only"> (done)</span>}
                            {stepColor === 'yellow' && <span className="sr-only"> (current step)</span>}
                        </span>
                    </div>
                    {index < steps.length - 1 && <div className="timeline-line"></div>}
                    </div>
                );
            })}
        </div>
    );
};

export default StepTimeline;

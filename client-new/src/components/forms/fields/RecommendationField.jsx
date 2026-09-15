import React, { useState, useEffect } from 'react';
import GridContainer from './GridContainer';
import "./Fields.css";
import { Table } from 'lucide-react';
import TableComponent from '../table/TableComponent';

// Two answers only. A separate "rejected" option posted the same approval:false
// as "not recommended", which the server treats identically, so it read as a
// third outcome it never was. `decision` relabels the same two answers as
// Accepted and Rejected for forms that phrase it as a decision, such as leave.
const RecommendationField = ({ role, onRecommendationChange, initialValue ,lock=false,formData=null, decision=false, title=null}) => {
    const [approval, setApproval] = useState(null);
    const [rejected, setRejected] = useState(false);

    // Set initial values based on `initialValue` prop
    useEffect(() => {
        console.log('init', initialValue);
        if (initialValue) {
            const approvalValue = initialValue.approval === 1 ? true : initialValue.approval === 0 ? false : initialValue.approval;
            setApproval(approvalValue);
            setRejected(initialValue.rejected);
        }
    }, [initialValue]);
    

    const handleRecommendationChange = (value) => {
        setApproval(value);
        setRejected(false); // Reset rejection if recommending/not recommending
        onRecommendationChange({ approval: value, rejected: false });
    };

    const handleRejectionChange = () => {
        setRejected(true);
        setApproval(null); // Reset recommendation if rejected
        onRecommendationChange({ approval: false, rejected: true });
    };

    return (
        <>
      
        <GridContainer 
            elements={[
                <div className="recommendation-field" key="recommendation-field">
                    <strong>{title || `Recommendation of ${role}:`}</strong>
                    <div className="options">
                        {decision ? (
                            <>
                                <label>
                                    <input
                                        type="radio"
                                        name={`recommendation-${role}`}
                                        checked={approval === true}
                                        onChange={() => handleRecommendationChange(true)}
                                        disabled={lock}
                                    />
                                    Accepted
                                </label>
                                <label>
                                    <input
                                        type="radio"
                                        name={`recommendation-${role}`}
                                        checked={approval === false || rejected === true}
                                        onChange={handleRejectionChange}
                                        disabled={lock}
                                    />
                                    Rejected
                                </label>
                            </>
                        ) : (
                        <>
                        <label>
                            <input
                                type="radio"
                                name={`recommendation-${role}`}
                                checked={approval === true}
                                onChange={() => handleRecommendationChange(true)}
                                disabled={lock}
                            />
                            Recommend
                        </label>

                        <label>
                            <input
                                type="radio"
                                name={`recommendation-${role}`}
                                checked={approval === false && !rejected}
                                onChange={() => handleRecommendationChange(false)}
                                disabled={lock}
                            />
                            Not Recommend
                        </label>
                        </>
                        )}
                    </div>
                </div>
            ]} 
            space={3}
        />
        </>
    );
};

export default RecommendationField;

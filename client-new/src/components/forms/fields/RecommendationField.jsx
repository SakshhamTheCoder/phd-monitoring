import React, { useState, useEffect } from 'react';
import GridContainer from './GridContainer';
import "./Fields.css";
import TableComponent from '../table/TableComponent';

// `decision` collapses the three-way recommend / not recommend / reject into the
// two answers some forms actually have. Leave is one: an HOD accepts or rejects,
// and "not recommended" would post the same approval:false as a rejection while
// reading as a third, different outcome.
const RecommendationField = ({ role, allowRejection = false, onRecommendationChange, initialValue ,lock=false,formData=null, decision=false, title=null}) => {
    const [approval, setApproval] = useState(null);
    const [rejected, setRejected] = useState(false);

    // Set initial values based on `initialValue` prop
    useEffect(() => {
        if (initialValue) {
            // The 0 and 1 arms are belt and braces: the form models now cast
            // their approval columns to boolean, so the API sends true/false.
            // Kept so a caller that has not been cast still lands on a boolean.
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

                        {allowRejection && (
                            <label>
                                <input
                                    type="radio"
                                    name={`recommendation-${role}`}
                                    checked={rejected}
                                    onChange={handleRejectionChange}
                                    disabled={lock}
                                />
                                Rejected
                            </label>
                        )}
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

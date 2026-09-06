import React, { useState, useEffect } from 'react';
import GridContainer from './GridContainer';
import "./Fields.css";
import { Table } from 'lucide-react';
import TableComponent from '../table/TableComponent';

const RecommendationField = ({ role, allowRejection = false, onRecommendationChange, initialValue ,lock=false,formData=null}) => {
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
                    <strong>Recommendation of {role}:</strong>
                    <div className="options">
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
                    </div>
                </div>
            ]} 
            space={3}
        />
        </>
    );
};

export default RecommendationField;

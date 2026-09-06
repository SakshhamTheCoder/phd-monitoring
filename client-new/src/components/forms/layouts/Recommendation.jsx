import React, { useEffect,useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; 
import RecommendationField from '../fields/RecommendationField';
import GridContainer from '../fields/GridContainer';
import CustomButton from '../fields/CustomButton';
import InputField from '../fields/InputField';
import { getRoleName } from '../../../utils/roleName';
import { useLoading } from '../../../context/LoadingContext';
import { submitForm } from '../../../api/form';
import TableComponent from '../table/TableComponent';

const Recommendation = ({formData,allowRejection,role,moreFields,handleRecommendationChange,isLocked}) => {
    const [roleName, setRoleName] = useState('');
    const [body, setBody] = useState({});
    const [lock, setLock] = useState(false);
    const location = useLocation();
    const { setLoading } = useLoading();
   
    useEffect(() => {
        if (role && formData) {
            setRoleName(getRoleName(role));
            setBody({
                approval: formData.approvals[role],
                rejection: false,
                comments: formData.comments[role],
            });
            setLock(!!formData.locks[role]);
        }
        if(isLocked===true){
            setLock(true);
        }
        if(formData.stage!==role && role!=="supervisor"){
            setLock(true);
        }
    }, [role, formData]);

    const onRecommendationChange = (data) => {
        body.approval = data.approval;
        body.rejected = data.rejected;
        if(handleRecommendationChange){
            handleRecommendationChange(body);
        }
    };


    return (
        <>
              {/* <GridContainer elements={[

            <>
            
            {role==='doctoral' && formData&& (<>
                <TableComponent
                    data={formData.doctoralCommitteeReviews}
                    keys={[
                      "faculty",
                      "progress",
                      "comments",
                      "review_status",
                   
                    ]}
                    titles={[
                      "Doctoral Member Name",
                      "Review",
                      "Comments",
                      "Review Status",
                     
                    ]}
                  />,
            
            </>)}
              <>{role==='supervisor'&& formData && (<>
                <TableComponent
                    data={formData.supervisorReviews}
                    keys={[
                      "faculty",
                      "progress",
                      "comments",
                      "review_status",
                   
                    ]}
                    titles={[
                      "Doctoral Member Name",
                      "Review",
                      "Comments",
                      "Review Status",
                     
                    ]}
                  />,
            
            </>)}</>
            
            
            </>,
            
                 ]}/> */}
            <RecommendationField role={roleName} allowRejection={allowRejection} onRecommendationChange={(data)=>{onRecommendationChange(data)}} initialValue={body} lock={lock} formData={formData}/>
            {(!lock || body.comments) && (
                <GridContainer
                    elements={[
                        <InputField
                            label={"Remarks  (if Any)"}
                            initialValue={body.comments || ''}
                            isLocked={lock}
                            hint="Enter Comments.."
                            onChange={(value) => {
                                const updated = { ...body, comments: value };
                                setBody(updated);
                                if (handleRecommendationChange) {
                                    handleRecommendationChange(updated);
                                }
                            }}
                        />,
                    ]}
                    space={2}
                />
            )}
           
            { !lock && moreFields!==true && ( <GridContainer elements={[
                <CustomButton text='Submit' onClick={()=>{submitForm(body,location,setLoading)}} />
            ]}/>)}

        </>
    );
}
export default Recommendation;
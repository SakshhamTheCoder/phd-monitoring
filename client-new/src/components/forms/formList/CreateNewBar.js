import React from 'react';
import { useLocation } from 'react-router-dom';
import { baseURL } from "../../../api/urls";
import { customFetch } from "../../../api/base";
import { useLoading } from "../../../context/LoadingContext";
import CustomButton from '../fields/CustomButton';

const CreateNewBar = ({rollNumber=null,label}) => {
    const { setLoading } = useLoading();
    const location = useLocation();
   
    const handleClick = () => {
        setLoading(true);
        const url = baseURL + location.pathname ;
        let body = {};
        if(rollNumber!==null){
            body = {
                roll_no: rollNumber
            }
        }
        customFetch(url, 'POST',body)
            .then((data) => {
                if (data && data.success) {
                    window.location.reload();
                }
                setLoading(false);
            })
            .catch((error) => {
                console.log(error);
                setLoading(false);
            })
    };

    return <CustomButton onClick={handleClick} text={label || 'Create New Form +'} />;
};

export default CreateNewBar;
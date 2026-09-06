import React, { useEffect,useState } from 'react';
import Layout from '../../components/dashboard/layout';
import FormGrid from '../../components/forms/formGrid/FormGrid';
import ProfileBar from '../../components/profileBar/ProfileBar';
import { customFetch } from '../../api/base';
import { ENDPOINTS,baseURL } from '../../api/urls';
import { useLoading } from '../../context/LoadingContext';
import { useLocation } from 'react-router-dom';



const FormsPage = () => {
    const role = localStorage.getItem('userRole');
    const [user, setUser] = useState();
    const { setLoading } = useLoading();
    const [forms, setForms] = useState([]);
    const location = useLocation();


    useEffect(() => {
        
      setLoading(true);
      const url= baseURL+location.pathname;
      customFetch(url, "GET")
          .then((data) => {
              if(data && data.success)
              setForms(data.response);
              setLoading(false);
          })
          .catch((error) => {
              console.log(error);
              setLoading(false);
     
          });

          if(role === 'student' ){
              setLoading(true);
              customFetch(ENDPOINTS.STUDENT_PROFILE, 'GET')
              .then((data)=>{
                if(data && data.success){
                  setUser(data.response[0]);
                }
                setLoading(false);
              })
              .catch((error)=>{
                setLoading(false);
                console.log(error);
              });
          }

        
    }, [role]);
    
  return (
    <>

       <Layout children={
        <>
        {/* <ProfileBar
            progress={user?.overall_progress} 
            studentName={user?.phd_title}
            rollNumber={user?.roll_no}
            irbDate={user?.date_of_irb} 
            synopsisDate={user?.date_of_synopsis}
        /> */}
        <FormGrid forms={forms}/>
        </>
        }/>

    </>
  );
}

export default FormsPage;

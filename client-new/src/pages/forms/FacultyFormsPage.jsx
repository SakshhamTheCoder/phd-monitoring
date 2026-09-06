import React, { useEffect,useState } from 'react';
import Layout from '../../components/dashboard/layout';
import FormGrid from '../../components/forms/formGrid/FormGrid';
import ProfileBar from '../../components/profileBar/ProfileBar';
import { customFetch } from '../../api/base';
import { baseURL, ENDPOINTS } from '../../api/urls';
import { useLoading } from '../../context/LoadingContext';
import { useLocation } from 'react-router-dom';

const FacultyFormsPage = () => {
    const role = localStorage.getItem('userRole');
    const [user, setUser] = useState();
    const { setLoading } = useLoading();
    const [forms, setForms] = useState([]);
    const location = useLocation();


    useEffect(() => {
        setForms([
            {
                form_type: "supervisor-allocation",
                form_name: "Supervisor Allocation",
            },
            {
                form_type: "status-change",
                form_name: "Status Change",
            },
            {
                form_type: "irb-constitution",
                form_name: "IRB Constitution",
            },
            {
                form_type: "semester-off",
                form_name: "Semester Off",
            },
            {
                form_type: "irb-submission",
                form_name: "Revised IRB Submission",
            },
            {
                form_type: 'irb-extension',
                form_name: 'IRB Extension',
            },
            {
                form_type: "synopsis-submission",
                form_name: "Synopsis Submission",
            },
               
            {
                form_type: "supervisor-change",
                form_name: "Supervisor Change",
            },
            {
                form_type: "list-of-examiners",
                form_name: "List of Examiners",
            },
       
            
            {
                form_type: 'thesis-extension',
                form_name: 'Thesis Extension',
            },
            {
                form_type: 'thesis-submission',
                form_name: 'Thesis Submission',
            },
            {
                form_type: 'revise-title',
                form_name: 'Revised Title or Objectives',
            },
        ]);
        
    }, [role]);

  return (
    <>

       <Layout children={
        <>
          <FormGrid forms={forms}/>
        </>
        }/>

    </>
  );
}

export default FacultyFormsPage;

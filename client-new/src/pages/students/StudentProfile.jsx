import React, { useEffect,useState } from 'react';
import Layout from '../../components/dashboard/layout';
import ProfileCard from '../../components/profileCard/ProfileCard';
import GridContainer from '../../components/forms/fields/GridContainer';
import CustomButton from '../../components/forms/fields/CustomButton';
import CustomModal from '../../components/forms/modal/CustomModal';

const StudentProfile = () => {
  

    return (
        <Layout children={
            <>
            {
                
               <ProfileCard/>
    
            }
           
            </>
        } />
    );
}

export default StudentProfile;
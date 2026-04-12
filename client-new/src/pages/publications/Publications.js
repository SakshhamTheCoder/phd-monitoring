import React, { useEffect, useState } from 'react';
import Layout from '../../components/dashboard/layout';
import './Publications.css';
import CustomButton from '../../components/forms/fields/CustomButton';
import CustomModal from '../../components/forms/modal/CustomModal';
import AddPublication from '../../components/publications/AddPublication';
import GridContainer from '../../components/forms/fields/GridContainer';
import { useLoading } from '../../context/LoadingContext';
import { useLocation } from 'react-router-dom';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import TableComponent from '../../components/forms/table/TableComponent';
import { formatDate } from '../../utils/timeParse';
import ShowPublications from '../../components/publications/ShowPublications';
const Publications = () => {


    const [formData, setFormData] = useState({});
    const { setLoading } = useLoading();
    const [isLoaded, setIsLoaded] = useState(false);
    const location = useLocation();


    const fetchData = () => {
      setLoading(true);
      const url = baseURL + location.pathname;
      customFetch(url, "GET")
        .then((data) => {
          if (data && data.success) {
            setFormData(data.response);
            console.log(data.response);
            setIsLoaded(true);
          }
          setLoading(false);
        })
        .catch((error) => {
          console.log(error);
          setLoading(false);
        });
    };

    useEffect(() => {
      fetchData();
    }, []);

    const [open, setOpen] = useState(false);
    const openModal = () => {
        setOpen(true);
    }
    const closeModal = () => {
        setOpen(false);
        fetchData();
    }


    return (
        <>

        <Layout children={<>
            <div className='publication-top-bar'> 
                <div className='publication-top-bar-left'>
                    <h1>Publications</h1>
                </div>
                <div className='publication-top-bar-right'>
                   <CustomButton text={'+ Add Publication'} onClick={openModal}/>
                </div>    
             </div>

                <ShowPublications formData={formData} refetchData={fetchData}/>

                <CustomModal isOpen={open} onClose={closeModal} title={'Add Publication'}
                    minHeight='200px' maxHeight='600px' minWidth='650px' maxWidth='700px' closeOnOutsideClick={false}>
                 <AddPublication close={closeModal}/>
                 </CustomModal>
            </>}/>
        </>
    );
};
export default Publications;
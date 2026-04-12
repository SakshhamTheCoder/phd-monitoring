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


    useEffect(() => {
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
    }, []);



    const [open, setOpen] = useState(false);
    const [editData, setEditData] = useState(null);

    const openModal = () => {
        setEditData(null);
        setOpen(true);
    }
    const closeModal = (success = false) => {
        setOpen(false);
        setEditData(null);
        if (success === true) {
            window.location.reload();
        }
    }

    const handleEdit = (id, type) => {
        let data = null;
        if (type === 'sci') data = formData.sci.find(p => p.id === id);
        else if (type === 'non_sci') data = formData.non_sci.find(p => p.id === id);
        else if (type === 'international') data = formData.international.find(p => p.id === id);
        else if (type === 'national') data = formData.national.find(p => p.id === id);
        else if (type === 'book') data = formData.book.find(p => p.id === id);
        else if (type === 'patents') data = formData.patents.find(p => p.id === id);

        if (data) {
           const editBody = { ...data };
           if (type === 'sci') { editBody.publication_type = 'journal'; editBody.type = 'sci'; editBody.label = "Papers in SCI/SCIE/SSCI/ABDC/AHCI Journal"; }
           else if (type === 'non_sci') { editBody.publication_type = 'journal'; editBody.type = 'non-sci'; editBody.label = "Papers in Scopus Journal"; }
           else if (type === 'international') { editBody.publication_type = 'conference'; editBody.type = 'international'; editBody.label = "Papers in Conference"; }
           else if (type === 'national') { editBody.publication_type = 'conference'; editBody.type = 'national'; editBody.label = "Papers in Conference"; }
           else if (type === 'book') { editBody.publication_type = 'book'; editBody.label = "Book Chapters"; }
           else if (type === 'patents') { editBody.publication_type = 'patents'; editBody.label = "Patents"; }
           
           setEditData(editBody);
           setOpen(true);
        }
    };


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

                <ShowPublications formData={formData} enableEdit={true} onEdit={handleEdit}/>

                <CustomModal isOpen={open} onClose={closeModal} title={editData ? 'Edit Publication' : 'Add Publication'}
                    minHeight='200px' maxHeight='600px' minWidth='650px' maxWidth='700px' closeOnOutsideClick={false}>
                 <AddPublication close={closeModal} initialData={editData}/>
                 </CustomModal>
            </>}/>
        </>
    );
};
export default Publications;
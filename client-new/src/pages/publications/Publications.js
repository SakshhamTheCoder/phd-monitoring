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
import { APIdeletePublication, APIdeletePatent } from '../../api/publication';
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

    const [deleteTarget, setDeleteTarget] = useState(null);

    const handleDelete = (id, type) => {
        setDeleteTarget({ id, type });
    };

    const cancelDelete = () => setDeleteTarget(null);

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const { id, type } = deleteTarget;
        setDeleteTarget(null);
        setLoading(true);
        const result = type === 'patents'
            ? await APIdeletePatent(id)
            : await APIdeletePublication(id);
        setLoading(false);
        if (result && result.success) fetchData();
    };

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
            <div className='page-header publication-top-bar'>
                <div className='publication-top-bar-left'>
                    <h1 className='page-title'>Publications</h1>
                </div>
                <div className='publication-top-bar-right'>
                   <CustomButton text={'+ Add Publication'} onClick={openModal}/>
                </div>    
             </div>

                <ShowPublications formData={formData} refetchData={fetchData} enableDelete={true} onDelete={handleDelete}/>

                <CustomModal isOpen={open} onClose={closeModal} title={'Add Publication'}
                    minHeight='200px' maxHeight='600px' minWidth='650px' maxWidth='700px' closeOnOutsideClick={false}>
                 <AddPublication close={closeModal}/>
                 </CustomModal>

                <CustomModal isOpen={!!deleteTarget} onClose={cancelDelete} title={'Confirm Deletion'}
                    minHeight='140px' maxHeight='300px' minWidth='380px' maxWidth='460px' closeOnOutsideClick={true}>
                    <div className='delete-confirm'>
                        <p className='delete-confirm-text'>
                            Are you sure you want to delete this {deleteTarget?.type === 'patents' ? 'patent' : 'publication'}? This action cannot be undone.
                        </p>
                        <div className='delete-confirm-actions'>
                            <button className='delete-cancel-btn' onClick={cancelDelete}>Cancel</button>
                            <button className='delete-confirm-btn' onClick={confirmDelete}>Delete</button>
                        </div>
                    </div>
                </CustomModal>
            </>}/>
        </>
    );
};
export default Publications;
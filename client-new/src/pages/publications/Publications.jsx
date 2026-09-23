import React, { useEffect, useState } from 'react';
import './Publications.css';
import CustomButton from '../../components/forms/fields/CustomButton';
import CustomModal from '../../components/forms/modal/CustomModal';
import AddPublication from '../../components/publications/AddPublication';
import { useLoading } from '../../context/LoadingContext';
import { useLocation } from 'react-router-dom';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import ShowPublications from '../../components/publications/ShowPublications';
import { APIdeletePublication, APIdeletePatent } from '../../api/publication';
import Page from '../../components/page/Page';
import Panel from '../../components/panel/Panel';
import StatusNotice from '../../components/common/StatusNotice';
import LoadError from '../../components/common/LoadError';
const Publications = () => {


    const [formData, setFormData] = useState({});
    const { setLoading } = useLoading();
    const [isLoaded, setIsLoaded] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const location = useLocation();


    const fetchData = () => {
      setLoading(true);
      setLoadFailed(false);
      const url = baseURL + location.pathname;
      customFetch(url, "GET")
        .then((data) => {
          if (data && data.success) {
            setFormData(data.response);
            setIsLoaded(true);
          } else {
            setLoadFailed(true);
          }
          setLoading(false);
        })
        .catch((error) => {
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
        <Page
            title="Publications"
            actions={<CustomButton text="Add publication" onClick={openModal} />}
        >
            {/* Before the first answer the lists are empty, which read as
                "No publications yet" for a scholar who has some. */}
            {isLoaded
              ? (
                <Panel>
                  <ShowPublications formData={formData} refetchData={fetchData} enableDelete={true} onDelete={handleDelete} canAdd={true}/>
                </Panel>
              )
              : loadFailed
                ? <LoadError message="Could not load your publications. Check your connection and try again." onRetry={fetchData} />
                : <Panel><StatusNotice tone="loading" title="Loading publications" /></Panel>}

            <CustomModal isOpen={open} onClose={closeModal}
                minHeight='200px' maxHeight='600px' minWidth='650px' maxWidth='700px' closeOnOutsideClick={false}>
             <AddPublication close={closeModal}/>
             </CustomModal>

            <CustomModal isOpen={!!deleteTarget} onClose={cancelDelete} title={'Confirm deletion'}
                minHeight='140px' maxHeight='300px' minWidth='380px' maxWidth='460px' closeOnOutsideClick={true}>
                <p className='delete-confirm-text'>
                    Are you sure you want to delete this {deleteTarget?.type === 'patents' ? 'patent' : 'publication'}? This action cannot be undone.
                </p>
                <div className='modal-actions'>
                    <CustomButton text="Cancel" variant="quiet" onClick={cancelDelete} />
                    <CustomButton text="Delete" variant="danger" onClick={confirmDelete} />
                </div>
            </CustomModal>
        </Page>
    );
};
export default Publications;
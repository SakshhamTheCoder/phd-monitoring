import React,{useState} from 'react';
import './FormTitleBar.css';
import CustomModal from '../modal/CustomModal';
import StatusBox from '../statusBox/StatusBox';
import { getRoleName } from '../../../utils/roleName';

const FormTitleBar = ({ formName,formData }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleOpenModal = () => {
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    return (
    <>
            <div className="form-title-bar">
                <h1 className="form-title-bar-t">{formName}</h1>
                <div className="form-title-bar-right">
                    <span className="form-title-bar-right-item">Form ID: {formData?.form_id}</span>
                    <span className="form-title-bar-right-item">Stage: {getRoleName(formData?.stage)}</span>
                <button onClick={handleOpenModal} className='form-title-bar-right-button' >View Status</button>
                </div>
            </div>
        <CustomModal
                isOpen={isModalOpen} 
                onClose={handleCloseModal} 
                minWidth="700px" 
                maxWidth="800px" 
                minHeight="300px" 
                maxHeight="500px"
            >
                 <StatusBox formData={formData}/>
        </CustomModal>

    </>);
};

export default FormTitleBar;
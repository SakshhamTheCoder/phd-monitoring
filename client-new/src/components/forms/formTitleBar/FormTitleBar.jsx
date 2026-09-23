import React,{useState} from 'react';
import './FormTitleBar.css';
import CustomModal from '../modal/CustomModal';
import StatusBox from '../statusBox/StatusBox';
import CustomButton from '../fields/CustomButton';
import PageHeader from '../../pageHeader/PageHeader';
import { getRoleName } from '../../../utils/roleName';

// A form page's header: the form's name, its id and current stage, and the
// status history behind View status. Drawn as the shared page header so a form
// starts at the same place as every other page.
const FormTitleBar = ({ formName,formData }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
    <>
        <PageHeader
            title={formName}
            meta={(
                <>
                    <span className="badge badge--neutral">Form ID: {formData?.form_id}</span>
                    <span className="badge badge--accent">Stage: {getRoleName(formData?.stage)}</span>
                </>
            )}
            actions={<CustomButton text="View status" variant="secondary" onClick={() => setIsModalOpen(true)} />}
        />
        <CustomModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
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

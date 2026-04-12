import React, { useEffect, useState } from 'react';
import GridContainer from '../forms/fields/GridContainer';
import TableComponent from '../forms/table/TableComponent';
import { formatDate } from '../../utils/timeParse';
import CustomButton from '../forms/fields/CustomButton';
import AddPublication from './AddPublication';
import CustomModal from '../forms/modal/CustomModal';
import './AddPublication.css';

const ShowPublications = ({
    formData,
    enableSelect = false,
    enableDelete = false,
    enableEdit = false,
    enableSubmit = false,
    onSubmit,
    onSelect,
    onDelete,
    onEdit,
    refetchData = null,
}) => {
   const [selectedRows, setSelectedRows] = useState({});
   const [totalPublications, setTotalPublications] = useState(0);
   const handleSelect = (publicationId, publicationType) => {
       setSelectedRows(prev => ({
           ...prev,
           [publicationType]: {
               ...prev[publicationType],
               [publicationId]: !prev[publicationType]?.[publicationId]
           }
       }));
   };

   const getRowStyle = (publicationId, publicationType) => {
      const isSelected = selectedRows[publicationType]?.[publicationId];
      return isSelected ? { backgroundColor: '#b35d5d3d' } : {};
  };

 
   useEffect(() => {
       if (onSelect) onSelect(selectedRows);
   }, [selectedRows]);

   const [open, setOpen] = useState(false);
   const openModal = () => {
       setOpen(true);
   }
   const closeModal = () => {
       setOpen(false);
       if(refetchData)
       refetchData();
   }
   useEffect(() => {
    if (!formData) return;
        let c=0;
        c+=formData?.sci?.length;
        c+=formData?.non_sci?.length;
        c+=formData?.international?.length;
        c+=formData?.national?.length;
        c+=formData?.book?.length;
        c+=formData?.patents?.length;
        setTotalPublications(c);
   }, [formData]);

   const renderActions = (publicationId, publicationType) => (
       <>
           {enableSelect && (
               <input
                   type="checkbox"
                   checked={!!selectedRows[publicationType]?.[publicationId]}
                   onChange={() => handleSelect(publicationId, publicationType)}
                   style={{ marginRight: 10 }}
               />
           )}
           {enableEdit && (
               <a onClick={() => onEdit && onEdit(publicationId, publicationType)} style={{ cursor: "pointer", marginRight: 10 }}>
                   <i className="fa fa-pencil" ></i>
               </a>
           )}
           {enableDelete && (
               <a onClick={() => onDelete && onDelete(publicationId, publicationType)} style={{ cursor: "pointer" }}>
                   <i className="fa fa-trash-o"></i>
               </a>
           )}
       </>
   );
    return (
        <>
            {formData && (
                <>
                    <GridContainer elements={[]} space={3} />
                    {enableSubmit && (
                        <GridContainer elements={[
                            <h1 className='title-modal'>{enableSubmit && ("Link ")}Publications</h1>,
                            <CustomButton text="Add New" onClick={openModal} />
                        ]}
                         space={2}
                       
                        ></GridContainer>
                     )}
                   {formData.sci && formData.sci.length > 0 && (
                        <>
                            <GridContainer elements={[<h2 className='left-align-header'>SCI/SCIE/SSCI/ABDC/AHCI Journal</h2>]} space={3} />
                            <GridContainer elements={[
                                <TableComponent
                                    data={formData.sci}
                                    keys={['authors', 'year', 'title', 'name', 'impact_factor', 'doi_link', 'id']}
                                    titles={['Author(s)', 'Year of Publication', 'Title of Paper', 'Name of the Journal', 'Impact Factor', 'DOI', '']}
                                    components={[
                                        { key: 'doi_link', component: ({ data }) => <a href={data} target="_blank" rel="noopener noreferrer">link</a> },
                                          { key: 'id', component: ({ data }) => renderActions(data, 'sci') }
                                    ]}
                                    rowStyle={(data) => getRowStyle(data.id, 'sci')}
                                />
                            ]} space={3} />
                        </>
                    )}

                    {formData.non_sci && formData.non_sci.length > 0 && (
                        <>
                            <GridContainer elements={[<h2 className='left-align-header'>Papers in Scopus Journal</h2>]} space={3} />
                            <GridContainer elements={[
                                <TableComponent
                                    data={formData.non_sci}
                                    keys={['authors', 'year', 'title', 'name', 'impact_factor', 'doi_link','id']}
                                    titles={['Author(s)', 'Year of Publication', 'Title of Paper', 'Name of the Journal', 'Impact Factor', 'DOI','']}
                                    components={[
                                        { key: 'doi_link', component: ({ data }) => <a href={data} target="_blank" rel="noopener noreferrer">link</a> },
                                         { key: 'id', component: ({ data }) => renderActions(data, 'non_sci') }
                                    ]}
                                    rowStyle={(data) => getRowStyle(data.id, 'non_sci')}
                                />
                            ]} space={3} />
                        </>
                    )}

                    {formData.international && formData.international.length > 0 && (
                        <>
                            <GridContainer elements={[<h2 className='left-align-header'>Papers in International Conferences</h2>]} space={3} />
                            <GridContainer elements={[
                                <TableComponent
                                    data={formData.international}
                                    keys={['authors', 'year', 'title', 'name', 'country', 'doi_link','id']}
                                    titles={['Author(s)', 'Year of Publication', 'Title of Paper', 'Name of Conference', 'Place of Conference', 'DOI',' ']}
                                    components={[
                                        { key: 'doi_link', component: ({ data }) => <a href={data} target="_blank" rel="noopener noreferrer">link</a> },
                                         { key: 'country', component: ({ data }) => <span>{data}</span> },
                                        { key: 'id', component: ({ data }) => renderActions(data, 'international') }
                                    ]}
                                    rowStyle={(data) => getRowStyle(data.id, 'international')}
                                />
                            ]} space={3} />
                        </>
                    )}

                    {formData.national && formData.national.length > 0 && (
                        <>
                            <GridContainer elements={[<h2 className='left-align-header'>Papers in National Conferences</h2>]} space={3} />
                            <GridContainer elements={[
                                <TableComponent
                                    data={formData.national}
                                    keys={['authors', 'year', 'title', 'name', 'city', 'doi_link','id']}
                                    titles={['Author(s)', 'Year of Publication', 'Title of Paper', 'Name of Conference', 'Place of Conference', 'DOI',' ']}
                                    components={[
                                        { key: 'doi_link', component: ({ data }) => <a href={data} target="_blank" rel="noopener noreferrer">link</a> },
                                         {key: 'id', component: ({ data }) => renderActions(data, 'national') }
                                    ]}
                                    rowStyle={(data) => getRowStyle(data.id, 'national')}
                                />
                            ]} space={3} />
                        </>
                    )}

                    {formData.book && formData.book.length > 0 && (
                        <>
                            <GridContainer elements={[<h2 className='left-align-header'>Book/Book Chapters</h2>]} space={3} />
                            <GridContainer elements={[
                                <TableComponent
                                    data={formData.book}
                                    keys={['name', 'title', 'year', 'publisher','id']}
                                    titles={['Name of Book', 'Title of Paper', 'Year of Publication', 'Name of Publisher',' ']}
                                    components={[
                                         {key: 'id', component: ({ data }) => renderActions(data, 'book') }
                                    ]}
                                    getRowStyle={(data) => getRowStyle(data.id, 'book')}
                                />
                            ]} space={3} />
                        </>
                    )}

                    {formData.patents && formData.patents.length > 0 && (
                        <>
                            <GridContainer elements={[<h2 className='left-align-header'>Patents</h2>]} space={3} />
                            <GridContainer elements={[
                                <TableComponent
                                    data={formData.patents}
                                    keys={['authors', 'year', 'status', 'title', 'country','id']}
                                    titles={['Author(s)', 'Year of Award', 'Status', 'Title of Patent', 'International/National',' ']}
                                    components={[
                                        { key: 'year', component: ({ data }) => <span>{formatDate(data)}</span> },
                                       {key: 'id', component: ({ data }) => renderActions(data, 'patents') }
                                    ]}
                                    rowStyle={(data) => getRowStyle(data.id, 'patents')}
                                />
                            ]} space={3} />
                        </>
                    )}
                    {
                       formData.patents && formData.patents.length === 0 &&
                          formData.book && formData.book.length === 0 &&
                            formData.national && formData.national.length === 0 &&
                            formData.international && formData.international.length === 0 &&
                            formData.sci && formData.sci.length === 0 &&
                            formData.non_sci && formData.non_sci.length === 0 && (
                                <p style={{textAlign:'center'}}>No Publications Found, Add One to Continue</p>
                            )
                    }
                     {enableSubmit && (
                        <GridContainer elements={[
                            <> {Object.values(selectedRows).some(
                                group => group && Object.values(group).some(selected => selected)
                              ) && (
                                <CustomButton text="Link Selected Publications with Form" onClick={onSubmit} />
                              )}
                              </>
                        ]}
                            space={3}
                        ></GridContainer>
                     )}
                <CustomModal isOpen={open} onClose={closeModal} title={'Add Publication'}
                    minHeight='200px' maxHeight='600px' minWidth='650px' maxWidth='700px' closeOnOutsideClick={false}>
                 <AddPublication close={closeModal}/>
                 </CustomModal>
                </>
            )}
        </>
    );
};

export default ShowPublications;

import React, { useEffect, useState } from 'react';
import GridContainer from '../forms/fields/GridContainer';
import TableComponent from '../forms/table/TableComponent';
import { formatDate, EMPTY_VALUE } from '../../utils/timeParse';
import CustomButton from '../forms/fields/CustomButton';
import AddPublication from './AddPublication';
import CollapsibleSection from '../common/CollapsibleSection';
import CustomModal from '../forms/modal/CustomModal';
import './ShowPublications.css';

// The signed-in account's own name, which Authors shows in bold.
const accountName = () => {
    try {
        const user = JSON.parse(localStorage.getItem('user')) || {};
        return [user.first_name, user.last_name].filter(Boolean).join(' ');
    } catch {
        return '';
    }
};

const PUBLICATION_GROUPS = ['sci', 'non_sci', 'international', 'national', 'book', 'patents'];

const countPublications = (formData) => PUBLICATION_GROUPS
    .reduce((total, group) => total + (formData?.[group]?.length || 0), 0);

const nameTokens = (text) => String(text || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);

// Authors is free text ("A. Rao, Ravi Kumar and ..."), so each author is matched
// by the words of a highlighted name, in any order and ignoring punctuation.
const Authors = ({ text, names }) => {
    if (!text) return EMPTY_VALUE;
    const wanted = names.map(nameTokens).filter((tokens) => tokens.length > 0);
    return String(text).split(/(\s*[,;]\s*|\s+and\s+)/i).map((part, i) => {
        const tokens = nameTokens(part);
        const isHighlighted = tokens.length > 0 && wanted.some((name) => name.every((token) => tokens.includes(token)));
        return isHighlighted ? <strong key={i}>{part}</strong> : <React.Fragment key={i}>{part}</React.Fragment>;
    });
};

const ShowPublications = ({
    formData,
    enableSelect = false,
    enableDelete = false,
    enableEdit = true,
    enableSubmit = false,
    canAdd = false,
    onSubmit,
    onSelect,
    onDelete,
    onEdit,
    refetchData = null,
    // Whose names are bold among the authors. Defaults to the signed-in account;
    // a page showing someone else's record passes theirs.
    highlightNames = null,
    // A profile or a project record carries these beside everything else about
    // the person, where six open tables push the rest of the page off screen.
    // Those pages collapse them behind their own count; a form that asks the
    // scholar to pick from them leaves them open, which is the default.
    collapsible = false,
    summaryLabel = 'Publications and Patents',
}) => {
   const highlighted = highlightNames || [accountName()];
   const authorsCell = { key: 'authors', component: ({ data }) => <Authors text={data} names={highlighted} /> };
   const [editData, setEditData] = useState(null);
   const [selectedRows, setSelectedRows] = useState({});
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
       setEditData(null);
       if(refetchData)
       refetchData();
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
           setEditData(data);
           setOpen(true);
       }
   };
   // Derived rather than stored: a count kept in state renders 0 on the first
   // pass, which the collapsed summary would show before an effect caught up.
   const totalPublications = countPublications(formData);

   // Only URF projects record funding and mode, so the columns appear when a row has them.
   const urfColumns = (rows, keys, titles) => rows.some((row) => row.mode || row.funding)
       ? { keys: [...keys.slice(0, -1), 'mode', 'funding', 'id'], titles: [...titles.slice(0, -1), 'Mode', 'Funding', ' '] }
       : { keys, titles };

   // The selection tick box leads each row, so it is the first thing seen.
   const selectCell = (publicationType) => (enableSelect
       ? ({ row }) => (
           <input
               type="checkbox"
               aria-label="Select publication"
               checked={!!selectedRows[publicationType]?.[row.id]}
               onChange={() => handleSelect(row.id, publicationType)}
           />
       )
       : null);

   const renderActions = (publicationId, publicationType) => (
       <>
           {enableEdit && (
               <button type="button" className="icon-action" aria-label="Edit" title="Edit" onClick={() => handleEdit(publicationId, publicationType)}>
                   <i className="fa fa-pencil" aria-hidden="true"></i>
               </button>
           )}
           {enableDelete && (
               <button type="button" className="icon-action" aria-label="Delete" title="Delete" onClick={() => onDelete && onDelete(publicationId, publicationType)}>
                   <i className="fa fa-trash-o" aria-hidden="true"></i>
               </button>
           )}
       </>
   );
    const tables = (
        <div className="publications-tables">
            {formData && (
                <>
                    <GridContainer elements={[]} space={3} />
                    {enableSubmit && (
                        <GridContainer elements={[
                            <h1 className='modal-title'>{enableSubmit && ("Link ")}Publications</h1>,
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
                                    leading={selectCell('sci')}
                                    keys={['authors', 'year', 'title', 'name', 'impact_factor', 'doi_link', 'id']}
                                    titles={['Author(s)', 'Year of Publication', 'Title of Paper', 'Name of the Journal', 'Impact Factor', 'DOI', '']}
                                    components={[authorsCell,
                                        { key: 'doi_link', component: ({ data }) => data ? <a href={data} target="_blank" rel="noopener noreferrer" title="Open DOI link" style={{ color: '#991b1b' }}><i className="fa fa-link"></i></a> : <span>{EMPTY_VALUE}</span> },
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
                                    leading={selectCell('non_sci')}
                                    keys={['authors', 'year', 'title', 'name', 'impact_factor', 'doi_link','id']}
                                    titles={['Author(s)', 'Year of Publication', 'Title of Paper', 'Name of the Journal', 'Impact Factor', 'DOI','']}
                                    components={[authorsCell,
                                        { key: 'doi_link', component: ({ data }) => data ? <a href={data} target="_blank" rel="noopener noreferrer" title="Open DOI link" style={{ color: '#991b1b' }}><i className="fa fa-link"></i></a> : <span>{EMPTY_VALUE}</span> },
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
                                    leading={selectCell('international')}
                                    {...urfColumns(formData.international, ['authors', 'year', 'title', 'name', 'country', 'doi_link','id'], ['Author(s)', 'Year of Publication', 'Title of Paper', 'Name of Conference', 'Place of Conference', 'DOI',' '])}
                                    components={[authorsCell,
                                        { key: 'doi_link', component: ({ data }) => data ? <a href={data} target="_blank" rel="noopener noreferrer" title="Open DOI link" style={{ color: '#991b1b' }}><i className="fa fa-link"></i></a> : <span>{EMPTY_VALUE}</span> },
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
                                    leading={selectCell('national')}
                                    {...urfColumns(formData.national, ['authors', 'year', 'title', 'name', 'city', 'doi_link','id'], ['Author(s)', 'Year of Publication', 'Title of Paper', 'Name of Conference', 'Place of Conference', 'DOI',' '])}
                                    components={[authorsCell,
                                        { key: 'doi_link', component: ({ data }) => data ? <a href={data} target="_blank" rel="noopener noreferrer" title="Open DOI link" style={{ color: '#991b1b' }}><i className="fa fa-link"></i></a> : <span>{EMPTY_VALUE}</span> },
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
                                    leading={selectCell('book')}
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
                                    leading={selectCell('patents')}
                                    keys={['authors', 'year', 'status', 'title', 'country','id']}
                                    titles={['Author(s)', 'Year of Award', 'Status', 'Title of Patent', 'International/National',' ']}
                                    components={[authorsCell,
                                        { key: 'year', component: ({ data }) => <span>{formatDate(data)}</span> },
                                       {key: 'id', component: ({ data }) => renderActions(data, 'patents') }
                                    ]}
                                    rowStyle={(data) => getRowStyle(data.id, 'patents')}
                                />
                            ]} space={3} />
                        </>
                    )}
                    {totalPublications === 0 && (
                        <p style={{textAlign:'center'}}>{canAdd ? "No publications yet. Add one to continue." : "No publications yet."}</p>
                    )}
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
                <CustomModal isOpen={open} onClose={closeModal} title={editData ? 'Edit Publication' : 'Add Publication'}
                    minHeight='200px' maxHeight='600px' minWidth='650px' maxWidth='700px' closeOnOutsideClick={false}>
                 <AddPublication close={closeModal} editData={editData} />
                 </CustomModal>
                </>
            )}
        </div>
    );

    if (!collapsible) return tables;

    return (
        <CollapsibleSection title={summaryLabel} count={totalPublications}>
            <div className="publications-collapse">{tables}</div>
        </CollapsibleSection>
    );
};

export default ShowPublications;

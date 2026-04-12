import React, { useEffect, useState } from 'react';
import GridContainer from '../forms/fields/GridContainer';
import InputField from '../forms/fields/InputField';
import DropdownField from '../forms/fields/DropdownField';
import FileUploadField from '../forms/fields/FileUploadField';
import CustomButton from '../forms/fields/CustomButton';

const SCIJournal = ({callback,updateValue,data={}}) => {
    const [body, setBody] = useState(data);
    const year = new Date().getFullYear();
    const yearRange = Array.from({ length: 7 }, (_, i) => year - 3 + i);    
    const setBodyValue = (key,value) => {
        setBody((prev) => ({
            ...prev,
            [key]:value,}));
    }

    useEffect(() => {     updateValue(body);}, [body]);
    return (
        <>
            <GridContainer elements={[
                <InputField label={"Author(s)"} hint={"Enter Author(s), separated by commas"} initialValue={data.authors} onChange={(value)=>{setBodyValue("authors",value)}} />,
            ]}/>
            <GridContainer elements={[
                <DropdownField label={"Year of Publication/Acceptance"} initialValue={data.year} options={yearRange.map((year)=>{return {title:year,value:year}})} onChange={(value)=>{setBodyValue("year",value)}}/>
            ]}/>
            <GridContainer elements={[
                <InputField label={"Title of the Paper"} hint={"Enter Title"} initialValue={data.title} onChange={(value)=>{setBodyValue("title",value)}} />,
            ]} space={2}/>

            <GridContainer elements={[
                <InputField label={"Name of Journal"} hint={"Journal Name"} initialValue={data.name} onChange={(value)=>{setBodyValue("name",value)}} />,
            ]} space={2}/>

            <GridContainer elements={[
                <InputField label={"Volume"} hint={"Volume"} initialValue={data.volume} onChange={(value)=>{setBodyValue("volume",value)}} />,
                <InputField label={"Page Number"} hint={"Page Number"} initialValue={data.page_no} onChange={(value)=>{setBodyValue("page_no",value)}} />,
                <DropdownField label={"Status of Paper:"} options={[{title:"Accepted",value:"accepted"},{title:"Published",value:"published"}]} initialValue={data.status}  onChange={(value)=>{setBodyValue("status",value)}} />,
            ]} />

            <GridContainer elements={[
                <InputField label={"Impact Factor"} hint={"Impact Factor"} initialValue={data.impact_factor} onChange={(value)=>{setBodyValue("impact_factor",value)}} />,
            ]}/>

            <GridContainer elements={[
                <InputField label={"DOI Link"} hint={"DOI Link"} initialValue={data.doi_link} onChange={(value)=>{setBodyValue("doi_link",value)}} />,
            ]}/>

            <GridContainer elements={[
                <FileUploadField label={"Upload First Page"} initialValue={data.first_page} onChange={(value)=>{setBodyValue("first_page",value)}} maxSizeMB={15} />,
            ]}/>

            
            <GridContainer elements={[
                <CustomButton text={data.id ? "Update" : "Submit"} onClick={()=>{console.log("Inside",body);callback(body)}}/>
            ]}/>
        </>
    );
};

export default SCIJournal;
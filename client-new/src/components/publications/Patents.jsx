import React, { useEffect, useState } from 'react';
import GridContainer from '../forms/fields/GridContainer';
import InputField from '../forms/fields/InputField';
import DropdownField from '../forms/fields/DropdownField';
import FileUploadField from '../forms/fields/FileUploadField';
import CustomButton from '../forms/fields/CustomButton';

const Patents = ({callback,updateValue,data={}}) => {
    const [body, setBody] = useState(data);
    const year = new Date().getFullYear();
    const yearRange = Array.from({ length: 7 }, (_, i) => year - 3 + i);  
 
    useEffect(() => {
        updateValue(body);
    }, [body]);  

    const setBodyValue = (key,value) => {
        setBody((prev) => ({
            ...prev,
            [key]:value,}));
    }

    return (
        <>
            <GridContainer elements={[
                <InputField label={"Author(s)"} hint={"Enter Author(s)"} initialValue={data.authors} onChange={(value)=>{setBodyValue("authors",value)}} />,
            ]}/>
            <GridContainer elements={[
                <DropdownField label={"Year of Award"} initialValue={data.year} options={yearRange.map((year)=>{return {title:year,value:year}})} onChange={(value)=>{setBodyValue("year",value)}}/>
            ]}/>
            <GridContainer elements={[
                <InputField label={"Title of the Patent"} hint={"Enter Title"} initialValue={data.title} onChange={(value)=>{setBodyValue("title",value)}} />,
            ]} space={2}/>

            <GridContainer elements={[
                <DropdownField label={"Type of Patent"} initialValue={data.country} options={[{title:"National",value:"National"},{title:"International",value:"International"}]} onChange={(value)=>{setBodyValue("country",value)}} />,
                <DropdownField label={"Status of Patent:"} initialValue={data.status} options={[
                    {title:"Granted",value:"granted"},
                    {title:"Filed",value:"filed"},
                    {title:"Published",value:"published"},
                ]} onChange={(value)=>{setBodyValue("status",value)}} />,
            ]} />

            <GridContainer elements={[
                <InputField label={"DOI Link"} hint={"DOI Link"} initialValue={data.doi_link} onChange={(value)=>{setBodyValue("doi_link",value)}} />,
            ]}/>

            <GridContainer elements={[
                <FileUploadField label={"Upload First Page"} initialValue={data.first_page} onChange={(value)=>{setBodyValue("first_page",value)}} />,
            ]}/>

            
            <GridContainer elements={[
               <CustomButton text="Submit" onClick={()=>{callback(body)}}/>
            ]}/>
        </>
    );
};

export default Patents;
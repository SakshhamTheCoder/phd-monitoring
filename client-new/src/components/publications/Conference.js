import React, { useEffect, useState } from 'react';
import GridContainer from '../forms/fields/GridContainer';
import InputField from '../forms/fields/InputField';
import DropdownField from '../forms/fields/DropdownField';
import FileUploadField from '../forms/fields/FileUploadField';
import CustomButton from '../forms/fields/CustomButton';
import InputSuggestions from '../forms/fields/InputSuggestions';
import { baseURL } from '../../api/urls';

const Conference = ({callback,updateValue}) => {
    const [body, setBody] = useState({});
    const year = new Date().getFullYear();
    const yearRange = Array.from({ length: 7 }, (_, i) => year - 3 + i); 

    const apiCountries = baseURL + "/suggestions/country";
    const apiStates = baseURL + "/suggestions/state";
    const apiCities = baseURL + "/suggestions/city";

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
                <InputField label={"Author(s)"} hint={"Enter Author(s)"} onChange={(value)=>{setBodyValue("authors",value)}} />,
            ]}/>
            <GridContainer elements={[
                <DropdownField label={"Year of Publication/Acceptance"} options={yearRange.map((year)=>{return {title:year,value:year}})} onChange={(value)=>{setBodyValue("year",value)}}/>
            ]}/>
            <GridContainer elements={[
                <InputField label={"Title of the Paper"} hint={"Enter Title"} onChange={(value)=>{setBodyValue("title",value)}} />,
            ]} space={2}/>

            <GridContainer elements={[
                <InputField label={"Name of Conference"} hint={"Journal Name"} onChange={(value)=>{setBodyValue("name",value)}} />,
            ]} space={2}/>

            <GridContainer elements={[
                <InputSuggestions apiUrl={apiCountries} label={"Country"} hint={"Country"} onSelect={(value)=>{body.country=value.name; body.country_code=value.code; setBodyValue("country",value.name)}}  />,
                <InputSuggestions apiUrl={apiStates} label="State" hint={"State"} onSelect={(value)=>{body.state=value.name; body.state_code=value.code;  setBodyValue("state",value.name)}} body={body} />,
                <InputSuggestions apiUrl={apiCities} label="City" hint={"City"} onSelect={(value)=>{body.city=value.name;  setBodyValue("city",value.name)}}  body={body}/>,
            ]}/>


            <GridContainer elements={[
                <DropdownField label={"Type of Conference"} options={[{title:"National",value:"national"},{title:"International",value:"international"}]} onChange={(value)=>{setBodyValue("type",value)}} />,
                <DropdownField label={"Status of Paper:"} options={[{title:"Accepted",value:"accepted"},{title:"Published",value:"published"}]} onChange={(value)=>{setBodyValue("status",value)}} />,
            ]} />


<GridContainer elements={[
                <InputField label={"DOI Link"} hint={"DOI Link"} onChange={(value)=>{setBodyValue("doi_link",value)}} />,
            ]}/>

            <GridContainer elements={[
                <FileUploadField label={"Upload First Page"} onChange={(value)=>{setBodyValue("first_page",value)}} maxSizeMB={15} />,
            ]}/>

            
            <GridContainer elements={[
               <CustomButton text="Submit" onClick={()=>{callback(body)}}/>
            ]}/>
        </>
    );
};

export default Conference;
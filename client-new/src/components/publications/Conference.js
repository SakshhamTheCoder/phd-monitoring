import React, { useEffect, useState } from 'react';
import GridContainer from '../forms/fields/GridContainer';
import InputField from '../forms/fields/InputField';
import DropdownField from '../forms/fields/DropdownField';
import FileUploadField from '../forms/fields/FileUploadField';
import CustomButton from '../forms/fields/CustomButton';
import InputSuggestions from '../forms/fields/InputSuggestions';
import { baseURL } from '../../api/urls';

const Conference = ({callback,updateValue, data = {}}) => {
    const [body, setBody] = useState(data);
    const [loading, setLoading] = useState(false);
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
                <InputField label={"Author(s)"} hint={"Enter Author(s)"} initialValue={data.authors} onChange={(value)=>{setBodyValue("authors",value)}} required={true} />,
            ]}/>
            <GridContainer elements={[
                <DropdownField label={"Year of Publication/Acceptance"} initialValue={data.year} options={yearRange.map((year)=>{return {title:year,value:year}})} onChange={(value)=>{setBodyValue("year",value)}} required={true} />
            ]}/>
            <GridContainer elements={[
                <InputField label={"Title of the Paper"} hint={"Enter Title"} initialValue={data.title} onChange={(value)=>{setBodyValue("title",value)}} required={true} />,
            ]} space={2}/>

            <GridContainer elements={[
                <InputField label={"Name of Conference"} hint={"Journal Name"} initialValue={data.name} onChange={(value)=>{setBodyValue("name",value)}} required={true} />,
            ]} space={2}/>

            <GridContainer elements={[
                <InputSuggestions apiUrl={apiCountries} label={"Country"} hint={"Country"} initialValue={data.country} onSelect={(value)=>{body.country=value.name; body.country_code=value.code; setBodyValue("country",value.name)}} suggestionManadatory={false} required={true} />,
                <InputSuggestions apiUrl={apiStates} label="State" hint={"State"} initialValue={data.state} onSelect={(value)=>{body.state=value.name; body.state_code=value.code;  setBodyValue("state",value.name)}} body={body} suggestionManadatory={false} required={true} />,
                <InputSuggestions apiUrl={apiCities} label="City" hint={"City"} initialValue={data.city} onSelect={(value)=>{body.city=value.name;  setBodyValue("city",value.name)}}  body={body} suggestionManadatory={false} required={true} />,
            ]}/>


            <GridContainer elements={[
                <DropdownField label={"Type of Conference"} initialValue={data.type} options={[{title:"National",value:"national"},{title:"International",value:"international"}]} onChange={(value)=>{setBodyValue("type",value)}} required={true} />,
                <DropdownField label={"Status of Paper:"} initialValue={data.status} options={[{title:"Accepted",value:"accepted"},{title:"Published",value:"published"}]} onChange={(value)=>{setBodyValue("status",value)}} required={true} />,
            ]} />


<GridContainer elements={[
                <InputField label={"DOI Link"} hint={"DOI Link"} initialValue={data.doi_link} onChange={(value)=>{setBodyValue("doi_link",value)}} required={true} />,
            ]}/>

            <GridContainer elements={[
                <FileUploadField label={"Upload First Page"} initialValue={data.first_page} onChange={(value)=>{setBodyValue("first_page",value)}} maxSizeMB={15} required={!data.id} />,
            ]}/>

            
            <GridContainer elements={[
               <CustomButton text={data.id ? (loading ? "Updating..." : "Update") : (loading ? "Submitting..." : "Submit")} 
               disabled={loading}
               onClick={async ()=>{
                   setLoading(true);
                   await callback(body);
                   setLoading(false);
               }}/>
            ]}/>
        </>
    );
};

export default Conference;
import React, { useEffect, useState } from "react";
import GridContainer from "../forms/fields/GridContainer";
import InputField from "../forms/fields/InputField";
import DropdownField from "../forms/fields/DropdownField";
import FileUploadField from "../forms/fields/FileUploadField";
import CustomButton from "../forms/fields/CustomButton";

const Book = ({ callback, updateValue, data = {} }) => {
  const [body, setBody] = useState(data);
  const year = new Date().getFullYear();
  const yearRange = Array.from({ length: 7 }, (_, i) => year - 3 + i);
  useEffect(() => {
    updateValue(body);
  }, [body]);

  const setBodyValue = (key, value) => {
    setBody((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <>
      <GridContainer
        elements={[
          <InputField
            label={"Author(s)"}
            hint={"Enter Author(s),separated by commas"}
            initialValue={data.authors}
            required={true}
            onChange={(value) => {
              setBodyValue("authors", value);
            }}
          />,
        ]}
      />

      <GridContainer
        elements={[
          <InputField
            label={"Name of Book"}
            hint={"Book Name"}
            initialValue={data.name}
            required={true}
            onChange={(value) => {
              setBodyValue("name", value);
            }}
          />,
        ]}
        space={2}
      />

      <GridContainer
        elements={[
          <DropdownField
            label={"Year of Publication/Acceptance"}
            initialValue={data.year}
            options={yearRange.map((year) => {
              return { title: year, value: year };
            })}
            required={true}
            onChange={(value) => {
              setBodyValue("year", value);
            }}
          />,
          <DropdownField label={"Status of Book:"} initialValue={data.status} options={[{title:"Accepted",value:"accepted"},{title:"Published",value:"published"}]} onChange={(value)=>{setBodyValue("status",value)}} required={true} />,
          
        ]}
        space={2}
      />

      <GridContainer
        elements={[
          <InputField
            label={"Chapter Title"}
            hint={"Enter Title"}
            initialValue={data.title}
            required={true}
            onChange={(value) => {
              setBodyValue("title", value);
            }}
          />,
        ]}
        space={2}
      />

      <GridContainer
        elements={[
          <InputField
            required={true}
            onChange={(value) => {
              setBodyValue("volume", value);
            }}
          />,
          <InputField
            label={"Page Number"}
            hint={"Page Number"}
            initialValue={data.page_no}
            required={true}
            onChange={(value) => {
              setBodyValue("page_no", value);
            }}
          />,
          <InputField
            label={"ISSN"}
            hint={"ISSN"}
            initialValue={data.issn}
            required={true}
            onChange={(value) => {
              setBodyValue("issn", value);
            }}
          />,
        ]}
      />

      <GridContainer
        elements={[
          <InputField
            label={"Name of Publisher"}
            hint={"Publisher Name"}
            initialValue={data.publisher}
            required={true}
            onChange={(value) => {
              setBodyValue("publisher", value);
            }}
          />,
        ]}
        space={2}
      />

      <GridContainer
        elements={[
          <InputField
            label={"DOI Link"}
            hint={"DOI Link"}
            initialValue={data.doi_link}
            required={true}
            onChange={(value) => {
              setBodyValue("doi_link", value);
            }}
          />,
        ]}
      />

      <GridContainer
        elements={[
          <FileUploadField
            label={"Upload First Page"}
            initialValue={data.first_page}
            required={!data.id}
            onChange={(value) => {
              setBodyValue("first_page", value);
            }}
            maxSizeMB={15}
          />,
        ]}
      />

      <GridContainer
        elements={[
          <CustomButton
            text={data.id ? "Update" : "Submit"}
            onClick={() => {
              callback(body);
            }}
          />,
        ]}
      />
    </>
  );
};

export default Book;

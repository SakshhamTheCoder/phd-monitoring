import React, { useEffect, useState } from "react";
import GridContainer from "../forms/fields/GridContainer";
import InputField from "../forms/fields/InputField";
import DropdownField from "../forms/fields/DropdownField";
import FileUploadField from "../forms/fields/FileUploadField";
import CustomButton from "../forms/fields/CustomButton";

const Book = ({ callback, updateValue }) => {
  const [body, setBody] = useState({});
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
            options={yearRange.map((year) => {
              return { title: year, value: year };
            })}
            onChange={(value) => {
              setBodyValue("year", value);
            }}
          />,
          <DropdownField label={"Status of Book:"} options={[{title:"Accepted",value:"accepted"},{title:"Published",value:"published"}]} onChange={(value)=>{setBodyValue("status",value)}} />,
          
        ]}
        space={2}
      />

      <GridContainer
        elements={[
          <InputField
            label={"Chapter Title"}
            hint={"Enter Title"}
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
            label={"Volume"}
            hint={"Volume"}
            onChange={(value) => {
              setBodyValue("volume", value);
            }}
          />,
          <InputField
            label={"Page Number"}
            hint={"Page Number"}
            onChange={(value) => {
              setBodyValue("page_no", value);
            }}
          />,
          <InputField
            label={"ISSN"}
            hint={"ISSN"}
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
            onChange={(value) => {
              setBodyValue("first_page", value);
            }}
          />,
        ]}
      />

      <GridContainer
        elements={[
          <CustomButton
            text="Submit"
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

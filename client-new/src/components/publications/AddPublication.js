import React, { useState, useEffect } from "react";
import "./AddPublication.css";
import DropdownField from "../forms/fields/DropdownField";
import SCIJournal from "./SCIJournal";
import Patents from "./Patents";
import Conference from "./Conference";
import Book from "./Book";
import GridContainer from "../forms/fields/GridContainer";
import { APIaddPublication, APIupdatePublication } from "../../api/publication";

const AddPublication = ({ close, editData = null }) => {
  const [body, setBody] = useState(editData || {});

  const handleSelect = (value) => {
    value = JSON.parse(value);
    setBody((prev) => ({
      ...prev,
      ...value,
    }));
  };

  const callback = async (newData) => {
    if (editData && editData.id) {
        if (body.publication_type === "patents") {
            await APIupdatePublication(editData.id, body, close, "/patents");
        } else {
            await APIupdatePublication(editData.id, body, close);
        }
    } else {
        if (body.publication_type === "patents") {
            await APIaddPublication(body, close, "/patents");
        } else {
            await APIaddPublication(body, close);
        }
    }
  };

  const updateValue = (newData) => {
    setBody((prev) => ({
      ...prev,
      ...newData,
    }));
  };

  return (
    <>
        {body.label && (<h1 className="add-publication-container-h1">{body.label}</h1>)}
        {!body.label && (<h1 className="add-publication-container-h1">{"Choose a Publication Type"}</h1>)}
      <div className="add-publication-container">
        {!editData && (
          <GridContainer
            elements={[
              <DropdownField
                label={"Publication Type"}
                options={[
                  {
                    value: JSON.stringify({
                      publication_type: "journal",
                      type: "sci",
                      label: "Papers in SCI/SCIE/SSCI/ABDC/AHCI Journal",
                    }),
                    title: "Papers in SCI/SCIE/SSCI/ABDC/AHCI Journal",
                  },
                  {
                    value: JSON.stringify({
                      publication_type: "journal",
                      type: "non-sci",
                      label: "Papers in Scopus Journal",
                    }),
                    title: "Papers in Scopus Journal",
                  },
                  {
                    value: JSON.stringify({
                      publication_type: "book",
                      label: "Book Chapters",
                    }),
                    title: "Book Chapters",
                  },
                  {
                    value: JSON.stringify({
                      publication_type: "conference",
                      label: "Papers in Conference",
                    }),
                    title: "Papers in Conference",
                  },
                  {
                    value: JSON.stringify({
                      publication_type: "patents",
                      label: "Patents",
                    }),
                    title: "Patents",
                  },
                ]}
                onChange={handleSelect}
              />,
            ]}
            space={2}
          />
        )}

        <div className="add-publication-box">
          {body.label || editData ? (
            <>
              {body.publication_type === "journal" && (
                <SCIJournal callback={callback} updateValue={updateValue} data={body} />
              )}
              {body.publication_type === "book" && <Book callback={callback} updateValue={updateValue} data={body} />}
              {body.publication_type === "conference" && (
                <Conference callback={callback} updateValue={updateValue} data={body} />
              )}
              {body.publication_type === "patents" && (
                <Patents callback={callback} updateValue={updateValue} data={body} />
              )}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default AddPublication;

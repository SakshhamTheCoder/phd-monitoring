import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import GridContainer from "../fields/GridContainer";
import CustomButton from "../fields/CustomButton";
import CustomModal from "../modal/CustomModal";
import ShowPublications from "../../publications/ShowPublications";
import { customFetch } from "../../../api/base";
import { baseURL } from "../../../api/urls";
import { useLoading } from "../../../context/LoadingContext";

const pick = (source, keys) => Object.fromEntries(keys.map((key) => [key, source?.[key]]));

// The publications a scholar has linked to this form, and a picker to link
// more from their library (Field::publications on the server). Linking and
// unlinking post to the form's own path plus /link and /unlink; the form is
// then read again, which refreshes both the linked lists and the library.
const PublicationsBlock = ({ formData, field }) => {
  const location = useLocation();
  const { setLoading } = useLoading();
  const [linked, setLinked] = useState(() => pick(formData, field.lists));
  const [library, setLibrary] = useState(formData[field.library]);
  const [picked, setPicked] = useState([]);
  const [open, setOpen] = useState(false);

  const refetch = () => {
    setLoading(true);
    return customFetch(baseURL + location.pathname, "GET")
      .then((data) => {
        if (data && data.success) {
          setLinked(pick(data.response, field.lists));
          setLibrary(data.response[field.library]);
        }
        setLoading(false);
      })
      .catch((error) => {
        setLoading(false);
        toast.error("Could not refresh publications: " + error);
      });
  };

  const unlink = (id, type) => {
    const ids = { publications: [], patents: [] };
    ids[type === "patents" ? "patents" : "publications"].push(id);
    setLoading(true);
    customFetch(baseURL + location.pathname + "/unlink", "POST", ids)
      .then((data) => (data && data.success ? refetch() : setLoading(false)))
      .catch((error) => {
        setLoading(false);
        toast.error("Error in unlinking publications: " + error);
      });
  };

  const link = () => {
    const ids = { publications: [], patents: [] };
    Object.keys(picked).forEach((type) => {
      picked[type].forEach((row) => ids[type !== "patents" ? "publications" : "patents"].push(row.id));
    });
    setLoading(true);
    customFetch(baseURL + location.pathname + "/link", "POST", ids)
      .then((data) => (data && data.success ? refetch().then(() => setOpen(false)) : setLoading(false)))
      .catch((error) => {
        setLoading(false);
        toast.error("Error in linking publications: " + error);
      });
  };

  // The picker reports ticks as { type: { id: true } }; keep the rows ticked.
  const choose = (ticks) => {
    const rows = {};
    Object.keys(ticks).forEach((type) => {
      Object.keys(ticks[type])
        .filter((id) => ticks[type][id] === true)
        .forEach((id) => {
          const row = library?.[type]?.find((publication) => publication.id === parseInt(id, 10));
          if (row) (rows[type] = rows[type] || []).push(row);
        });
    });
    setPicked(rows);
  };

  return (
    <>
      {field.editable && (
        <GridContainer
          label={field.label}
          elements={[
            <CustomButton text={field.add_label} variant="secondary" size="sm" onClick={() => setOpen(true)} />,
          ]}
        />
      )}
      <GridContainer
        elements={[
          <ShowPublications
            formData={linked}
            enableEdit={field.editable}
            enableDelete={field.editable}
            canAdd={field.editable}
            onDelete={unlink}
            confirmUnlink
            refetchData={refetch}
          />,
        ]}
        space={3}
      />
      <CustomModal
        isOpen={open}
        onClose={() => setOpen(false)}
        minHeight="200px"
        maxHeight="600px"
        minWidth="650px"
        maxWidth="700px"
        closeOnOutsideClick={false}
      >
        <ShowPublications
          formData={library}
          enableSelect={true}
          enableSubmit={true}
          canAdd={true}
          onSelect={choose}
          onSubmit={link}
          refetchData={refetch}
        />
      </CustomModal>
    </>
  );
};

export default PublicationsBlock;

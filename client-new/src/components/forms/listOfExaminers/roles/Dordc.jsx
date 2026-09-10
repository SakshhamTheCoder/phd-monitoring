import React, { useEffect, useState, useCallback } from "react";
import Recommendation from "../../layouts/Recommendation";
import GridContainer from "../../fields/GridContainer";
import TableComponent from "../../table/TableComponent";
import RadioButtonGroup from "../../fields/RadioButtonGroup";
import { useLoading } from "../../../../context/LoadingContext";
import CustomButton from "../../fields/CustomButton";
import { submitForm } from "../../../../api/form";
import { useLocation } from "react-router-dom";

const Dordc = ({ formData }) => {
  const [selected, setSelected] = useState([]);
  const [rejected, setRejected] = useState([]);
  const [body, setBody] = useState({});
  const [lock, setLock] = useState(formData?.locks?.dordc || true);
  const [isLoaded, setIsLoaded] = useState(false);
  const location = useLocation();
  const { setLoading } = useLoading();

  useEffect(() => {
    // Initialize state based on formData
    if (formData) {
      setLoading(true);

      setSelected([
        ...formData.national
          .filter((item) => item.recommendation === "approved")
          .map((item) => item.id),
        ...formData.international
          .filter((item) => item.recommendation === "approved")
          .map((item) => item.id),
      ]);

      setRejected([
        ...formData.national
          .filter((item) => item.recommendation === "rejected")
          .map((item) => item.id),
        ...formData.international
          .filter((item) => item.recommendation === "rejected")
          .map((item) => item.id),
      ]);

      setBody({
        approval: true,
        approvals:selected,
        rejections:rejected
      });

      if (formData.role !== "dordc") {
        setLock(true);
      }

      setIsLoaded(true);
      setLoading(false);
    }
  }, [formData, setLoading]);

  const handleSelection = useCallback(
    (id, value) => {
      if (value === 1) {
        setSelected((prev) => (prev.includes(id) ? prev : [...prev, id]));
        setRejected((prev) => prev.filter((item) => item !== id));
      } else if (value === 0) {
        setRejected((prev) => (prev.includes(id) ? prev : [...prev, id]));
        setSelected((prev) => prev.filter((item) => item !== id));
      }
    },
    []
  );
  
  useEffect(() => {
    setBody({ approval: true, approvals: selected, rejections: rejected });
  }, [selected, rejected]);

  // submitForm already reports the outcome and reloads. Toasting again here
  // announced success even when the server had refused the submission.
  const handleSubmit = () => submitForm(body, location, setLoading);

  const examiners = [
    ...formData.national.map((item) => ({ ...item, type: "National" })),
    ...formData.international.map((item) => ({ ...item, type: "International" })),
  ];

  const national = formData.national.map((item) => ({
    ...item,
    type: "National",
  }));

  const international= formData.international.map((item) => ({
    ...item,
    type: "International",
  }));

  return (
    <>
      {isLoaded ? (
        <>
        {formData.role === "dordc" && formData.stage=== "dordc"  && (<>
          <GridContainer
            elements={[
              <TableComponent
                data={national}
                titles={[
                  "Name",
                  "Email",
                  "Department",
                  "Designation",
                  "Institution",
                  "Type",
                  "Status",
                ]}
                keys={[
                  "name",
                  "email",
                  "department",
                  "designation",
                  "institution",
                  "type",
                  "buttons",
                ]}
                components={[
                  {
                    key: "buttons",
                    component: ({ row }) => (
                      <RadioButtonGroup
                        titles={["Accept", "Reject"]}
                        values={[1, 0]}
                        defaultValue={
                          selected.includes(row.id)
                            ? 1
                            : rejected.includes(row.id)
                            ? 0
                            : null
                        }
                        onSelect={(value) => handleSelection(row.id, value)}
                      />
                    ),
                  },
                ]}
              />,
            ]}
            label="National Examiners"
            space={3}
          />

  <GridContainer
            elements={[
              <TableComponent
                data={international}
                titles={[
                  "Name",
                  "Email",
                  "Department",
                  "Designation",
                  "Institution",
                  "Type",
                  "Status",
                ]}
                keys={[
                  "name",
                  "email",
                  "department",
                  "designation",
                  "institution",
                  "type",
                  "buttons",
                ]}
                components={[
                  {
                    key: "buttons",
                    component: ({ row }) => (
                      <RadioButtonGroup
                        titles={["Accept", "Reject"]}
                        values={[1, 0]}
                        defaultValue={
                          selected.includes(row.id)
                            ? 1
                            : rejected.includes(row.id)
                            ? 0
                            : null
                        }
                        onSelect={(value) => handleSelection(row.id, value)}
                      />
                    ),
                  },
                ]}
              />,
            ]}
            label="International Examiners"
            space={3}
          />
          
          </>
  )}
{
            formData.role === "dordc" && formData.stage=== "dordc"  && (
                <>
                  <GridContainer elements={[
                    <CustomButton text="Submit" onClick={() => {submitForm(body,location,setLoading)}}/>
                  ]}/>
                </>
            )
          }
        </>
      ) : (
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <p>Loading...</p>
        </div>
      )}
    </>
  );
};

export default Dordc;

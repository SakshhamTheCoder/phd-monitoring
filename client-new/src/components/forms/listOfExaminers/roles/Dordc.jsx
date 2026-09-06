import React, { useEffect, useState, useCallback } from "react";
import Recommendation from "../../layouts/Recommendation";
import GridContainer from "../../fields/GridContainer";
import TableComponent from "../../table/TableComponent";
import RadioButtonGroup from "../../fields/RadioButtonGroup";
import { useLoading } from "../../../../context/LoadingContext";
import { toast } from "react-toastify";
import CustomButton from "../../fields/CustomButton";
import { submitForm } from "../../../../api/form";
import { useLocation } from "react-router-dom";
import { customFetch } from "../../../../api/base";
import { baseURL } from "../../../../api/urls";

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
          .map((item) => item.email),
        ...formData.international
          .filter((item) => item.recommendation === "approved")
          .map((item) => item.email),
      ]);

      setRejected([
        ...formData.national
          .filter((item) => item.recommendation === "rejected")
          .map((item) => item.email),
        ...formData.international
          .filter((item) => item.recommendation === "rejected")
          .map((item) => item.email),
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
    (email, value) => {
      console.log("Handling selection for:", email, "with value:", value);
      if (value === 1) {
        // Add to `selected` if not already present and remove from `rejected`
        setSelected((prevSelected) => {
          if (!prevSelected.includes(email)) {
            return [...prevSelected, email];
          }
          return prevSelected;
        });
        setRejected((prevRejected) =>
          prevRejected.filter((item) => item !== email)
        );
      } else if (value === 0) {
        // Add to `rejected` if not already present and remove from `selected`
        setRejected((prevRejected) => {
          if (!prevRejected.includes(email)) {
            return [...prevRejected, email];
          }
          return prevRejected;
        });
        setSelected((prevSelected) =>
          prevSelected.filter((item) => item !== email)
        );
      }
      setBody({
        approval: true,
        approvals:selected,
        rejections:rejected
      });

    },
    [] // Dependencies: Empty, as we're using functional updates
  );
  
  // Debugging: Log `selected` and `rejected` states
  useEffect(() => {
    console.log("Updated selected:", selected);
    console.log("Updated rejected:", rejected);
    setBody({
      approval: true,
      approvals:selected,
      rejections:rejected
    })
  }, [selected, rejected]);
  
  const handleSubmit = async () => {
    try {
      setLoading(true);
      await submitForm(body, location, setLoading);
      toast.success("Form submitted successfully!");
    } catch (error) {
      toast.error("Failed to submit the form.");
    } finally {
      setLoading(false);
    }
  };

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
                          selected.includes(row.email)
                            ? 1
                            : rejected.includes(row.email)
                            ? 0
                            : null
                        }
                        onSelect={(value) => handleSelection(row.email, value)}
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
                          selected.includes(row.email)
                            ? 1
                            : rejected.includes(row.email)
                            ? 0
                            : null
                        }
                        onSelect={(value) => handleSelection(row.email, value)}
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

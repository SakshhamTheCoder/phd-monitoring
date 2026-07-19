import React, { useEffect, useState } from "react";
import Layout from "../../components/dashboard/layout";
import FormList from "../../components/forms/formList/FormList";
import { useLocation } from "react-router-dom";
import CreateNewBar from "../../components/forms/formList/CreateNewBar";
import FilterBar from "../../components/filterBar/FilterBar";
import PagenationTable from "../../components/pagenationTable/PagenationTable";
import GridContainer from "../../components/forms/fields/GridContainer";
import CustomButton from "../../components/forms/fields/CustomButton";
import CustomModal from "../../components/forms/modal/CustomModal";
import InputField from "../../components/forms/fields/InputField";
import BulkAllocateSupervisors from "../../components/bulkAllocateSupervisors/BulkAllocateSupervisors";

const FormListPage = () => {
  const location = useLocation();
  const [role, setRole] = useState();
  const [showBar, setShowBar] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [modalButtonShow, setModalButtonShow] = useState(false);
  const [rollNumber, setRollNumber] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkAllocateOpen, setIsBulkAllocateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState({}); // Initialize filters state

  // Only the PhD Coordinator allocates supervisors, and only from the
  // department-wide allocation list (not a single student's form list).
  const showBulkAllocate =
    role === "phd_coordinator" &&
    location.pathname === "/forms/supervisor-allocation";

  useEffect(() => {
    // Set the user role from localStorage
    setRole(localStorage.getItem("userRole"));
    const match = location.pathname.match(
      /^\/students\/(\d+)\/forms\/list-of-examiners$/
    );
    const matchPath2 = location.pathname.match(/^\/forms\/list-of-examiners$/);
    if (match) {
      setShowButton(true);
      setRollNumber(match[1]);
    } else if (matchPath2) {
      setModalButtonShow(true);
    } else {
      setShowButton(false);
    }
  }, [location]);
  const handleSearch = (query) => {
    setFilters((prev) => {
      return JSON.stringify(prev) !== JSON.stringify(query) ? query : prev;
    });
  };

  return (
    <Layout
      children={
        <>
          {role === "faculty" && showButton && (
            <CreateNewBar rollNumber={rollNumber} />
          )}
          {role === "faculty" && modalButtonShow && (
            <GridContainer
              elements={[
                <></>,
                <></>,
                <>
                  <CustomButton
                    onClick={() => setIsModalOpen(true)}
                    text="Create New Form +"
                  />
                </>,
              ]}
            />
          )}
          {role !== "student" ? (
            <>
              <FilterBar onSearch={handleSearch} />
              <PagenationTable
                key={refreshKey}
                endpoint={location.pathname}
                filters={filters}
                enableApproval={role !== "faculty" && role !== "admin"}
                enableSelect={role !== "faculty" && role !== "admin"}
                extraTopbarComponents={
                  showBulkAllocate ? (
                    <CustomButton
                      text="Bulk Allocate"
                      variant="secondary"
                      onClick={() => setIsBulkAllocateOpen(true)}
                    />
                  ) : null
                }
              />
            </>
          ) : (
            <FormList />
          )}
          <CustomModal
            isOpen={isBulkAllocateOpen}
            onClose={() => setIsBulkAllocateOpen(false)}
            width="90vw"
          >
            <BulkAllocateSupervisors
              onSuccess={() => {
                setIsBulkAllocateOpen(false);
                setRefreshKey((prev) => prev + 1);
              }}
            />
          </CustomModal>
          <CustomModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            minWidth="500px"
            maxWidth="600px"
            minHeight="200px"
            maxHeight="400px"
            children={[
                <>
                {!showBar ? (
                <GridContainer 
                label="Enter Student Roll Number to initiate List of Examiners"
                elements={[
                    <InputField 
                        hint={"Enter Roll Number"}
                        label={"Roll Number"}
                        onChange={(value)=>{setRollNumber(value)}}
                    />,
                    <CustomButton
                        label=" "
                        text="Submit"
                        onClick={()=>{
                           setShowBar(true);
                        }}
                    />
                ]}
                
                />):(<CreateNewBar rollNumber={rollNumber} label={"Confirm Form for "+rollNumber} />)}
                </>,
            ]}
          />
        </>
      }
    />
  );
};

export default FormListPage;

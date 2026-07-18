import { useEffect, useState } from "react";
import { formatDate } from "../../../../utils/timeParse";
import GridContainer from "../../fields/GridContainer";
import InputField from "../../fields/InputField";
import InputSuggestion from "../../fields/InputSuggestions";
import DropdownField from "../../fields/DropdownField";
import CustomButton from "../../fields/CustomButton";
import { submitForm } from "../../../../api/form";
import { useLocation } from "react-router-dom";
import { useLoading } from "../../../../context/LoadingContext";
import { baseURL } from "../../../../api/urls";
import Recommendation from "../../layouts/Recommendation";
import { toast } from "react-toastify";
import TableComponent from "../../table/TableComponent";

const Hod = ({ formData }) => {
  const [lock, setLock] = useState(formData.locks?.hod);
  const [body, setBody] = useState({});
  const [isLoaded, setIsLoaded] = useState(true);
  const location = useLocation();
  const [greater, setGreater] = useState(true);
  const { setLoading } = useLoading();

  const apiURL = baseURL + "/suggestions/faculty";
  const apiURL2 = baseURL + "/suggestions/outside-expert";
  useEffect(() => {
    setLock(formData.locks?.hod);
    let cognates = formData.chairman_experts?.map((item) => {
      return item.faculty_code;
    });
    if (!cognates || cognates.length === 0 || cognates[0] === null) {
      cognates = [-1];
    }
    let outside_experts = formData.outside_experts.map((item) => {
      return item.id;
    });
    if (
      !outside_experts ||
      outside_experts.length !== 3 ||
      outside_experts[0] === null
    ) {
      outside_experts = [-1, -1, -1];
    }
    setBody({
      approval: formData.approvals.hod,
      comments: formData.comments.hod,
      chairman_experts: cognates,
      outside_experts: outside_experts,
    });
    setIsLoaded(true);
  }, [formData]);

  const onUpdateApproval = (data) => {
    console.log(data);
    setBody((prevBody) => ({
      ...prevBody,
      approval: data.approval,
      comments: data.comments,
    }));
    console.log(body);
  };
  const handleAddExpert = () => {
    if(body.chairman_experts.length>=2)
        toast.error("You can only add max 2 experts");
    else
        setBody((prevBody) => ({
            ...prevBody, 
            chairman_experts: [...prevBody.chairman_experts, ""],}));
  }
  return (
    <>
      {isLoaded && formData && (
        <>
          <Recommendation
            formData={formData}
            role="hod"
            allowRejection={false}
            moreFields={true}
            handleRecommendationChange={onUpdateApproval}
          ></Recommendation>
          {body.approval && (
            <>
            <p style={{ fontWeight: "bold", textAlign: "left" }}>List of 3 outside experts proposed by the HOD</p>

          {greater && lock && formData.outside_experts.length === 3 ? (
            <>
              <GridContainer
                elements={[
                  <TableComponent
                    data={formData.outside_experts}
                    keys={["name", "institution", "department", "designation"]}
                    titles={[
                      "Name",
                      "Institution",
                      "Department",
                      "Designation",
                    ]}
                  />,
                ]}
                space={3}
              />
            </>
          ) : (
            <>
              <GridContainer
                elements={[
                  <InputSuggestion
                    apiUrl={apiURL2}
                    showLabel={false}
                    initialValue={formData.outside_experts[0]?.name}
                    onSelect={(value) => {
                      body.outside_experts[0] = value.id;
                    }}
                    lock={lock}
                  />,
                  <InputSuggestion
                    apiUrl={apiURL2}
                    showLabel={false}
                    initialValue={formData.outside_experts[1]?.name}
                    onSelect={(value) => {
                      body.outside_experts[1] = value.id;
                    }}
                    lock={lock}
                  />,
                  <InputSuggestion
                    apiUrl={apiURL2}
                    showLabel={false}
                    initialValue={formData.outside_experts[2]?.name}
                    onSelect={(value) => {
                      body.outside_experts[2] = value.id;
                    }}
                    lock={lock}
                  />,
                ]}
              />
            </>
          )}


            {lock && formData.chairman_experts ?(<>
                <GridContainer
                elements={[
                  <p>
                    Expert(s) recommended by chairman board of the studies of
                    concerned department in cognate area of department:{" "}
                  </p>,  
                ]} space={3}
              />
                <GridContainer elements={[
                <TableComponent
                    data={formData.chairman_experts}
                    keys={["name", "department", "designation"]}
                    titles={["Name", "Department", "Designation"]}
                    />,
                ]} space={3}/>
            </>):(<> 
                <GridContainer
                label="Expert(s) recommended by chairman board of the studies of concerned department in cognate area of department: "
                elements={[
                  
                   <></>,
                  <></>,
                  <>{!lock && ( <CustomButton text="Add Expert +" onClick={handleAddExpert}></CustomButton>)}</>
                 
                ]}
              />
                <GridContainer
                    elements={body.chairman_experts.map((expert, index) => (
                    <InputSuggestion
                        apiUrl={apiURL}
                        label={`Expert ${index + 1}`}
                        initialValue={formData.chairman_experts[index]?.name}
                        onSelect={(value) => {
                        body.chairman_experts[index] = value.id;
                        }}
                        lock={lock}
                        body={{ department_id: formData.department_id }}
                    />
                    ))}
                /></>)}
            
                
            </>
          )}
           {
            formData.role === "hod" && !lock && (
                <>
                  <GridContainer elements={[
                    <CustomButton text="Submit" onClick={() => {submitForm(body,location,setLoading)}}/>
                  ]}/>
                </>
            )
          }
        </>
        
      )}
    </>
  );
};

export default Hod;

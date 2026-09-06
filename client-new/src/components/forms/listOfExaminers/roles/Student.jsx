import React, { useEffect, useState } from "react";
import GridContainer from "../../fields/GridContainer";
import InputField from "../../fields/InputField";
import { formatDate } from "../../../../utils/timeParse";
import TableComponent from "../../table/TableComponent";

const Student = ({ formData }) => {

  const [lock, setLock] = useState(true);
  const [isLoaded, setIsLoaded] = useState(true);
  
 
  return (
    <div>
      {isLoaded && formData && (
        <>
          <GridContainer
            elements={[
              <InputField
                label="Roll Number"
                initialValue={formData.roll_no}
                isLocked={true}
              />,
              <InputField
                label="Name"
                initialValue={formData.name}
                isLocked={true}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label="Date Of Admission"
                initialValue={formatDate(formData.date_of_registration)}
                isLocked={true}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label="Email"
                initialValue={formData.email}
                isLocked={true}
              />,
              <InputField
                label="Mobile Number"
                initialValue={formData.phone}
                isLocked={true}
              />,
            ]}
          />

          <GridContainer elements={[
                <TableComponent 
                  data={formData.supervisors}
                  keys={[ "name", "department", "designation"]}
                  titles={[ "Name", "Department", "Designation"]}
                  />,
              ]} space={2}
              label="Supervisors"
              />
          
        </>
      )}
    </div>
  );
};

export default Student;

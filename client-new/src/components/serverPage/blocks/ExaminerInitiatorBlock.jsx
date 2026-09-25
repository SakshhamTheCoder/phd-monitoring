import React, { useState } from 'react';
import GridContainer from '../../forms/fields/GridContainer';
import InputField from '../../forms/fields/InputField';
import CustomButton from '../../forms/fields/CustomButton';
import CreateNewBar from '../../forms/formList/CreateNewBar';

/**
 * A supervisor starting a list of examiners for one of their scholars: the
 * roll number first, then a confirmation that raises the form for them.
 */
const ExaminerInitiatorBlock = () => {
  const [rollNumber, setRollNumber] = useState(null);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      {!confirming ? (
        <GridContainer
          label="Enter the student roll number to initiate a list of examiners"
          elements={[
            <InputField
              hint={"Enter roll number"}
              label={"Roll number"}
              onChange={(value) => { setRollNumber(value.trim()); }}
            />,
            <CustomButton
              label=" "
              text="Submit"
              disabled={!rollNumber}
              onClick={() => { setConfirming(true); }}
            />,
          ]}
        />
      ) : (
        <CreateNewBar rollNumber={rollNumber} label={"Confirm form for " + rollNumber} />
      )}
    </>
  );
};

export default ExaminerInitiatorBlock;

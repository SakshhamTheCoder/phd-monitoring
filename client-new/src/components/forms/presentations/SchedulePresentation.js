import React, { useEffect, useState } from "react";
import GridContainer from "../fields/GridContainer";
import { useLoading } from "../../../context/LoadingContext";
import DropdownField from "../fields/DropdownField";
import { baseURL } from "../../../api/urls";
import { customFetch } from "../../../api/base";
import DateField from "../fields/DateField";
import TimeField from "../fields/TimeField";
import InputField from "../fields/InputField";
import { generateReportPeriods } from "../../../utils/semester";
import CustomButton from "../fields/CustomButton";
import { toast } from "react-toastify";

const SchedulePresentation = ({ close, semester }) => {
  const { setLoading } = useLoading();
  const [isLoaded, setIsLoaded] = useState(false);
  const [students, setStudents] = useState([]);
  const [body, setBody] = useState({});
  const [reportPeriods, setReportPeriods] = useState([]);

    useEffect(() => {
        const url = baseURL + "/students";
        customFetch(url, "GET")
          .then((data) => {
            if (data && data.success) {
                for (let i = 0; i < data.response.length; i++) {
                    data.response[i].value = data.response[i].roll_no;
                    data.response[i].title = data.response[i].name;
                }
                console.log(data.response);
                let stu=data.response.data.map((student) => {
                    return {
                        value: student.roll_no,
                        title: student.name,
                    };
                });
              setStudents(stu);
              setIsLoaded(true);
              setLoading(false);
            }
            setLoading(false);
          })
          .catch((error) => {
            console.log(error);
            // setLoading(false);
          });
          const periods = generateReportPeriods(2,1,true);
          const pp=[];
          periods.forEach((period) => {
                const period1 = {};
                period1.value = period;
                period1.title = period;
                pp.push(period1);
          });
         setReportPeriods(pp);
          body.period_of_report = semester;
    }, []);
    
    const schedule = () => {
        const raw = body.guest_emails_raw || "";
        if(body.guest_emails_raw){
        const emails = raw.split(",").map(email => email.trim());
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidEmails = emails.filter(email => !emailRegex.test(email));

      if (invalidEmails.length > 0) {
        toast.error("Invalid email(s): " + invalidEmails.join(", "));
        return;
      } else {
        body.guest_emails = emails;
      }
    }

    setLoading(true);
    customFetch(`${baseURL}/presentation/`, "POST", body)
      .then((data) => {
        if (data?.success) {
          toast.success("Presentation Scheduled");
          if (close) close();
        }
      })
      .catch((error) => {
        toast.error("Error in scheduling presentation: " + error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <>
      {isLoaded && (
        <>
          <GridContainer
            elements={[
              <DropdownField
                label="Student"
                options={students}
                onChange={(value) =>
                  setBody((prev) => ({ ...prev, student_id: value }))
                }
                required={true}
              />,
            ]}
            space={2}
          />
          <GridContainer
            elements={[
              <InputField
                label={"Period of Report"}
                isLocked={true}
                initialValue={semester}
                required={true}
              />
            ]}
            space={2}
          />
          <GridContainer
            elements={[
              <DateField
                label="Date"
                onChange={(value) =>
                  setBody((prev) => ({ ...prev, date: value }))
                }
                required={true}
              />,
              <TimeField
                label="Time"
                onChange={(value) =>
                  setBody((prev) => ({ ...prev, time: value }))
                }
                required={true}
              />,
             
            ]}
          />
          <GridContainer
            elements={[
              <InputField
              label={"Venue (Leave Blank to Auto Schedule Meet)"}
              onChange={(value) =>
                setBody((prev) => ({ ...prev, venue: value }))
              }
              />,
            ]}
            space={2}
          />
          <GridContainer
            elements={[
              <InputField
                label="Additional Guest Emails (comma separated)"
                onChange={(value) =>
                  setBody((prev) => ({ ...prev, guest_emails_raw: value }))
                }
              />,
            ]}
            space={3}
          />
          <GridContainer
            elements={[<></>, <></>, <CustomButton text="Schedule" onClick={schedule} />]}
          />
        </>
      )}
    </>
  );
};

export default SchedulePresentation;

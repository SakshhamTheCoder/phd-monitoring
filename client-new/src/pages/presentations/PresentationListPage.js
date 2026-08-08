import React, { useEffect, useState } from "react";
import Layout from "../../components/dashboard/layout";
import FormList from "../../components/forms/formList/FormList";
import CustomModal from "../../components/forms/modal/CustomModal";
import CustomButton from "../../components/forms/fields/CustomButton";
import GridContainer from "../../components/forms/fields/GridContainer";
import BulkSchedulePresentation from "../../components/forms/presentations/BulkSchedulePresentation";
import SchedulePresentation from "../../components/forms/presentations/SchedulePresentation";
import FormTable from "../../components/forms/formTable/FormTable";
import FilterBar from "../../components/filterBar/FilterBar";
import PagenationTable from "../../components/pagenationTable/PagenationTable";
import SemesterStatsCard from "./SemsterStatsCard";
import { set } from "react-hook-form";
import { useParams } from "react-router-dom";

const PresentationListPage = () => {
  const { semester_id } = useParams();
  const [extraFilter, setExtraFilter] = useState(false);
  const [location, setLocation] = useState(window.location.pathname);
  const [num, setNum] = useState(0);
  const [presentationTab, setPresentationTab] = useState(0);
  const role = localStorage.getItem("userRole") || "student";
  // const [filters, setFilters] = useState(role==="student"?{}:{
  //   mandatory_filter: [
  //     {
  //       key: "action",
  //       value: 1,
  //     },
  //   ],
  // });

  const handleSearch = (query) => {
    setFilters(query);
  };

  const [enableApproval, setEnableApproval] = useState(false);
  const getInitialFilters = () => {
    const role = localStorage.getItem("userRole") || "student";
    if (role === "student") {
      return {};
    } else {
      return {
        mandatory_filter: [
          {
            key: "action",
            value: 1,
          },
        ],
      };
    }
  };
  
  const [filters, setFilters] = useState(getInitialFilters);
  
  useEffect(() => {
    setNum(num + 1);
    if(role==='student') return;
    setLocation(window.location.pathname);
    if (presentationTab === 0) {
      setFilters({
        mandatory_filter: [
          {
            key: "action",
            value: 1,
          },
        ],
      });
      setEnableApproval(true);
    } else if (presentationTab === 1) {
      //new
      setFilters({
        mandatory_filter: [
          {
            key: "upcoming",
            value: 1,
          },
        ],
      });
    } else if (presentationTab === 2) {
      //new route
      setFilters({
        mandatory_filter: [
          {
            key: "missed",
            op: "=",
            value: 0,
          },
        ],
      });
      setEnableApproval(false);
    } else if (presentationTab === 3) {
      //new route
      setEnableApproval(false);
      setLocation(window.location.pathname + "/not-scheduled");
    } else if (presentationTab === 4) {
      //semester off
    } else if (presentationTab === 5) {
      setFilters({
        mandatory_filter: [
          {
            key: "missed",
            value: 1,
          },
        ],
      });
      setEnableApproval(false);
    } else if (presentationTab === 6) {
      setFilters({});
      setEnableApproval(false);
      setExtraFilter(true);
    }
  }, [presentationTab]);

  return (
    <Layout
      children={
        <>
          <div className="page-header">
            <div>
              <h1 className="page-title">Progress Monitoring List</h1>
            </div>
          </div>

          <SemesterStatsCard semesterName={semester_id} setFilters={setExtraFilter} />

          {role !== "student" && (
            <div className="tabs">
              {[
                'Action Required',
                'Upcoming Progress Monitoring',
                'Completed',
                'Not Scheduled',
                'Semester Off',
                'Not Submitted',
                'All Progress Monitoring',
              ].map((label, i) => (
                <button
                  key={label}
                  className={`tab ${presentationTab === i ? 'active' : ''}`}
                  onClick={() => setPresentationTab(i)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {extraFilter && <FilterBar onSearch={handleSearch} />}
          <PagenationTable
            num={num}
            endpoint={location}
            filters={filters}
            enableApproval={enableApproval}
            enableSelect={enableApproval}
          />
        </>
      }
    />
  );
};

export default PresentationListPage;

import React, { useEffect, useState } from "react";
import Layout from "../../components/dashboard/layout";
import Tabs from "../../components/tabs/Tabs";
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
import PageHeader from '../../components/pageHeader/PageHeader';
import { currentRole } from '../../auth/access';

// Admin reads every evaluation but reviews none, so nothing waits on it.
const REVIEWS_NOTHING = ['admin'];
// Mirrors PresentationController::bulkSubmit.
const BULK_APPROVERS = ['hod', 'dordc', 'adordc'];
// Mirrors SemesterController::notScheduled.
const READS_NOT_SCHEDULED = ['hod', 'phd_coordinator', 'faculty', 'dordc', 'admin'];
const ACTION_TAB = 0;
const NOT_SCHEDULED_TAB = 3;
// Never had a filter behind it, so it showed whatever the previous tab showed.
const SEMESTER_OFF_TAB = 4;
const ALL_TAB = 6;

const PresentationListPage = () => {
  const { semester_id } = useParams();
  const [extraFilter, setExtraFilter] = useState(false);
  const [location, setLocation] = useState(window.location.pathname);
  const [num, setNum] = useState(0);
  const role = currentRole() || "student";
  const [presentationTab, setPresentationTab] = useState(REVIEWS_NOTHING.includes(role) ? ALL_TAB : ACTION_TAB);
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
    if (role === "student" || REVIEWS_NOTHING.includes(role)) {
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
      setEnableApproval(BULK_APPROVERS.includes(role));
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
      setEnableApproval(false);
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
          <PageHeader title="Progress Monitoring List" />

          <SemesterStatsCard semesterName={semester_id} setFilters={setExtraFilter} />

          {role !== "student" && (
            <Tabs
              value={presentationTab}
              onChange={setPresentationTab}
              items={[
                'Action Required',
                'Upcoming Progress Monitoring',
                'Completed',
                'Not Scheduled',
                'Semester Off',
                'Not Submitted',
                'All Progress Monitoring',
              ]
                .map((label, i) => ({ value: i, label }))
                .filter((tab) => tab.value !== SEMESTER_OFF_TAB)
                .filter((tab) => !(tab.value === ACTION_TAB && REVIEWS_NOTHING.includes(role)))
                .filter((tab) => !(tab.value === NOT_SCHEDULED_TAB && !READS_NOT_SCHEDULED.includes(role)))}
            />
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

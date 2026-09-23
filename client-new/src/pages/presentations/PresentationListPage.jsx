import React, { useState } from "react";
import Tabs from "../../components/tabs/Tabs";
import FilterBar from "../../components/filterBar/FilterBar";
import PagenationTable from "../../components/pagenationTable/PagenationTable";
import SemesterStatsCard from "./SemsterStatsCard";
import { useLocation, useParams } from "react-router-dom";
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

const onlyWhere = (key, value, op) => ({
  mandatory_filter: [{ key, ...(op ? { op } : {}), value }],
});

// What each tab asks the list for. Not Scheduled is its own endpoint, which
// reads no filters. Module constants, so the table sees the same object
// until the tab changes and fetches once.
const NO_FILTERS = {};
const TAB_FILTERS = {
  0: onlyWhere("action", 1),
  1: onlyWhere("upcoming", 1),
  2: onlyWhere("missed", 0, "="),
  5: onlyWhere("missed", 1),
};

const PresentationListPage = () => {
  const { semester_id } = useParams();
  const { pathname } = useLocation();
  const role = currentRole() || "student";
  const [presentationTab, setPresentationTab] = useState(REVIEWS_NOTHING.includes(role) ? ALL_TAB : ACTION_TAB);
  // The All tab opens with the filter bar showing; the stats card's toggle
  // changes this same flag.
  const [extraFilter, setExtraFilter] = useState(presentationTab === ALL_TAB);
  // A search from the filter bar stands in for the tab's filters until the
  // tab changes.
  const [searchFilters, setSearchFilters] = useState(null);

  const selectTab = (tab) => {
    setPresentationTab(tab);
    setSearchFilters(null);
    if (tab === ALL_TAB) setExtraFilter(true);
  };

  // Derived rather than set from an effect: the effect handed the table a
  // second filters object right after mount, so it fetched the list twice.
  const tabFilters = role === "student" ? NO_FILTERS : (TAB_FILTERS[presentationTab] ?? NO_FILTERS);
  const filters = searchFilters ?? tabFilters;
  const enableApproval = presentationTab === ACTION_TAB && BULK_APPROVERS.includes(role);
  const endpoint = presentationTab === NOT_SCHEDULED_TAB ? `${pathname}/not-scheduled` : pathname;

  return (
    <>
      <PageHeader title="Progress Monitoring List" />

      <SemesterStatsCard semesterName={semester_id} filtersEnabled={extraFilter} setFilters={setExtraFilter} />

      {role !== "student" && (
        <Tabs
          value={presentationTab}
          onChange={selectTab}
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
      {/* Keyed by tab: a tab change drops the search, so the box must empty too. */}
      {extraFilter && <FilterBar key={presentationTab} onSearch={setSearchFilters} />}
      <PagenationTable
        endpoint={endpoint}
        filters={filters}
        enableApproval={enableApproval}
        enableSelect={enableApproval}
      />
    </>
  );
};

export default PresentationListPage;

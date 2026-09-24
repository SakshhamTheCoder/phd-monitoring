import React from 'react';
import SemesterStatsCard from '../../../pages/presentations/SemsterStatsCard';

/**
 * A semester's progress monitoring figures above its list. Where the view says
 * so it also offers the switch that shows the list's advanced filters.
 */
const SemesterStatsBlock = ({ props, search }) => (
  <SemesterStatsCard
    semesterName={props?.semester || null}
    filtersEnabled={search?.shown ?? false}
    setFilters={search?.set ?? null}
  />
);

export default SemesterStatsBlock;

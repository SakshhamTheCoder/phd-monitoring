import React from 'react';
import UrfReportSchedule from '../../urf/UrfReportSchedule';

/** When each URF report round opens and closes, for the session picked below. */
const UrfReportScheduleBlock = ({ scope }) => (
  <UrfReportSchedule
    session={Number(scope?.value) || new Date().getFullYear()}
    sessions={(scope?.options || []).map((option) => Number(option.value))}
  />
);

export default UrfReportScheduleBlock;

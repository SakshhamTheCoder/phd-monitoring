import React, { useState } from 'react';
import Page from '../../components/page/Page';
import Panel from '../../components/panel/Panel';
import Tabs from '../../components/tabs/Tabs';
import LeaveQuotas from './configuration/LeaveQuotas';
import ThesisLimits from './configuration/ThesisLimits';
import SupervisionLimits from './configuration/SupervisionLimits';
import UgBranches from './configuration/UgBranches';
import CourseworkCredits from './configuration/CourseworkCredits';
import SynopsisChecklist from './configuration/SynopsisChecklist';

/**
 * One admin home for settings that would otherwise be hardcoded or buried in
 * the feature's own page: leave quotas today, thesis-extension limits and
 * whatever follows next.
 *
 * To add a section: write a component under ./configuration and add a line
 * here. Nothing else needs to change, and a section is free to talk to its
 * own endpoint.
 */
const SECTIONS = [
  { value: 'leave', label: 'Leave quotas', Component: LeaveQuotas },
  { value: 'thesis', label: 'Thesis duration', Component: ThesisLimits },
  { value: 'supervision', label: 'Supervision limits', Component: SupervisionLimits },
  { value: 'branches', label: 'UG branches', Component: UgBranches },
  { value: 'coursework', label: 'Coursework credits', Component: CourseworkCredits },
  { value: 'checklist', label: 'Synopsis checklist', Component: SynopsisChecklist },
];

const Configuration = () => {
  const [activeTab, setActiveTab] = useState(SECTIONS[0].value);

  return (
    <Page
      title="Configuration"
      description="Values the app reads at runtime. A change here applies to everyone immediately."
      tabs={(
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          items={SECTIONS.map(({ value, label }) => ({ value, label }))}
        />
      )}
    >
      {/* Every section stays mounted and the others are hidden, so an edit
          not yet saved survives a look at another tab. */}
      {SECTIONS.map(({ value, label, Component }) => (
        <Panel key={value} title={label} hidden={value !== activeTab}>
          <Component />
        </Panel>
      ))}
    </Page>
  );
};

export default Configuration;

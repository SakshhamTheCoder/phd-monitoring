import React, { useState } from 'react';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import Tabs from '../../components/tabs/Tabs';
import LeaveQuotas from './configuration/LeaveQuotas';
import ThesisLimits from './configuration/ThesisLimits';

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
  { value: 'leave', label: 'Leave Quotas', Component: LeaveQuotas },
  { value: 'thesis', label: 'Thesis Duration', Component: ThesisLimits },
];

const Configuration = () => {
  const [activeTab, setActiveTab] = useState(SECTIONS[0].value);
  const ActiveSection = SECTIONS.find((s) => s.value === activeTab).Component;

  return (
    <Layout>
      <PageHeader
        title="Configuration"
        subtitle="Values the app reads at runtime. A change here applies to everyone immediately."
      />

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        items={SECTIONS.map(({ value, label }) => ({ value, label }))}
      />

      <ActiveSection />
    </Layout>
  );
};

export default Configuration;

import React, { useState } from 'react';
import Page from '../page/Page';
import Panel from '../panel/Panel';
import Tabs from '../tabs/Tabs';
import LoadError from '../common/LoadError';
import { useView } from '../../api/views';
import SettingsSection from './SettingsSection';
import UgBranches from '../../pages/admin/configuration/UgBranches';
import SynopsisChecklist from '../../pages/admin/configuration/SynopsisChecklist';

// Sections with behaviour of their own, which the server places by name.
const BLOCKS = { 'ug-branches': UgBranches, 'synopsis-checklist': SynopsisChecklist };

/**
 * A page of sections, one per tab, as the server describes it (GET
 * /views/{page}, server: App\Pages\ConfigurationPage). Every section stays
 * mounted and the others are hidden, so an edit not yet saved survives a look
 * at another tab.
 */
const ServerSectionsPage = ({ page }) => {
  const { view, failed, retry } = useView(page);
  const [activeTab, setActiveTab] = useState(null);

  if (failed) {
    return (
      <Page>
        <LoadError message="Could not load this page. Check your connection and try again." onRetry={retry} />
      </Page>
    );
  }
  if (!view) return null;

  const active = activeTab ?? view.sections[0].value;

  return (
    <Page
      title={view.title}
      description={view.description}
      tabs={(
        <Tabs
          value={active}
          onChange={setActiveTab}
          items={view.sections.map(({ value, label }) => ({ value, label }))}
        />
      )}
    >
      {view.sections.map(({ value, label, section }) => {
        const Block = BLOCKS[section.block];
        return (
          <Panel key={value} title={label} hidden={value !== active}>
            {Block ? <Block /> : <SettingsSection section={section} />}
          </Panel>
        );
      })}
    </Page>
  );
};

export default ServerSectionsPage;

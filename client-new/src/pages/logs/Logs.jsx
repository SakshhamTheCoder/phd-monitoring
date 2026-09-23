import React from 'react';
import Page from '../../components/page/Page';
import Panel from '../../components/panel/Panel';
import LogViewer from '../../components/logViewer/LogViewer';

const Logs = () => (
  <Page title="Logs">
    <Panel flush className="log-panel">
      <LogViewer />
    </Panel>
  </Page>
);

export default Logs;

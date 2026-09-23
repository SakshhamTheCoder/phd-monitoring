import React, { useEffect,useState } from 'react';
import PageHeader from '../../components/pageHeader/PageHeader';
import LogViewer from '../../components/logViewer/LogViewer';

const Logs = () => {


  return (
    <>
      <PageHeader title="Logs" />
      <LogViewer/>
    </>
  );
}

export default Logs;

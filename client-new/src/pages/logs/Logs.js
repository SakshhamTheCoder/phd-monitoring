import React, { useEffect,useState } from 'react';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import LogViewer from '../../components/logViewer/LogViewer';

const Logs = () => {


  return (
    <>

       <Layout children={
        <>
          <PageHeader title="Logs" />
          <LogViewer/>
        </>
        }/>

    </>
  );
}

export default Logs;

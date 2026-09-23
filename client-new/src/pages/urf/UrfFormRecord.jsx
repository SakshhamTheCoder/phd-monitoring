import React from 'react';
import { useLocation } from 'react-router-dom';
import UrfFormShell from '../../components/urf/UrfFormShell';

/**
 * One URF form of one project. The API path is the page's path, as the PhD
 * form pages have it, so the form this is loads from the URL rather than from
 * a prop.
 */
const UrfFormRecord = () => {
  const { pathname } = useLocation();

  return (
    <UrfFormShell path={pathname} />
  );
};

export default UrfFormRecord;

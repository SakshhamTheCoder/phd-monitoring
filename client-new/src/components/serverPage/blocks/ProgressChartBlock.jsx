import React, { useEffect, useState } from 'react';
import Panel from '../../panel/Panel';
import ProgressChart from '../../profileCard/ProgressChart';
import { customFetch } from '../../../api/base';
import { baseURL } from '../../../api/urls';

/**
 * A scholar's evaluations over time, above the list of them. Hidden rather
 * than reported when it cannot be read: the list below is the page, and a
 * reader who may not read the history still reads that.
 */
const ProgressChartBlock = ({ props }) => {
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!props?.roll_no) return;
    customFetch(`${baseURL}/students/${props.roll_no}/progress-history`, 'GET', {}, false, false)
      .then((res) => res?.success && setProgress(res.response))
      .catch(() => {});
  }, [props?.roll_no]);

  return progress?.points?.length > 0 ? (
    <Panel title="Progress over time">
      <ProgressChart points={progress.points} milestones={progress.milestones} />
    </Panel>
  ) : null;
};

export default ProgressChartBlock;

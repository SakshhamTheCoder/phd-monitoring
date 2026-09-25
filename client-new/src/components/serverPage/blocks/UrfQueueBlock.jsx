import React from 'react';
import { useNavigate } from 'react-router-dom';
import Panel from '../../panel/Panel';
import TableComponent from '../../forms/table/TableComponent';

const FORM_NAMES = {
  'urf-application': 'Application',
  'urf-additional-info': 'Additional Information',
  'urf-half-yearly-report': 'Half-yearly Report',
  'urf-final-report': 'Final Report',
};

/** The URF steps waiting on the reader, oldest first. */
const UrfQueueBlock = ({ props }) => {
  const navigate = useNavigate();
  const queue = props?.rows || [];
  if (queue.length === 0) return null;

  return (
    <Panel flush title={`Waiting on you (${queue.length})`}>
      <TableComponent
        data={queue}
        keys={['session', 'project_title', 'students', 'form', 'waiting_since']}
        titles={['Session', 'Project title', 'Students', 'Form', 'Waiting since']}
        components={[{
          key: 'project_title',
          component: ({ row, data }) => (
            <button type="button" className="cell-link" onClick={() => navigate(`/urf/${row.form}/${row.id}`)}>
              {data}
            </button>
          ),
        }, {
          key: 'form',
          component: ({ data }) => FORM_NAMES[data] || data,
        }]}
      />
    </Panel>
  );
};

export default UrfQueueBlock;

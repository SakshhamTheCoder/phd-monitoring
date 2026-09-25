import React, { useState } from 'react';
import { toast } from 'react-toastify';
import CustomButton from '../../forms/fields/CustomButton';
import { customFetch } from '../../../api/base';
import { baseURL } from '../../../api/urls';
import { formatDate } from '../../../utils/timeParse';

/**
 * Mailing sign-in links to accounts nobody has claimed. An import creates them
 * without mailing anybody, and the office sends the links once those people
 * have been told the portal exists. Each import run stays on the list until
 * its last person is in, so a second import never buries the first. `props`
 * is who is waiting, as the server counted them for the page.
 */
const SignInLinksBlock = ({ props, onClose, onChanged }) => {
  const runs = props?.runs ?? [];
  const waitingEveryone = props?.everyone?.count ?? 0;
  // "756 student, 15 clerk" rather than a bare 771, because everyone reaches
  // the accounts other imports created too.
  const waitingByRole = Object.entries(props?.everyone?.by_role ?? {})
    .map(([role, count]) => `${count} ${role.replace(/_/g, ' ')}`)
    .join(', ');
  const [chosenRun, setChosenRun] = useState(runs[0]?.batch ?? 'everyone');
  const [sendingLinks, setSendingLinks] = useState(false);

  const sendSignInLinks = async () => {
    setSendingLinks(true);
    const body = chosenRun === 'everyone' ? {} : { batch: chosenRun };
    const res = await customFetch(`${baseURL}/users/sign-in-links`, 'POST', body);
    setSendingLinks(false);

    if (res?.success) {
      toast.success(res.response.message);
      onClose();
      onChanged();
    }
  };

  return (
    <div className="modal-form">
      <p>
        A link lets somebody choose their password. Anybody who already signs in,
        with a password or through Google, is left out.
      </p>

      {runs.map((run) => (
        <label key={run.batch} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <input
            type="radio"
            name="sign-in-link-group"
            value={run.batch}
            checked={chosenRun === run.batch}
            onChange={() => setChosenRun(run.batch)}
          />
          <span>
            <strong>{run.of === 'staff' ? 'Staff' : 'Scholars'} imported {formatDate(run.imported_at)}</strong>
            {' '}({run.waiting} waiting)
          </span>
        </label>
      ))}

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
        <input
          type="radio"
          name="sign-in-link-group"
          value="everyone"
          checked={chosenRun === 'everyone'}
          onChange={() => setChosenRun('everyone')}
        />
        <span>
          <strong>Everyone who cannot sign in yet ({waitingEveryone})</strong>
          {waitingByRole && <>: {waitingByRole}</>}
        </span>
      </label>

      <div className="modal-actions">
        <CustomButton text="Cancel" variant="quiet" onClick={onClose} />
        <CustomButton
          text="Send links"
          busy={sendingLinks}
          disabled={!waitingEveryone}
          onClick={sendSignInLinks}
        />
      </div>
    </div>
  );
};

export default SignInLinksBlock;

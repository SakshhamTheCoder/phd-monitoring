import React, { useCallback, useEffect, useState } from 'react';
import './Dashboard.css';
import { useLoading } from '../../context/LoadingContext';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import AdminHome from '../../components/profileCard/AdminHome';
import ServerRecordPage from '../../components/serverPage/ServerRecordPage';
import { currentRole } from '../../auth/access';
import LoadError from '../../components/common/LoadError';

const Dashboard = () => {
  const userRole = currentRole();
  const [view, setView] = useState(null); // 'student' | 'faculty' | 'admin'
  const { setLoading } = useLoading();
  const [data, setData] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    // showToast = false: a missing profile shouldn't pop an error toast; we fall
    // back to the admin overview below instead.
    const result = await customFetch(baseURL + '/home', 'GET', {}, false);
    const payload = result.response;

    if (result.success && payload?.type) {
      setView(payload.type);
      setData(payload.data);
    } else if (result.success || result.status === 404) {
      // No student/faculty record for this role (a 404 for a student account
      // without one), so show the overview rather than a dead "loading" state.
      setView('admin');
    } else {
      // A network or server failure is not "no profile": the admin overview
      // would tell a student or faculty member they are someone else.
      setFailed(true);
    }
    setLoading(false);
    setIsLoaded(true);
  }, [setLoading]);

  useEffect(() => {
    // Admin / clerk accounts have no personal (student/faculty) profile, and /home 404s for
    // them — which surfaces an error toast. Skip the call entirely and show the
    // overview built from what we already have in localStorage.
    if (userRole === 'admin' || userRole === 'clerk') {
      setView('admin');
      setIsLoaded(true);
      return;
    }
    // A UG student's profile is built from their URF project, which it fetches itself.
    if (userRole === 'ug_student') {
      setView('ug_student');
      setIsLoaded(true);
      return;
    }

    fetchData();
  }, [fetchData, userRole]);

  return (
    <>
      {isLoaded && (
        <>
          {failed ? (
            <LoadError message="Could not load your home page. Check your connection and try again." onRetry={fetchData} />
          ) : view === 'student' ? (
            // /home sends a thinner profile than the profile page reads, so it loads its own.
            <ServerRecordPage page="student-profile" loadingTitle="Loading profile" failedMessage="Could not load this profile. Check your connection and try again." />
          ) : view === 'ug_student' ? (
            <ServerRecordPage page="ug-profile" failedMessage="Could not load your profile. Check your connection and try again." />
          ) : view === 'admin' ? (
            <AdminHome data={data} />
          ) : (
            // The faculty profile is one page; the dashboard shows the
            // signed-in faculty's own.
            <ServerRecordPage page="research-profile" params={{ facultyCode: data?.faculty_code }} loadingTitle="Loading profile" failedMessage="Could not load this research profile. Check your connection and try again." />
          )}
        </>
      )}
    </>
  );
};

export default Dashboard;

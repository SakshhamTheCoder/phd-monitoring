import React, { useEffect, useState } from 'react';
import './Dashboard.css';
import Layout from '../../components/dashboard/layout';
import { useLoading } from '../../context/LoadingContext';
import ProfileCard from '../../components/profileCard/ProfileCard';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import FacultyProfile from '../../components/profileCard/FacultyProfile';
import AdminHome from '../../components/profileCard/AdminHome';

const Dashboard = () => {
  const userRole = localStorage.getItem('userRole');
  const [view, setView] = useState(null); // 'student' | 'faculty' | 'admin'
  const { setLoading } = useLoading();
  const [data, setData] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Admin / clerk accounts have no personal (student/faculty) profile, and /home 404s for
    // them — which surfaces an error toast. Skip the call entirely and show the
    // overview built from what we already have in localStorage.
    if (userRole === 'admin' || userRole === 'clerk') {
      setView('admin');
      setIsLoaded(true);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // showToast = false: a missing profile shouldn't pop an error toast; we fall
        // back to the admin overview below instead.
        const result = await customFetch(baseURL + '/home', 'GET', {}, false);
        const payload = result?.response;

        if (result?.success && payload?.type) {
          setView(payload.type);
          setData(payload.data);
        } else {
          // No student/faculty record for this role — show the overview rather than
          // a dead "loading" state.
          setView('admin');
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setView('admin');
      } finally {
        setLoading(false);
        setIsLoaded(true);
      }
    };

    fetchData();
  }, [setLoading, userRole]);

  return (
    <Layout>
      {isLoaded && (
        <>
          {view === 'student' ? (
            <ProfileCard data={data} />
          ) : view === 'admin' ? (
            <AdminHome data={data} />
          ) : (
            <FacultyProfile faculty={data} />
          )}
        </>
      )}
    </Layout>
  );
};

export default Dashboard;

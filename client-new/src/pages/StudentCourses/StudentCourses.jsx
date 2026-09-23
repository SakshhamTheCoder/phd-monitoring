import React, { useEffect, useState } from 'react';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import Loader from '../../components/loader/loader';
import PageHeader from '../../components/pageHeader/PageHeader';
import Tabs from '../../components/tabs/Tabs';
import LoadError from '../../components/common/LoadError';
import './StudentCourses.css';

const StudentCourses = () => {
  const [activeTab, setActiveTab] = useState('ongoing'); // 'ongoing' or 'past'
  const [ongoingCourses, setOngoingCourses] = useState([]);
  const [pastCourses, setPastCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);

    // Independent lists, so neither waits on the other. customFetch never
    // throws and toasts its own failures.
    const [ongoingResponse, pastResponse] = await Promise.all([
      customFetch(`${baseURL}/courses/student/my-courses?status=enrolled`, 'GET'),
      customFetch(`${baseURL}/courses/student/my-courses?status=completed`, 'GET'),
    ]);

    if (ongoingResponse.success) {
      setOngoingCourses(ongoingResponse.response.data);
    }

    if (pastResponse.success) {
      setPastCourses(pastResponse.response.data);
    }
    setLoadFailed(!ongoingResponse.success || !pastResponse.success);
    setLoading(false);
  };

  const renderCourseCard = (course) => (
    <div key={course.id} className="course-card">
      <div className="course-header">
        <h3>{course.course_name}</h3>
        <span className="course-code">{course.course_code}</span>
      </div>
      <div className="course-details">
        <div className="detail-row">
          <span className="detail-label">Department:</span>
          <span className="detail-value">{course.department_name}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Credits:</span>
          <span className="detail-value">{course.credits}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Semester:</span>
          <span className="detail-value">{course.semester}</span>
        </div>
        {course.status === 'completed' && course.grade && (
          <div className="detail-row">
            <span className="detail-label">Grade:</span>
            <span className="detail-value grade">{course.grade}</span>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="student-courses-container">
      <PageHeader title="My Courses" />

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { value: 'ongoing', label: `Ongoing Courses (${ongoingCourses.length})` },
          { value: 'past', label: `Past Courses (${pastCourses.length})` },
        ]}
      />

      <div className="courses-content">
        {loadFailed && (
          <LoadError message="Could not load your courses. Check your connection and try again." onRetry={fetchCourses} />
        )}

        {!loadFailed && activeTab === 'ongoing' && (
          <div className="courses-grid">
            {ongoingCourses.length > 0 ? (
              ongoingCourses.map(renderCourseCard)
            ) : (
              <div className="empty-state">
                <p>No ongoing courses</p>
              </div>
            )}
          </div>
        )}

        {!loadFailed && activeTab === 'past' && (
          <div className="courses-grid">
            {pastCourses.length > 0 ? (
              pastCourses.map(renderCourseCard)
            ) : (
              <div className="empty-state">
                <p>No past courses</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentCourses;

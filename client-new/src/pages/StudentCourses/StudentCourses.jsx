import React, { useEffect, useState } from 'react';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import Page from '../../components/page/Page';
import Panel from '../../components/panel/Panel';
import StatusNotice from '../../components/common/StatusNotice';
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
    <Panel
      key={course.id}
      title={course.course_name}
      actions={<span className="badge badge--accent">{course.course_code}</span>}
    >
      <dl className="kv">
        <div>
          <dt>Department</dt>
          <dd>{course.department_name}</dd>
        </div>
        <div>
          <dt>Credits</dt>
          <dd>{course.credits}</dd>
        </div>
        <div>
          <dt>Semester</dt>
          <dd>{course.semester}</dd>
        </div>
        {course.status === 'completed' && course.grade && (
          <div>
            <dt>Grade</dt>
            <dd><span className="badge badge--success">{course.grade}</span></dd>
          </div>
        )}
      </dl>
    </Panel>
  );

  const shownCourses = activeTab === 'ongoing' ? ongoingCourses : pastCourses;

  return (
    <Page
      title="My courses"
      // The counts are unknown until both lists arrive; zeros would be a guess.
      tabs={loading ? null : (
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { value: 'ongoing', label: `Ongoing courses (${ongoingCourses.length})` },
            { value: 'past', label: `Past courses (${pastCourses.length})` },
          ]}
        />
      )}
    >
      {loading ? (
        <StatusNotice tone="loading" title="Loading your courses" />
      ) : loadFailed ? (
        <LoadError message="Could not load your courses. Check your connection and try again." onRetry={fetchCourses} />
      ) : shownCourses.length > 0 ? (
        <div className="sc-grid reveal">{shownCourses.map(renderCourseCard)}</div>
      ) : (
        <StatusNotice tone="empty" title={activeTab === 'ongoing' ? 'No ongoing courses' : 'No past courses'} />
      )}
    </Page>
  );
};

export default StudentCourses;

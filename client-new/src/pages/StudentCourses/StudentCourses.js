import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import Loader from '../../components/loader/loader';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import Tabs from '../../components/tabs/Tabs';

const StudentCourses = () => {
  const [activeTab, setActiveTab] = useState('ongoing'); // 'ongoing' or 'past'
  const [ongoingCourses, setOngoingCourses] = useState([]);
  const [pastCourses, setPastCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      
      // Fetch ongoing courses
      const ongoingResponse = await customFetch(
        `${baseURL}/courses/student/my-courses?status=enrolled`,
        'GET'
      );
      
      // Fetch past courses
      const pastResponse = await customFetch(
        `${baseURL}/courses/student/my-courses?status=completed`,
        'GET'
      );

      if (ongoingResponse.success) {
        setOngoingCourses(ongoingResponse.response.data);
      }
      
      if (pastResponse.success) {
        setPastCourses(pastResponse.response.data);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
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
    <Layout> 
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
        {activeTab === 'ongoing' && (
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

        {activeTab === 'past' && (
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

      <style jsx>{`
        .student-courses-container {
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Header, tabs and empty state come from styles/ui.css */

        .courses-content {
          margin-top: 2rem;
        }

        .courses-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1.5rem;
        }

        .course-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          padding: 1.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          transition: all 0.3s;
        }

        .course-card:hover {
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }

        .course-header {
          margin-bottom: 1rem;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 0.75rem;
        }

        .course-header h3 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 0.5rem;
        }

        .course-code {
          display: inline-block;
          background: #eff6ff;
          color: #3b82f6;
          padding: 0.25rem 0.75rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .course-details {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .detail-label {
          color: #6b7280;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .detail-value {
          color: #1f2937;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .detail-value.grade {
          background: #dcfce7;
          color: #16a34a;
          padding: 0.25rem 0.75rem;
          border-radius: 0.25rem;
          font-size: 1rem;
        }

        /* Spans the grid; the rest comes from styles/ui.css */
        .empty-state { grid-column: 1 / -1; }
        .empty-state p { margin: 0; }

        @media (max-width: 768px) {
          .student-courses-container {
            padding: 1rem;
          }

          .courses-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
     </Layout>
  );
};

export default StudentCourses;

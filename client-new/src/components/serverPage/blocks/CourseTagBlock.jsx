import React, { useState } from 'react';
import CustomButton from '../../forms/fields/CustomButton';
import { sendRequest } from '../requests';

const EMPTY_TAG = { course_id: '', semester: '', status: 'enrolled', grade: '' };

/**
 * Tags a scholar with a course from their profile: the course, the semester
 * it was taken in, and a grade once it is completed. The courses offered and
 * the request are the view's (props.courses, props.request).
 */
const CourseTagBlock = ({ props, onClose, onChanged }) => {
  const [tag, setTag] = useState(EMPTY_TAG);
  // Held off while the request runs, so a second click cannot send it twice.
  const [tagging, setTagging] = useState(false);

  const send = async () => {
    setTagging(true);
    const tagged = await sendRequest(props.request, null, { ...props.request.body, ...tag }, () => {});
    setTagging(false);
    if (tagged) {
      onClose();
      onChanged();
    }
  };

  return (
    <div>
      <h3 className="modal-title">Tag student with course</h3>
      <div className="field-stack">
        <div>
          <label htmlFor="profile-card-course">Course</label>
          <select id="profile-card-course"
            value={tag.course_id}
            onChange={(e) => setTag({ ...tag, course_id: e.target.value })}
            className="input-field"
          >
            <option value="">Select Course</option>
            {props.courses.map((course) => (
              <option key={course.value} value={course.value}>{course.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="profile-card-semester">Semester</label>
          <input id="profile-card-semester"
            type="text"
            value={tag.semester}
            onChange={(e) => setTag({ ...tag, semester: e.target.value })}
            placeholder="e.g., Fall 2024"
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="profile-card-status">Status</label>
          <select id="profile-card-status"
            value={tag.status}
            onChange={(e) => setTag({ ...tag, status: e.target.value })}
            className="input-field"
          >
            <option value="enrolled">Enrolled</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {tag.status === 'completed' && (
          <div>
            <label htmlFor="profile-card-grade">Grade</label>
            <input id="profile-card-grade"
              type="text"
              value={tag.grade}
              onChange={(e) => setTag({ ...tag, grade: e.target.value })}
              placeholder="e.g., A+"
              className="input-field"
            />
          </div>
        )}

        <div className="modal-actions">
          <CustomButton text="Cancel" variant="quiet" onClick={onClose} />
          <CustomButton text="Tag course" onClick={send} disabled={tagging} />
        </div>
      </div>
    </div>
  );
};

export default CourseTagBlock;

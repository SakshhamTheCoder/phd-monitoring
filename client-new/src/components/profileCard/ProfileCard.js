import React, { useEffect, useState } from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import "react-circular-progressbar/dist/styles.css";
import "./ProfileCard.css";
import { facultyNameCell } from "../facultyLink/FacultyLink";

import { formatDate } from "../../utils/timeParse";
import { baseURL } from "../../api/urls";
import { customFetch } from "../../api/base";
import GridContainer from "../forms/fields/GridContainer";
import TableComponent from "../forms/table/TableComponent";
import CustomButton from "../forms/fields/CustomButton";
import CustomModal from "../forms/modal/CustomModal";
import SupervisorDoctoralManager from "../supervisorDoctoralManager/SupervisorDoctoralManager";
import { toast } from "react-toastify";

const ProfileCard = ({ dataIP = null, link = false }) => {
  const [showEditButton, setShowEditButton] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showSupervisorDoctoralModal, setShowSupervisorDoctoralModal] = useState(false);
  const [courses, setCourses] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [tagData, setTagData] = useState({
    course_id: '',
    semester: '',
    status: 'enrolled',
    grade: ''
  });

  const { state: locationState, pathname } = useLocation();
  const { roll_no } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(locationState || dataIP);
  const [loading, setLoading] = useState(!profile);
const [userRole, setUserRole] = useState('');
  useEffect(() => {
    if (!profile) {
      let url = roll_no
        ? `${baseURL}/students/${roll_no}`
        : `${baseURL}/students`;

      customFetch(url, "GET", {}, true, false).then((data) => {
        if (data?.success) {
          const student = data.response.data[0];
          setProfile(student);
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [roll_no, profile]);
  
  const fetchCourses = async () => {
    const studentId = profile?.database_id || profile?.id;
    if (!studentId) return;
    try {
      let response = await customFetch(`${baseURL}/courses/student/courses/${studentId}`, "GET", {}, false, false);
      response = response.response;
      console.log("Courses response:", response);
      if (response?.success) {
        setCourses(response.data);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };
  
  const fetchAttendance = async () => {
    const roll = profile?.roll_no;
    if (!roll) return;
    try {
      const res = await customFetch(`${baseURL}/clerks/attendance/student/${roll}`, 'GET', {}, false, false);
      if (res?.success) {
        setAttendance(res.response.summary);
        setAttendanceRecords(res.response.records || []);
      } else if (res?.response?.message?.includes?.('permission')) {
        setAttendance(null);
      }
    } catch (e) { /* 403 means viewer lacks permission — hide silently */ }
  };

  useEffect(() => {
    const studentId = profile?.database_id || profile?.id;
    if (studentId) {
      fetchCourses();
    }
    if (profile?.roll_no) fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.database_id, profile?.id, profile?.roll_no]);

  const fetchAllCourses = async () => {
    try {
      const response = await customFetch(`${baseURL}/courses/all`, "GET", {}, false, false);
      if (response?.success) {
        setAllCourses(response.response.data);
      }
    } catch (error) {
      console.error('Error fetching all courses:', error);
    }
  };

  const handleTagCourse = async () => {
    try {
      const studentId = profile.database_id || profile.id;
      const payload = {
        student_id: studentId,
        ...tagData
      };
      const response = await customFetch(`${baseURL}/courses/student/tag`, "POST", payload, false, false);
      if (response?.success) {
        toast.success('Course tagged successfully');
        setIsTagModalOpen(false);
        setTagData({ course_id: '', semester: '', status: 'enrolled', grade: '' });
        fetchCourses();
      } else {
        toast.error(response.message || 'Failed to tag course');
      }
    } catch (error) {
      console.error('Error tagging course:', error);
      toast.error('Failed to tag course');
    }
  };

  useEffect(() => {
    // Set the user role from localStorage
    let userRole1 = localStorage.getItem("userRole");
    console.log("Role in ProfileCard:", userRole1);
    if (userRole1 === "hod" || userRole1 === "admin" || userRole1 === "dordc" || userRole1 === "doctoral") {
      setShowEditButton(true);

    }
    setUserRole(userRole1);
  }, [loading]);
  const navigateToForms = () => {
    navigate(pathname + "/forms");
  };

  const navigateToProgress = () => {
    navigate(pathname + "/presentation");
  };

  const startInlineEdit = () => {
    setEditForm({
      phone: profile?.phone || '',
      address: profile?.address || '',
      fathers_name: profile?.fathers_name || '',
      phd_title: profile?.phd_title || '',
      tentative_broad_area: profile?.tentative_broad_area || '',
      tentative_desc: profile?.tentative_desc || '',
      cgpa: profile?.cgpa || '',
    });
    setIsEditingInline(true);
  };

  const cancelInlineEdit = () => {
    setIsEditingInline(false);
  };

  const handleInlineSave = async () => {
    // The PhD title and tentative fields are frozen once IRB is constituted/locked
    const payload = { ...editForm };
    if (profile?.phd_title_locked) {
      delete payload.phd_title;
      delete payload.tentative_broad_area;
      delete payload.tentative_desc;
    }
    const response = await customFetch(`${baseURL}/students/update-profile`, 'POST', payload);
    if (response?.success) {
      toast.success('Profile updated successfully');
      setProfile((prev) => ({ ...prev, ...payload }));
      setIsEditingInline(false);
    } else {
      toast.error('Failed to update profile');
    }
  };

  if (loading) return <p>Loading...</p>;

  if (profile) {
    const {
      name,
      phd_title,
      overall_progress,
      department,
      supervisors,
      email,
      phone,
      current_status,
      fathers_name,
      address,
      date_of_registration,
      date_of_irb,
      date_of_synopsis,
      cgpa,
      doctoral,
    } = profile;

    const personalInfo = [
      { label: "Roll Number", value: profile.roll_no },
      { label: "Email", value: email },
      { label: "Phone", value: phone, field: "phone" },
      { label: "Department", value: department },
      // { label: 'Supervisors', value: supervisors?.join(', ') },
      { label: "CGPA", value: cgpa, field: "cgpa" },
      { label: "Father's Name", value: fathers_name, field: "fathers_name" },
      { label: "Address", value: address, field: "address" },
      { label: "Current Status", value: current_status },
      { label: "Date of Admission", value: formatDate(date_of_registration) },
      { label: "Date of IRB", value: formatDate(date_of_irb) },
      { label: "Date of Synopsis", value: formatDate(date_of_synopsis) },
      ...(attendance ? [{ label: "Attendance", value: `${attendance.present} present / ${attendance.total} sessions${attendance.percent != null ? ` (${attendance.percent}%)` : ''}` }] : []),
    ];

    const supervisorTableData = (supervisors || []).map((sup, index) => {
      // Support both object and string formats
      if (typeof sup === "string") {
        return {
          name: sup,
          email: "—",
          phone: "—",
          designation: "—",
        };
      }
      return {
        faculty_code: sup.faculty_code,
        name: sup.name || "—",
        email: sup.email || "—",
        phone: sup.phone || "—",
        designation: sup.designation || "—",
      };
    });

    const doctoralTableData = (doctoral || []).map((member) => ({
      faculty_code: member.faculty_code,
      name: member.name || "—",
      email: member.email || "—",
      phone: member.phone || "—",
      designation: member.designation || "—",
    }));

    return (
      <>
        <div className="student-container">
          <div className="student-header">
            <div className="student-header-text">
              <h2>{name}</h2>
              {isEditingInline ? (
                <div className="student-sub-edit">
                  <input
                    className="profile-inline-input"
                    type="text"
                    placeholder="Ph.D. Title"
                    value={editForm.phd_title ?? ""}
                    disabled={profile.phd_title_locked}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, phd_title: e.target.value }))
                    }
                  />
                  {profile.phd_title_locked && (
                    <small className="profile-lock-note">
                      Locked — IRB constitution form already submitted.
                    </small>
                  )}
                </div>
              ) : (
                <p className="student-sub">
                  {phd_title || "Ph.D. Title Not Available"}
                </p>
              )}
              {isEditingInline && profile.is_supervisor_allocated && (
                <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', maxWidth: '520px' }}>
                  <input
                    className="profile-inline-input"
                    type="text"
                    placeholder="Domain / Broad Area (e.g., AI, CyberSecurity)"
                    value={editForm.tentative_broad_area ?? ""}
                    disabled={profile.phd_title_locked}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, tentative_broad_area: e.target.value }))
                    }
                  />
                  <textarea
                    className="profile-inline-input"
                    placeholder="Brief description of proposed work"
                    value={editForm.tentative_desc ?? ""}
                    disabled={profile.phd_title_locked}
                    maxLength={5000}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, tentative_desc: e.target.value }))
                    }
                    style={{ minHeight: '60px' }}
                  />
                  <small style={{ alignSelf: 'flex-end', fontSize: '0.72rem', color: '#6b7280' }}>
                    {(editForm.tentative_desc || "").length}/5000
                  </small>
                </div>
              )}
              {/* Tentative domain/brief — compact, same line style as title */}
              {profile.is_supervisor_allocated && !isEditingInline && (
                <div style={{ marginTop: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <span>Domain: {profile.tentative_broad_area || '—'}</span>
                  {profile.tentative_desc && <span> · {profile.tentative_desc}</span>}
                  {profile.phd_title_locked && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#9f1239' }}>Locked — IRB constituted</span>}
                </div>
              )}
              {profile.is_supervisor_allocated && userRole === 'student' && profile.can_edit_tentative && !profile.tentative_broad_area && !profile.tentative_desc && !isEditingInline && (
                <div style={{ marginTop: '0.4rem', background: '#fffbeb', border: '1px solid #fcd34d', padding: '0.3rem 0.6rem', borderRadius: '0.4rem', fontSize: '0.78rem', color: '#92400e', maxWidth: '520px' }}>
                  Add your tentative domain and brief description before IRB.
                  <button onClick={startInlineEdit} style={{ fontWeight: 600, background: 'none', border: 'none', color: '#92400e', cursor: 'pointer', textDecoration: 'underline', marginLeft: '0.3rem' }}>Add now</button>
                </div>
              )}
            </div>
            <div className="student-progress">
              <CircularProgressbar
                value={overall_progress}
                text={`${overall_progress}%`}
                styles={buildStyles({
                  textColor: "#111827",
                  pathColor: "var(--primary-color)",
                  trailColor: "#e5e7eb",
                })}
              />
              <span className="progress-label">Progress</span>
            </div>
          </div>
          
          <div className="student-info-grid">
            {personalInfo.map((item, idx) => (
              <div key={idx}>
                <strong>{item.label}:</strong>{" "}
                {isEditingInline && item.field ? (
                  <input
                    className="profile-inline-input"
                    type="text"
                    value={editForm[item.field] ?? ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, [item.field]: e.target.value }))
                    }
                  />
                ) : (
                  item.value || "—"
                )}
              </div>
            ))}
          </div>



          {/* <div className='student-table-section'>
        <h3>Overall Progress</h3>
        <div style={{ maxWidth: '100px', marginTop: '1rem' }}>
          <CircularProgressbar
            value={overall_progress}
            text={`${overall_progress}%`}
            styles={buildStyles({
              textColor: '#111827',
              pathColor: 'var(--primary-color)',
              trailColor: '#e5e7eb',
            })}
          />
        </div>
      </div> */}
          <div className="profile-actions">
            {userRole !== "student" &&(<>
            <CustomButton text="View Forms" onClick={navigateToForms} />
            <CustomButton
              text="View Progress Monitoring"
              onClick={navigateToProgress}
              disabled={true}
            />
            </>)}
            {userRole === "student" && !isEditingInline && (
              <button className="profile-edit-small" onClick={startInlineEdit}>
                <i className="fa fa-pencil" aria-hidden="true"></i> Edit
              </button>
            )}
            {userRole === "student" && isEditingInline && (
              <>
                <CustomButton text="Save" onClick={handleInlineSave} />
                <CustomButton text="Cancel" onClick={cancelInlineEdit} variant="secondary" />
              </>
            )}
            {showEditButton && (
              <>
                <CustomButton text="Tag Course" onClick={() => {
                  fetchAllCourses();
                  setIsTagModalOpen(true);
                }} />
                <CustomButton text="Manage Supervisors/Doctoral" onClick={() => setShowSupervisorDoctoralModal(true)} />
              </>
            )}
          </div>
          
        

          <GridContainer
            label="Supervisors"
            elements={[
              <TableComponent
                data={supervisorTableData}
                keys={["name", "email", "phone", "designation"]}
                titles={["Name", "Email", "Phone", "Designation"]}
                components={[facultyNameCell]}
              />,
            ]}
            space={3}
          />

          <GridContainer
            label="Doctoral Committee"
            elements={[
              <TableComponent
                data={doctoralTableData}
                keys={["name", "email", "phone", "designation"]}
                titles={["Name", "Email", "Phone", "Designation"]}
                components={[facultyNameCell]}
              />,
            ]}
            space={3}
          />

            <GridContainer
            label="Enrolled Courses"
            elements={[
              <TableComponent
                data={courses?.filter(c => c.status === 'enrolled')}
                keys={["course_code", "course_name", "credits", "semester"]}
                titles={["Course Code", "Course Name", "Credits", "Semester"]}
              />,
            ]}
            space={3}
          />

          <GridContainer
            label="Completed Courses"
            elements={[
              <TableComponent
                data={courses?.filter(c => c.status === 'completed')}
                keys={["course_code", "course_name", "credits", "semester", "grade"]}
                titles={["Course Code", "Course Name", "Credits", "Semester", "Grade"]}
              />,
            ]}
            space={3}
          />

          {/* Attendance — visible only if viewer can view student (API enforces same as StudentController::get) */}

        </div>
        {
          <CustomModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            children={[
              <>
                <p>Edit the student Commitee/supervisors</p>
                <GridContainer
                  label="Doctoral Committee"
                  elements={[
                    <TableComponent
                      data={doctoral}
                      keys={[
                        "name",
                        "email",
                        "phone",
                        "designation",
                        "actions",
                      ]}
                      titles={[
                        "Name",
                        "Email",
                        "Phone",
                        "Designation",
                        "Actions",
                      ]}
                      components={[
                        facultyNameCell,
                        {
                          key: "actions",
                          component: ({ row }) => (
                            <GridContainer
                              space={1}
                              elements={[
                                <CustomButton text="Edit" />,
                                <CustomButton text="Delete" variant="danger" />,
                              ]}
                            />
                          ),
                        },
                      ]}
                    />,
                  ]}
                  space={3}
                />
                <GridContainer
                  label="Supervisors"
                  elements={[
                    <TableComponent
                      data={supervisorTableData}
                      keys={[
                        "name",
                        "email",
                        "phone",
                        "designation",
                        "actions",
                      ]}
                      titles={[
                        "Name",
                        "Email",
                        "Phone",
                        "Designation",
                        "Actions",
                      ]}
                      components={[
                        facultyNameCell,
                        {
                          key: "actions",
                          component: ({ row }) => (
                            <GridContainer
                              space={1}
                              elements={[
                                <CustomButton text="Edit" onClick={() => toast.warn("Disabled by admin")} />,
                                <CustomButton text="Delete" variant="danger" onClick={()=>{toast.info("Disabled by Admin")}}/>,
                              ]}
                            />
                          ),
                        },
                      ]}
                    />,
                  ]}
                  space={3}
                />
              </>,
            ]}
          />
        }
        
        {/* Tag Course Modal */}
        <CustomModal
          isOpen={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
        >
          <div>
            <h3>Tag Student with Course</h3>
            <div className="field-stack">
              <div>
                <label>Course</label>
                <select
                  value={tagData.course_id}
                  onChange={(e) => setTagData({ ...tagData, course_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select Course</option>
                  {allCourses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.course_code} - {course.course_name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label>Semester</label>
                <input
                  type="text"
                  value={tagData.semester}
                  onChange={(e) => setTagData({ ...tagData, semester: e.target.value })}
                  placeholder="e.g., Fall 2024"
                  className="input-field"
                />
              </div>
              
              <div>
                <label>Status</label>
                <select
                  value={tagData.status}
                  onChange={(e) => setTagData({ ...tagData, status: e.target.value })}
                  className="input-field"
                >
                  <option value="enrolled">Enrolled</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              
              {tagData.status === 'completed' && (
                <div>
                  <label>Grade</label>
                  <input
                    type="text"
                    value={tagData.grade}
                    onChange={(e) => setTagData({ ...tagData, grade: e.target.value })}
                    placeholder="e.g., A+"
                  className="input-field"
                  />
                </div>
              )}
              
              <div className="modal-actions">
                <CustomButton text="Cancel" onClick={() => setIsTagModalOpen(false)} />
                <CustomButton text="Tag Course" onClick={handleTagCourse} />
              </div>
            </div>
          </div>
        </CustomModal>

        {/* Supervisor/Doctoral Committee Management Modal */}
        {showSupervisorDoctoralModal && (
          <CustomModal
            isOpen={showSupervisorDoctoralModal}
            onClose={() => setShowSupervisorDoctoralModal(false)}
          >
            <SupervisorDoctoralManager
              studentId={profile.roll_no}
              supervisors={supervisors || []}
              doctoralCommittee={doctoral || []}
              onClose={() => {
                setShowSupervisorDoctoralModal(false);
                // Refresh profile data to show updated supervisors/doctoral
                const url = roll_no
                  ? `${baseURL}/students/${roll_no}`
                  : `${baseURL}/students`;
                customFetch(url, "GET", {}, true, false).then((data) => {
                  if (data?.success) {
                    const student = data.response.data[0];
                    setProfile(student);
                  }
                });
              }}
            />
          </CustomModal>
        )}

      </>
    );
  } else {
    return <p>Profile data not available.</p>;
  }
};

export default ProfileCard;

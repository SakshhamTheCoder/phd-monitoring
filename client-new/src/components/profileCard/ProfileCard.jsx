import React, { useEffect, useState } from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import "react-circular-progressbar/dist/styles.css";
import ProgressChart from "./ProgressChart";
import ShowPublications from "../publications/ShowPublications";
import "./ProfileCard.css";
import { facultyNameCell } from "../facultyLink/FacultyLink";
import { ACCESS } from "../../auth/access";

import { EMPTY_VALUE, formatDate } from '../../utils/timeParse';
import { baseURL } from "../../api/urls";
import { customFetch } from "../../api/base";
import GridContainer from "../forms/fields/GridContainer";
import TableComponent from "../forms/table/TableComponent";
import CustomButton from "../forms/fields/CustomButton";
import CustomModal from "../forms/modal/CustomModal";
import SupervisorDoctoralManager from "../supervisorDoctoralManager/SupervisorDoctoralManager";
import InfoGrid from "../profileFields/InfoGrid";
import { toast } from "react-toastify";
import useCapabilities from "../../context/CapabilitiesContext";

/**
 * What the deadline means today. The server owns the dates and the count, so
 * this only phrases them.
 */
const deadlineNote = ({ days_remaining: daysLeft, extensions_granted: granted }) => {
  const extended = granted > 0 ? `, ${granted} extension${granted > 1 ? 's' : ''} granted` : '';
  if (daysLeft < 0) return `(overdue by ${Math.abs(daysLeft)} days${extended})`;
  return `(${daysLeft} days left${extended})`;
};

// Yes, No, or a dash for "nobody has said", which is a different answer from No.
const statedYesNo = (value) =>
  (value === null || value === undefined ? EMPTY_VALUE : (value ? 'Yes' : 'No'));

const ProfileCard = ({ dataIP = null, link = false }) => {
  const can = useCapabilities();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showSupervisorDoctoralModal, setShowSupervisorDoctoralModal] = useState(false);
  const [courses, setCourses] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [progressHistory, setProgressHistory] = useState(null);
  const [publications, setPublications] = useState(null);
  const [tagData, setTagData] = useState({
    course_id: '',
    semester: '',
    status: 'enrolled',
    grade: ''
  });

  const { state: locationState, pathname } = useLocation();
  const { roll_no } = useParams();
  const navigate = useNavigate();
  // The same list the route table and the sidebar read, so the button appears
  // exactly for the roles that have the attendance tab to land on.
  const readsAttendancePage = ACCESS.attendance.includes(localStorage.getItem('userRole'));

  const [profile, setProfile] = useState(locationState || dataIP);
  const [loading, setLoading] = useState(!profile);
  // What this viewer may do with this profile is the server's answer, not a
  // guess from the role in local storage.
  const [permissions, setPermissions] = useState({ is_self: false, can_edit: false, can_manage: false });

  const profileUrl = roll_no ? `${baseURL}/students/${roll_no}` : `${baseURL}/students/me`;

  useEffect(() => {
    customFetch(profileUrl, "GET", {}, true, false).then((res) => {
      if (res?.success) {
        setPermissions({
          is_self: !!res.response.is_self,
          can_edit: !!res.response.can_edit,
          can_manage: !!res.response.can_manage,
        });
        // A profile handed in by the caller is already on screen; only the
        // permissions still have to be fetched.
        if (!locationState && !dataIP) setProfile(res.response.profile);
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileUrl]);
  
  const fetchCourses = async () => {
    const studentId = profile?.database_id || profile?.id;
    if (!studentId) return;
    try {
      let response = await customFetch(`${baseURL}/courses/student/courses/${studentId}`, "GET", {}, false, false);
      response = response.response;
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
      const res = await customFetch(
        `${baseURL}/clerks/attendance/student/${roll}`,
        'GET', {}, false, false
      );
      if (res?.success) {
        setAttendance({ ...res.response.summary, currentMonth: res.response.current_month });
      } else if (res?.response?.message?.includes?.('permission')) {
        setAttendance(null);
      }
    } catch (e) { /* 403 means viewer lacks permission — hide silently */ }
  };

  /**
   * Something hung off the scholar, on the same gate as the profile itself.
   *
   * Their own calls rather than fields on the profile: keeping them out of that
   * payload keeps a query off every row of the form lists, which build the same
   * profile shape. A 403 means the viewer may not read this scholar, and the
   * section simply does not appear.
   */
  const fetchScholarSection = async (path, set) => {
    const roll = profile?.roll_no;
    if (!roll) return;
    try {
      const res = await customFetch(`${baseURL}/students/${roll}/${path}`, 'GET', {}, false, false);
      if (res?.success) set(res.response);
    } catch (e) { /* hidden rather than reported: the viewer may not read this */ }
  };

  useEffect(() => {
    const studentId = profile?.database_id || profile?.id;
    if (studentId) {
      fetchCourses();
    }
    fetchAttendance();
    fetchScholarSection('progress-history', setProgressHistory);
    fetchScholarSection('publications', setPublications);
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

  const navigateToForms = () => {
    navigate(pathname + "/forms");
  };

  const navigateToProgress = () => {
    navigate(pathname + "/forms/presentation");
  };

  const startInlineEdit = () => {
    setEditForm({
      phone: profile?.phone || '',
      address: profile?.address || '',
      fathers_name: profile?.fathers_name || '',
      phd_title: profile?.phd_title || '',
      tentative_desc: profile?.tentative_desc || '',
      strengths: profile?.strengths || '',
      help_needed: profile?.help_needed || '',
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
      delete payload.tentative_desc;
    }
    const response = await customFetch(`${baseURL}/students/${profile.roll_no}/profile`, 'POST', payload);
    if (response?.success) {
      toast.success('Profile updated successfully');
      // The server answers with what it actually saved. Merging the payload
      // instead would leave a refused field, a locked title among them, showing
      // on screen until the next reload.
      setProfile(response.response.profile);
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
      date_of_thesis,
      cgpa,
      doctoral,
    } = profile;

    // No presentation has been completed yet, which is 0% of the way through,
    // not a missing figure. Without this the ring printed "null%".
    const progressPercent = Number(overall_progress) || 0;

    // Tentative until the IRB is actually approved. The backend decides; the
    // profile only reports, so no screen can disagree with another about it.
    const titleLabel = profile.irb_completed ? 'PhD Title' : 'Tentative PhD Title';

    const personalInfo = [
      { label: "Roll Number", value: profile.roll_no },
      { label: "Email", value: email },
      { label: "Phone", value: phone, field: "phone" },
      { label: "Department", value: department },
      // { label: 'Supervisors', value: supervisors?.join(', ') },
      { label: "CGPA", value: cgpa, field: "cgpa" },
      // What the synopsis waits on. The required figure is per status and set by
      // an admin, so it is read from the server rather than assumed here.
      ...(profile.required_credits === undefined ? [] : [{
        label: "Coursework",
        node: (
          <span>
            {profile.completed_credits ?? 0} of {profile.required_credits} credits
            {/* No note about the synopsis while the gate on it is commented
                out in SynopsisSubmissionController: saying it opens once this
                is met would not be true today. The figures still report. */}
          </span>
        ),
      }]),
      { label: "Father's Name", value: fathers_name, field: "fathers_name" },
      { label: "Address", value: address, field: "address" },
      { label: "Current Status", value: current_status },
      // Read-only here: it moves the thesis deadline, so only the roles that
      // may edit a student record can set it.
      { label: "Physically Handicapped", value: profile.physically_handicapped ? "Yes" : "No" },
      // Read-only here too: it says where the scholar's stipend comes from.
      // Null means nobody has stated it, which is not the same as No.
      { label: "JRF", value: statedYesNo(profile.is_jrf) },
      { label: "NET/GATE", value: statedYesNo(profile.is_net_gate_qualified) },
      { label: "Date of Admission", value: formatDate(date_of_registration) },
      { label: "Date of IRB", value: formatDate(date_of_irb) },
      { label: "Date of Synopsis", value: formatDate(date_of_synopsis) },
      { label: "Date of Thesis", value: formatDate(date_of_thesis) },
      // The award is a later and separate event from the submission.
      { label: "Date of Thesis Awarded", value: formatDate(profile.date_of_thesis_awarded) },
      ...(profile.thesis_window ? [{
        label: "Thesis Deadline",
        node: (
          <span className={profile.thesis_window.days_remaining <= 30 ? "profile-deadline-due" : undefined}>
            {formatDate(profile.thesis_window.latest)}
            {" "}
            <span className="profile-deadline-note">{deadlineNote(profile.thesis_window)}</span>
          </span>
        ),
      }] : []),
      ...(attendance ? [{
        label: 'Attendance',
        span: 'all',
        node: (
          <span className="profile-attendance-row">
            <span className="profile-attendance" tabIndex={0}>
              <span className="profile-attendance-value">
                {attendance.total > 0
                  ? `${attendance.present}/${attendance.total} (${attendance.percent}%)`
                  : EMPTY_VALUE}
              </span>
              <span className="profile-attendance-pop" role="tooltip">
                <strong>{attendance.currentMonth?.label || 'Current Month'} Attendance</strong>
                {attendance.currentMonth && attendance.currentMonth.total > 0 ? (
                  <>
                    <span>{attendance.currentMonth.present} Present / {attendance.currentMonth.total} Sessions</span>
                    <span>{attendance.currentMonth.percent}%</span>
                  </>
                ) : (
                  <span>No sessions recorded this month.</span>
                )}
              </span>
            </span>

            {/* A date range belongs on the attendance page, which already has
                one and the register behind it. This is the summary, and a way
                through to the page for whoever has it. */}
            {readsAttendancePage && (
              <button type="button" className="profile-edit-small" onClick={() => navigate('/attendance')}>
                <i className="fa fa-calendar" aria-hidden="true"></i> View attendance
              </button>
            )}
          </span>
        ),
      }] : []),
    ];

    const supervisorTableData = (supervisors || []).map((sup, index) => {
      // Support both object and string formats
      if (typeof sup === "string") {
        return {
          name: sup,
          email: EMPTY_VALUE,
          phone: EMPTY_VALUE,
          designation: EMPTY_VALUE,
        };
      }
      return {
        faculty_code: sup.faculty_code,
        name: sup.name || EMPTY_VALUE,
        email: sup.email || EMPTY_VALUE,
        phone: sup.phone || EMPTY_VALUE,
        designation: sup.designation || EMPTY_VALUE,
      };
    });

    const doctoralTableData = (doctoral || []).map((member) => ({
      faculty_code: member.faculty_code,
      name: member.name || EMPTY_VALUE,
      email: member.email || EMPTY_VALUE,
      phone: member.phone || EMPTY_VALUE,
      designation: member.designation || EMPTY_VALUE,
    }));

    return (
      <>
        <div className="student-container">
          <div className="student-header">
            <div className="student-header-text">
              <h2>{name}</h2>
              {!isEditingInline && (
                <div className="student-research">
                  <p className="student-research-title">
                    <span className="student-research-label">{titleLabel}:</span>{" "}
                    <span className={phd_title ? "" : "student-value-empty"}>
                      {phd_title || EMPTY_VALUE}
                    </span>
                  </p>
                  <p>
                    <span className="student-research-label">Domain:</span>{" "}
                    <span className={profile.broad_area ? "" : "student-value-empty"}>
                      {profile.broad_area || EMPTY_VALUE}
                    </span>
                  </p>
                  <p>
                    <span className="student-research-label">Description:</span>{" "}
                    <span className={profile.tentative_desc ? "" : "student-value-empty"}>
                      {profile.tentative_desc || EMPTY_VALUE}
                    </span>
                  </p>
                  {profile.phd_title_locked && (
                    <p className="student-sub-meta-locked">Locked, IRB constituted</p>
                  )}
                </div>
              )}
              {isEditingInline && (
                <div className="student-sub-edit">
                  <div className="inline-field-item">
                    <label>{titleLabel}</label>
                    <input
                      type="text"
                      placeholder="Enter your Ph.D. title"
                      value={editForm.phd_title ?? ""}
                      disabled={profile.phd_title_locked}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, phd_title: e.target.value }))
                      }
                    />
                    {profile.phd_title_locked && (
                      <small className="profile-lock-note">
                        Locked. IRB constitution form already submitted.
                      </small>
                    )}
                  </div>
                  {/* The domain is not typed here any more. It is chosen from
                      the department's list on the supervisor allocation form and
                      settled on the IRB form, so this reports it. */}
                  <div className="inline-field-item" style={{ marginTop: '0.6rem' }}>
                    <label htmlFor="profile-card-domain">Domain</label>
                    <p className={profile.broad_area ? "" : "student-value-empty"}>
                      {profile.broad_area || 'Set on your supervisor allocation form'}
                    </p>
                  </div>
                  <div className="inline-field-item" style={{ marginTop: '0.6rem' }}>
                    <label htmlFor="profile-card-description">Description</label>
                    <textarea id="profile-card-description" id="profile-card-domain"
                      placeholder="Briefly describe your proposed research topic, objectives and methodology"
                      value={editForm.tentative_desc ?? ""}
                      disabled={profile.phd_title_locked}
                      maxLength={5000}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, tentative_desc: e.target.value }))
                      }
                    />
                    <div className="inline-char-count">
                      {(editForm.tentative_desc || "").length} / 5000
                    </div>
                  </div>
                </div>
              )}
            </div>
            {permissions.can_edit && permissions.is_self && (
              <div className="profile-actions">
                {!isEditingInline && (
                  <button className="profile-edit-small" onClick={startInlineEdit}>
                    <i className="fa fa-pencil" aria-hidden="true"></i> Edit
                  </button>
                )}
                {isEditingInline && (
                  <>
                    <CustomButton text="Save" onClick={handleInlineSave} />
                    <CustomButton text="Cancel" variant="secondary" onClick={cancelInlineEdit} />
                  </>
                )}
              </div>
            )}

            <div className="student-progress">
              <CircularProgressbar
                value={progressPercent}
                text={`${progressPercent}%`}
                styles={buildStyles({
                  textColor: "#111827",
                  pathColor: "var(--primary-color)",
                  trailColor: "#e5e7eb",
                })}
              />
              <span className="progress-label">Progress</span>
            </div>
          </div>

          <div className="student-details">
            <InfoGrid
              className="student-info-grid"
              rows={personalInfo}
              editing={isEditingInline}
              values={editForm}
              onChange={(field, value) => setEditForm((prev) => ({ ...prev, [field]: value }))}
            />
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
          {/* Page actions, not profile editing. Rendered only when there is
              something in them, or the row is 3rem of empty margin. */}
          {(!permissions.is_self || permissions.can_manage) && (
            <div className="profile-actions">
              {!permissions.is_self && (<>
                <CustomButton text="View Forms" onClick={navigateToForms} />
                <CustomButton
                  text="View Progress Monitoring"
                  onClick={navigateToProgress}
                />
              </>)}
              {permissions.can_manage && (
                <CustomButton text="Tag Course" onClick={() => {
                  fetchAllCourses();
                  setIsTagModalOpen(true);
                }} />
              )}
              {/* The request is refused without this capability, so DRA, Director
                  and ADoRDC, who can manage the record, were offered a form the
                  server turns down. */}
              {can("can_propose_supervisor_changes") && (
                <CustomButton text="Manage Supervisors/Doctoral" onClick={() => setShowSupervisorDoctoralModal(true)} />
              )}
            </div>
          )}
          
        

          {/* The scholar's own account of themselves. Read by everyone who may
              read the profile, which is the point of asking: it is how they say
              what they need. Written only by them, or by a role that may edit
              their record, which is the gate the rest of this card already uses.

              Shares the header's edit mode rather than having one of its own, so
              there is one Edit button on the page and one save. */}
          {publications && (
            <GridContainer
              elements={[
                // Read-only here. The scholar adds and edits on their own
                // publications page, which is the one place that writes them.
                <ShowPublications
                  formData={publications}
                  enableEdit={false}
                  enableDelete={false}
                  canAdd={false}
                  collapsible
                />,
              ]}
              space={3}
            />
          )}

          {progressHistory && (
            <GridContainer
              label="Progress over time"
              elements={[
                <ProgressChart
                  points={progressHistory.points}
                  milestones={progressHistory.milestones}
                />,
              ]}
              space={3}
            />
          )}

          <GridContainer
            label="About the scholar"
            elements={[
              isEditingInline ? (
                <div className="inline-field-item">
                  <label htmlFor="profile-strengths">Strengths</label>
                  <textarea
                    id="profile-strengths"
                    placeholder="What you are good at, and what you have got better at so far"
                    value={editForm.strengths ?? ""}
                    maxLength={5000}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, strengths: e.target.value }))}
                  />
                  <div className="inline-char-count">{(editForm.strengths || "").length} / 5000</div>
                </div>
              ) : (
                <div>
                  <p className="student-research-label">Strengths</p>
                  <p className={profile.strengths ? "" : "student-value-empty"}>
                    {profile.strengths || (permissions.is_self ? "Not filled in yet. Edit your profile to add it." : EMPTY_VALUE)}
                  </p>
                </div>
              ),
              isEditingInline ? (
                <div className="inline-field-item">
                  <label htmlFor="profile-help-needed">Help needed</label>
                  <textarea
                    id="profile-help-needed"
                    placeholder="Where you are stuck, and what would help: training, equipment, a collaborator, time"
                    value={editForm.help_needed ?? ""}
                    maxLength={5000}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, help_needed: e.target.value }))}
                  />
                  <div className="inline-char-count">{(editForm.help_needed || "").length} / 5000</div>
                </div>
              ) : (
                <div>
                  <p className="student-research-label">Help needed</p>
                  <p className={profile.help_needed ? "" : "student-value-empty"}>
                    {profile.help_needed || (permissions.is_self ? "Not filled in yet. Edit your profile to add it." : EMPTY_VALUE)}
                  </p>
                </div>
              ),
            ]}
            space={2}
          />

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
                <p>Edit the student Committee/supervisors</p>
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
                <label htmlFor="profile-card-course">Course</label>
                <select id="profile-card-course"
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
                <label htmlFor="profile-card-semester">Semester</label>
                <input id="profile-card-semester"
                  type="text"
                  value={tagData.semester}
                  onChange={(e) => setTagData({ ...tagData, semester: e.target.value })}
                  placeholder="e.g., Fall 2024"
                  className="input-field"
                />
              </div>
              
              <div>
                <label htmlFor="profile-card-status">Status</label>
                <select id="profile-card-status"
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
                  <label htmlFor="profile-card-grade">Grade</label>
                  <input id="profile-card-grade"
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
                customFetch(profileUrl, "GET", {}, true, false).then((res) => {
                  if (res?.success) setProfile(res.response.profile);
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

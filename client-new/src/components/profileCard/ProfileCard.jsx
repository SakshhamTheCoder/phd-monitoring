import React, { useEffect, useState } from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import "react-circular-progressbar/dist/styles.css";
import ShowPublications from "../publications/ShowPublications";
import "./ProfileCard.css";
import { facultyNameCell } from "../facultyLink/FacultyLink";
import { currentRole } from "../../auth/access";
import { useAccess } from "../../context/CapabilitiesContext";

import { EMPTY_VALUE, formatDate } from '../../utils/timeParse';
import { baseURL } from "../../api/urls";
import { customFetch } from "../../api/base";
import GridContainer from "../forms/fields/GridContainer";
import TableComponent from "../forms/table/TableComponent";
import CustomButton from "../forms/fields/CustomButton";
import LoadError from "../common/LoadError";
import StatusNotice from "../common/StatusNotice";
import Page from "../page/Page";
import Panel, { PanelSection } from "../panel/Panel";
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
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [editForm, setEditForm] = useState({});
  // Save and Tag Course stay disabled while their request runs, so a second
  // click cannot send it twice.
  const [savingProfile, setSavingProfile] = useState(false);
  const [taggingCourse, setTaggingCourse] = useState(false);
  const [showSupervisorDoctoralModal, setShowSupervisorDoctoralModal] = useState(false);
  const [courses, setCourses] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [attendance, setAttendance] = useState(null);
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
  // The roles with an attendance tab to land on. /attendance dispatches by
  // role, and the HOD's is the leave requests they approve rather than a
  // register, so the button says what it opens for them. Plenty of other roles
  // read the figure below with no page at all behind it, which is why this is
  // narrower than "may read attendance".
  const role = currentRole();
  const { may } = useAccess();
  const opensAttendancePage = may('attendance');
  const attendanceLinkText = role === 'hod' ? 'Leave requests' : 'View attendance';

  const [profile, setProfile] = useState(locationState || dataIP);
  const [loading, setLoading] = useState(!profile);
  // What this viewer may do with this profile is the server's answer, not a
  // guess from the role in local storage.
  const [permissions, setPermissions] = useState({ is_self: false, can_edit: false, can_manage: false, can_tag_courses: false });

  const profileUrl = roll_no ? `${baseURL}/students/${roll_no}` : `${baseURL}/students/me`;

  const loadProfile = () => {
    customFetch(profileUrl, "GET", {}, true, false).then((res) => {
      if (res?.success) {
        setPermissions({
          is_self: !!res.response.is_self,
          can_edit: !!res.response.can_edit,
          can_manage: !!res.response.can_manage,
          can_tag_courses: !!res.response.can_tag_courses,
        });
        // A profile handed in by the caller is already on screen; only the
        // permissions still have to be fetched.
        if (!locationState && !dataIP) setProfile(res.response.profile);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    loadProfile();
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
  
  // The route already names the scholar, so these two need not wait for the
  // profile. Only /students/me has to learn the roll number from it.
  const scholarRoll = roll_no || profile?.roll_no;

  const fetchAttendance = async () => {
    const roll = scholarRoll;
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
    const roll = scholarRoll;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.database_id, profile?.id]);

  useEffect(() => {
    fetchAttendance();
    fetchScholarSection('publications', setPublications);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scholarRoll]);

  // The course list does not change while the profile is open, so Tag Course
  // loads it once rather than on every click.
  const fetchAllCourses = async () => {
    if (allCourses.length) return;
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
    setTaggingCourse(true);
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
        toast.error(response?.response?.message || 'Failed to tag course');
      }
    } catch (error) {
      console.error('Error tagging course:', error);
      toast.error('Failed to tag course');
    } finally {
      setTaggingCourse(false);
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
    // Compared the way startInlineEdit filled the form, so opening and
    // cancelling without typing does not ask.
    const changed = Object.keys(editForm).some((key) => editForm[key] !== (profile?.[key] || ''));
    if (changed && !window.confirm('Discard your unsaved changes to this profile?')) return;
    setIsEditingInline(false);
  };

  const handleInlineSave = async () => {
    // The PhD title and tentative fields are frozen once IRB is constituted/locked
    const payload = { ...editForm };
    if (profile?.phd_title_locked) {
      delete payload.phd_title;
      delete payload.tentative_desc;
    }
    setSavingProfile(true);
    const response = await customFetch(`${baseURL}/students/${profile.roll_no}/profile`, 'POST', payload);
    setSavingProfile(false);
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

  if (loading) {
    return (
      <Page>
        <Panel><StatusNotice tone="loading" title="Loading profile" /></Panel>
      </Page>
    );
  }

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
      { label: "NET/GATE", value: profile.net_gate || EMPTY_VALUE },
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
                <strong>{attendance.currentMonth?.label || 'Current month'} attendance</strong>
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
            {opensAttendancePage && (
              <button type="button" className="profile-edit-small" onClick={() => navigate(`/attendance?roll_no=${profile.roll_no}`)}>
                <i className="fa fa-calendar" aria-hidden="true"></i> {attendanceLinkText}
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

    // A course tagged by mistake can be taken off again by whoever may tag one:
    // those who manage students, and a HOD or coordinator for their own
    // department. The server says who, and holds each to their scope.
    const mayRemoveCourses = permissions.can_tag_courses;
    const removeCourse = async (course) => {
      if (!window.confirm(`Remove ${course.course_code} from this scholar's courses?`)) return;
      const response = await customFetch(`${baseURL}/courses/student/remove/${course.id}`, "DELETE");
      if (response.success) {
        toast.success("Course removed.");
        fetchCourses();
      }
    };
    const courseActionKey = mayRemoveCourses ? ["remove"] : [];
    const courseActionTitle = mayRemoveCourses ? ["Actions"] : [];
    const courseActionCell = mayRemoveCourses ? [{
      key: "remove",
      component: ({ row }) => (
        <CustomButton text="Remove" variant="danger-outline" size="sm" onClick={() => removeCourse(row)} />
      ),
    }] : [];

    // Page actions first, then the profile's own edit controls. One filled
    // button: View forms for someone reading another scholar's profile, Save
    // while editing, when View forms steps back to secondary.
    const pageActions = (
      <>
        {!permissions.is_self && (<>
          <CustomButton text="View forms" variant={isEditingInline ? "secondary" : undefined} onClick={navigateToForms} />
          <CustomButton
            text="View progress monitoring"
            variant="secondary"
            onClick={navigateToProgress}
          />
        </>)}
        {permissions.can_tag_courses && (
          <CustomButton text="Tag course" variant="secondary" onClick={() => {
            fetchAllCourses();
            setIsTagModalOpen(true);
          }} />
        )}
        {/* The request is refused without this capability, so DRA, Director
            and ADoRDC, who can manage the record, were offered a form the
            server turns down. */}
        {can("can_propose_supervisor_changes") && (
          <CustomButton text="Manage supervisors/doctoral" variant="secondary" onClick={() => setShowSupervisorDoctoralModal(true)} />
        )}
        {/* The same form admin page the Students list opens, on this scholar. */}
        {may('admin') && !permissions.is_self && (
          <CustomButton text="Manage forms" variant="secondary" onClick={() => navigate(`/forms/manage?roll_no=${profile.roll_no}`)} />
        )}
        {/* can_edit covers a scholar's own profile and those who manage
            scholars, as the save endpoint does. */}
        {permissions.can_edit && (
          isEditingInline ? (
            <>
              <CustomButton text="Save" onClick={handleInlineSave} disabled={savingProfile} />
              <CustomButton text="Cancel" variant="quiet" onClick={cancelInlineEdit} />
            </>
          ) : (
            <CustomButton text="Edit" variant="secondary" onClick={startInlineEdit} />
          )
        )}
      </>
    );

    return (
      <>
        <Page title={name} actions={pageActions}>
          <Panel>
            <PanelSection>
              <div className="student-overview">
                <div className="student-overview-text">
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
                        <label htmlFor="profile-card-title">{titleLabel}</label>
                        <input id="profile-card-title"
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
                      <div className="inline-field-item">
                        <label>Domain</label>
                        <p className={profile.broad_area ? "" : "student-value-empty"}>
                          {profile.broad_area || 'Set on your supervisor allocation form'}
                        </p>
                      </div>
                      <div className="inline-field-item">
                        <label htmlFor="profile-card-description">Description</label>
                        <textarea id="profile-card-description"
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

                <div className="student-progress">
                  <CircularProgressbar
                    value={progressPercent}
                    text={`${progressPercent}%`}
                    styles={buildStyles({
                      textColor: "var(--text-color)",
                      pathColor: "var(--primary-color)",
                      trailColor: "var(--border-subtle)",
                    })}
                  />
                  <span className="progress-label">Progress</span>
                </div>
              </div>
            </PanelSection>

            <PanelSection>
              <InfoGrid
                rows={personalInfo}
                editing={isEditingInline}
                values={editForm}
                onChange={(field, value) => setEditForm((prev) => ({ ...prev, [field]: value }))}
              />
            </PanelSection>
          </Panel>

          {/* The scholar's own account of themselves. Read by everyone who may
              read the profile, which is the point of asking: it is how they say
              what they need. Written only by them, or by a role that may edit
              their record, which is the gate the rest of this page already uses.

              Shares the header's edit mode rather than having one of its own, so
              there is one Edit button on the page and one save. */}
          <Panel title="About the scholar">
            <GridContainer
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
                    <p className={profile.strengths ? "student-about-text" : "student-value-empty"}>
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
                    <p className={profile.help_needed ? "student-about-text" : "student-value-empty"}>
                      {profile.help_needed || (permissions.is_self ? "Not filled in yet. Edit your profile to add it." : EMPTY_VALUE)}
                    </p>
                  </div>
                ),
              ]}
              space={2}
            />
          </Panel>

          <Panel flush title="Supervisors">
            <TableComponent
              data={supervisorTableData}
              keys={["name", "email", "phone", "designation"]}
              titles={["Name", "Email", "Phone", "Designation"]}
              components={[facultyNameCell]}
            />
          </Panel>

          <Panel flush title="Doctoral committee">
            <TableComponent
              data={doctoralTableData}
              keys={["name", "email", "phone", "designation"]}
              titles={["Name", "Email", "Phone", "Designation"]}
              components={[facultyNameCell]}
            />
          </Panel>

          {/* With the doctoral committee above, the IRB committee. Set from
              Manage supervisors/doctoral. */}
          <Panel flush title="IRB outside expert">
            {profile.irb_outside_expert ? (
              <TableComponent
                data={[profile.irb_outside_expert]}
                keys={["name", "email", "designation", "institution"]}
                titles={["Name", "Email", "Designation", "Institution"]}
              />
            ) : (
              <p className="profile-panel-note">
                None on record. The revised IRB goes from the supervisors straight to the doctoral committee, with no external review.
              </p>
            )}
          </Panel>

          {publications && (
            <Panel>
              {/* Read-only here. The scholar adds and edits on their own
                  publications page, which is the one place that writes them. */}
              <ShowPublications
                formData={publications}
                enableEdit={false}
                enableDelete={false}
                canAdd={false}
                collapsible
              />
            </Panel>
          )}

          <Panel flush title="Enrolled courses">
            <TableComponent
              data={courses?.filter(c => c.status === 'enrolled')}
              keys={["course_code", "course_name", "credits", "semester", ...courseActionKey]}
              titles={["Course code", "Course name", "Credits", "Semester", ...courseActionTitle]}
              components={courseActionCell}
            />
          </Panel>

          <Panel flush title="Completed courses">
            <TableComponent
              data={courses?.filter(c => c.status === 'completed')}
              keys={["course_code", "course_name", "credits", "semester", "grade", ...courseActionKey]}
              titles={["Course code", "Course name", "Credits", "Semester", "Grade", ...courseActionTitle]}
              components={courseActionCell}
            />
          </Panel>
        </Page>
        {/* Tag Course Modal */}
        <CustomModal
          isOpen={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
        >
          <div>
            <h3 className="modal-title">Tag student with course</h3>
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
                <CustomButton text="Cancel" variant="quiet" onClick={() => setIsTagModalOpen(false)} />
                <CustomButton text="Tag course" onClick={handleTagCourse} disabled={taggingCourse} />
              </div>
            </div>
          </div>
        </CustomModal>

        {/* Supervisor/Doctoral Committee Management Modal */}
        <CustomModal
          isOpen={showSupervisorDoctoralModal}
          onClose={() => setShowSupervisorDoctoralModal(false)}
        >
          <SupervisorDoctoralManager
            studentId={profile.roll_no}
            supervisors={supervisors || []}
            doctoralCommittee={doctoral || []}
            outsideExpert={profile.irb_outside_expert ?? null}
            canSetOutsideExpert={permissions.can_manage}
            onOutsideExpertSaved={() => customFetch(profileUrl, "GET", {}, true, false).then((res) => {
              if (res?.success) setProfile(res.response.profile);
            })}
            onClose={() => {
              setShowSupervisorDoctoralModal(false);
              // Refresh profile data to show updated supervisors/doctoral
              customFetch(profileUrl, "GET", {}, true, false).then((res) => {
                if (res?.success) setProfile(res.response.profile);
              });
            }}
          />
        </CustomModal>

      </>
    );
  } else {
    return (
      <LoadError
        message="Could not load this profile. Check your connection and try again."
        onRetry={() => {
          setLoading(true);
          loadProfile();
        }}
      />
    );
  }
};

export default ProfileCard;

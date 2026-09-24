import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import './App.css';
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { LoadingProvider, useLoading } from './context/LoadingContext';
import { FeaturesProvider, useFeatures } from './context/FeaturesContext';
import { CapabilitiesProvider, useAccess } from './context/CapabilitiesContext';
import Loader from './components/loader/loader';
import LoadError from './components/common/LoadError';
import ErrorBoundary from './components/common/ErrorBoundary';
import { currentRole } from './auth/access';

// Every page is split out of the entry chunk. A student signing in should not
// download the admin surface to see their own forms.
// The shell is not split out: loading it lazily put a full-screen loader
// before the shell's own content loader on every first visit.
import Layout from './components/dashboard/layout';
const LandingPage = lazy(() => import('./pages/landing/LandingPage'));
const LoginPage = lazy(() => import('./pages/login/Login'));
const SignupPage = lazy(() => import('./pages/signup/SignupPage'));
const GoogleCallback = lazy(() => import('./pages/login/GoogleCallback'));
const FormsPage = lazy(() => import('./pages/forms/FormsPage'));
const FormListPage = lazy(() => import('./pages/forms/FormListPage'));
const MainFormPage = lazy(() => import('./pages/forms/MainFormPage'));
const StudentsPage = lazy(() => import('./pages/students/StudentsPage'));
const StudentProfile = lazy(() => import('./pages/students/StudentProfile'));
const NotFound = lazy(() => import('./pages/404/NotFound'));
const FacultyFormsPage = lazy(() => import('./pages/forms/FacultyFormsPage'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Publications = lazy(() => import('./pages/publications/Publications'));
const PresentationListPage = lazy(() => import('./pages/presentations/PresentationListPage'));
const Presentation = lazy(() => import('./pages/presentations/PresentationForm'));
const ForgotPasswordPage = lazy(() => import('./pages/forgot-password/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/reset-password/ResetPasswordPage'));
const PublicOpenings = lazy(() => import('./pages/publicOpenings/PublicOpenings'));
const PublicOpeningDetail = lazy(() => import('./pages/publicOpenings/PublicOpeningDetail'));
const ApplicationStatus = lazy(() => import('./pages/publicOpenings/ApplicationStatus'));
const AllNotificationsPage = lazy(() => import('./components/notificationBox/AllNotificationsPage'));
const PresentationSemester = lazy(() => import('./pages/presentations/PresentationSemester'));
const StudentProgressMonitoring = lazy(() => import('./pages/presentations/StudentProgressMonitoring'));
const Logs = lazy(() => import('./pages/logs/Logs'));
const Team = lazy(() => import('./pages/team/Team'));
const AdminFormManagement = lazy(() => import('./pages/admin/AdminFormManagement'));
const StudentCourses = lazy(() => import('./pages/StudentCourses/StudentCourses'));
const ServerListPage = lazy(() => import('./components/serverPage/ServerListPage'));
const ExternalReview = lazy(() => import('./pages/externalReview/ExternalReview'));
const SupervisorDoctoralApproval = lazy(() => import('./pages/SupervisorDoctoralApproval/SupervisorDoctoralApproval'));
const AttendanceRoute = lazy(() => import('./pages/attendance/AttendanceRoute'));
const PrivacyPolicy = lazy(() => import('./pages/privacy/PrivacyPolicy'));
const Support = lazy(() => import('./pages/support/Support'));
const ResearchProfile = lazy(() => import('./pages/admin/ResearchProfile'));
const Configuration = lazy(() => import('./pages/admin/Configuration'));
const ProjectsOverview = lazy(() => import('./pages/projects/ProjectsOverview'));
const CreateProject = lazy(() => import('./pages/projects/CreateProject'));
const ProjectDetails = lazy(() => import('./pages/projects/ProjectDetails'));
const ProjectRecruitment = lazy(() => import('./pages/projects/ProjectRecruitment'));
const Openings = lazy(() => import('./pages/projects/Openings'));
const UrfList = lazy(() => import('./pages/urf/UrfList'));
const UrfDetails = lazy(() => import('./pages/urf/UrfDetails'));
const UrfFormList = lazy(() => import('./pages/urf/UrfFormList'));
const UrfFormRecord = lazy(() => import('./pages/urf/UrfFormRecord'));
const UrfFormsPage = lazy(() => import('./pages/urf/UrfStudentForms').then(m => ({ default: m.UrfFormsPage })));
const UrfFormPage = lazy(() => import('./pages/urf/UrfStudentForms').then(m => ({ default: m.UrfFormPage })));

const App = () => {
  return (
    <LoadingProvider>
      <FeaturesProvider>
        <CapabilitiesProvider>
          <AppContent />
        </CapabilitiesProvider>
      </FeaturesProvider>
    </LoadingProvider>
  );
};

// One shell for every signed-in page. Held by a parent route, it stays mounted
// across navigation, so the sidebar, notifications and profile are not rebuilt
// on each click, and a page still loading shows the loader inside it.
// A page that fails to render leaves the shell standing; keyed by path, the
// boundary starts clean when the user navigates away.
const Shell = () => {
  const { pathname } = useLocation();
  return (
    <Layout>
      <ErrorBoundary key={pathname}>
        <Suspense fallback={<Loader scope="content" />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </Layout>
  );
};

// Pages a visitor reaches without signing in.
const PUBLIC_PATHS = /^\/($|team|privacy|support|login|signup|google\/callback|forgot-password|reset-password|external-review\/|openings|applications\/)/;

const AppContent = () => {
  const { loading } = useLoading();
  const role = currentRole();

  // A switched-off module leaves no route behind, so its address falls through
  // to the 404 page rather than rendering against an API that answers 404.
  const features = useFeatures();
  // Route gates read the same answer the sidebar does: which areas this role
  // may reach, from the server (GET /me).
  const { may, known, failed } = useAccess();

  // Signed out, a protected address has no route at all and fell through to
  // "Not found". Send the visitor to sign in and back to where they were going.
  const { pathname, search } = window.location;
  const signedIn = !!localStorage.getItem('token');
  if (!signedIn && !PUBLIC_PATHS.test(pathname)) {
    window.location.replace(`/login?next=${encodeURIComponent(pathname + search)}`);
    return null;
  }
  // Signed in, the routes wait for what this role may reach; it is cached, so
  // this is only the first page after signing in or switching role.
  if (signedIn && failed) {
    return <LoadError message="Could not load your menu. Check your connection and try again." onRetry={() => window.location.reload()} />;
  }
  if (signedIn && !known) return <Loader scope="app" />;
  return (
    <>
      {loading && <Loader scope="app" />}
      <ToastContainer
        position="top-right"
        hideProgressBar={true}
        closeOnClick
        autoClose={3000}
        toastStyle={{
          backgroundColor: "#fff",
        }}
      />
      <Router>
        <ErrorBoundary>
        <Suspense fallback={<Loader />}>
          <Routes>
            {/* Landing Page */}
            <Route path="/" element={<LandingPage />} />

            {/* Public Pages */}
            <Route path="/team" element={<Team />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/support" element={<Support />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/google/callback" element={<GoogleCallback />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/external-review/:token" element={<ExternalReview />} />
            {/* One address for openings. A signed-in student gets their own board,
                which prefills from their profile; everyone else gets the public one.
                The student board is declared inside the shell route below. */}
            {features.job_openings && (
              <>
                {!may('openings') && <Route path="/openings" element={<PublicOpenings />} />}
                <Route path="/openings/:id" element={<PublicOpeningDetail />} />
                <Route path="/applications/:token" element={<ApplicationStatus />} />
                <Route path="/applications/:token/verify" element={<ApplicationStatus verify />} />
              </>
            )}

            <Route element={<Shell />}>
              {features.job_openings && may('openings') && <Route path="/openings" element={<Openings />} />}

              {/* Dashboard */}
              <Route path="/home" element={<Dashboard />} />
              {features.project_management && may('projects') && (
                <>
                  <Route path="/projects" element={<ProjectsOverview />} />
                  <Route path="/projects/create" element={<CreateProject />} />
                  <Route path="/projects/:id" element={<ProjectDetails />} />
                  {/* Recruitment produces openings, so it follows the openings
                      switch rather than the projects one. */}
                  {features.job_openings && (
                    <Route path="/projects/:id/recruit" element={<ProjectRecruitment />} />
                  )}
                </>
              )}
              {role === 'student' && (
                <>
                  <Route path="/forms" element={<FormsPage />} />
                  <Route path="/courses" element={<StudentCourses />} />
                </>
              )}
              {role === 'ug_student' && (
                <>
                  {/* Static form paths outrank the shared /forms/:form_type route. */}
                  <Route path="/forms" element={<UrfFormsPage />} />
                  <Route path="/forms/urf-application" element={<UrfFormPage type="new" />} />
                  <Route path="/forms/urf/:id/application" element={<UrfFormPage type="application" />} />
                  <Route path="/forms/urf/:id/additional-info" element={<UrfFormPage type="additional" />} />
                  <Route path="/forms/urf/:id/half-yearly-report" element={<UrfFormPage type="half_yearly" />} />
                  <Route path="/forms/urf/:id/final-report" element={<UrfFormPage type="final" />} />
                </>
              )}
              {may('publications') && <Route path="/publications" element={<Publications />} />}
              <Route path="/notifications" element={<AllNotificationsPage />} />
              <Route path="/faculty/:facultyCode/profile" element={<ResearchProfile />} />
              {/* Matches the sidebar's Progress Monitoring entry, so clerk and external
                  (who have no sidebar link for it) can't land on the page either. */}
              {may('presentations') && (
                <>
                  <Route path="/presentation" element={<PresentationSemester />} />
                  <Route path="/presentation/semester" element={<Navigate to="/presentation" replace />} />
                  {/* The semester and form pages sit under the same gate, so a role
                      kept off the landing page cannot reach them by deep link. */}
                  <Route path="/presentation/semester/:semester_id" element={<PresentationListPage />} />
                  <Route path="/presentation/semester/:semester_id/:id" element={<Presentation />} />
                </>
              )}

              <Route path="/forms/:form_type" element={<FormListPage />} />
              <Route path="/forms/:form_type/:id" element={<MainFormPage />} />
              {may('scholars') && (
                <>
                  <Route path="/forms" element={<FacultyFormsPage />} />
                  <Route path="/students" element={<StudentsPage />} />
                  <Route path="/students/:roll_no" element={<StudentProfile />} />
                  <Route path="/students/:roll_no/forms" element={<FormsPage />} />
                  {/* Progress Monitoring for one scholar, from their profile. The
                      pages read the path back as their API endpoint, and the
                      scholar-scoped endpoints already exist under
                      /students/{id}/forms/presentation. */}
                  <Route path="/students/:roll_no/forms/presentation" element={<StudentProgressMonitoring />} />
                  <Route path="/students/:roll_no/forms/presentation/semester/:semester_id" element={<PresentationListPage />} />
                  <Route path="/students/:roll_no/forms/presentation/semester/:semester_id/:id" element={<Presentation />} />
                  <Route path="/students/:roll_no/forms/:form_type" element={<FormListPage />} />
                  <Route path="/students/:roll_no/forms/:form_type/:id" element={<MainFormPage />} />
                </>
              )}
              {may('courseManagement') && <Route path="/courses" element={<ServerListPage page="courses" />} />}
              {/* Matches can_edit_department, which DepartmentController::list requires. */}
              {may('departments') && <Route path="/departments" element={<ServerListPage page="departments" />} />}
              {/* can_manage_supervisor_changes is granted to dordc and admin on the server. */}
              {may('supervisorApprovals') && (
                <Route path="/supervisor-doctoral-approvals" element={<SupervisorDoctoralApproval />} />
              )}
              {may('facultyDirectory') && <Route path="/faculty" element={<ServerListPage page="faculty" />} />}
              {/* The server decides what each of them reads, so the routes only
                  have to be reachable. */}
              {may('urf') && (
                <>
                  <Route path="/urf" element={<UrfList />} />
                  {/* Each form's own submissions. These sit beside /urf rather
                      than with the admin routes: the office roles that manage URF
                      are not all the admin role, and a form card opening for them
                      fell through to /urf/:id and drew the project page instead.
                      The server refuses anyone without can_manage_urf. */}
                  <Route path="/urf/urf-application" element={<UrfFormList />} />
                  <Route path="/urf/urf-additional-info" element={<UrfFormList />} />
                  <Route path="/urf/urf-half-yearly-report" element={<UrfFormList />} />
                  <Route path="/urf/urf-final-report" element={<UrfFormList />} />
                  {/* One submission of one form, with its own chain, as a PhD
                      form page has. The API path is the page path. */}
                  <Route path="/urf/urf-application/:id" element={<UrfFormRecord />} />
                  <Route path="/urf/urf-additional-info/:id" element={<UrfFormRecord />} />
                  <Route path="/urf/urf-half-yearly-report/:id" element={<UrfFormRecord />} />
                  <Route path="/urf/urf-final-report/:id" element={<UrfFormRecord />} />
                  <Route path="/urf/:id" element={<UrfDetails />} />
                </>
              )}
              {may('attendance') && <Route path="/attendance" element={<AttendanceRoute />} />}
              {may('areasOfSpecialization') && <Route path="/areasOfSpecialization" element={<ServerListPage page="areas-of-specialization" />} />}
              {may('admin') && (
                <>
                  <Route path="/forms/manage" element={<AdminFormManagement />} />
                  <Route path="/courses/manage" element={<ServerListPage page="courses" />} />
                  <Route path="/outside-experts" element={<ServerListPage page="outside-experts" />} />
                  <Route path="/logs" element={<Logs />} />
                  <Route path="/users" element={<ServerListPage page="users" />} />
                  <Route path="/clerk-management" element={<ServerListPage page="clerks" />} />
                  <Route path="/clerks" element={<ServerListPage page="clerks" />} />
                  <Route path="/configuration" element={<Configuration />} />
                </>
              )}
              {/* Signed in, a miss (often a page this role has no route for)
                  keeps the sidebar, so the way back is still on screen. */}
              {signedIn && <Route path="*" element={<NotFound />} />}
            </Route>

            {!signedIn && <Route path="*" element={<NotFound />} />}
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </Router>
    </>
  );
};

export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import LandingPage from './pages/landing/LandingPage';
import LoginPage from './pages/login/Login';
import GoogleCallback from './pages/login/GoogleCallback';
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { LoadingProvider, useLoading } from './context/LoadingContext'; // Remove useLoading import
import Loader from './components/loader/loader';
import FormsPage from './pages/forms/FormsPage';
import FormListPage from './pages/forms/FormListPage';
import MainFormPage from './pages/forms/MainFormPage';
import StudentsPage from './pages/students/StudentsPage';
import StudentProfile from './pages/students/StudentProfile';
import NotFound from './pages/404/NotFound';
import FacultyFormsPage from './pages/forms/FacultyFormsPage';
import Dashboard from './pages/dashboard/Dashboard';
import Publications from './pages/publications/Publications';
import PresentationListPage from './pages/presentations/PresentationListPage';
import Presentation from './pages/presentations/PresentationForm';
import ForgotPasswordPage from './pages/forgot-password/ForgotPasswordPage';
import ResetPasswordPage from './pages/reset-password/ResetPasswordPage';
import FacultyPage from './pages/faculty/FacultyPage';
import DepartmentPage from './pages/department/Department';
import AllNotificationsPage from './components/notificationBox/AllNotificationsPage';
import PresentationSemester from './pages/presentations/PresentationSemester';
import Logs from './pages/logs/Logs';
import Team from './pages/team/Team';
import AdminFormManagement from './pages/admin/AdminFormManagement';
import AreaOfSpecialization from './pages/areaOfSpecialization/AreaOfSpecialization';
import StudentCourses from './pages/StudentCourses/StudentCourses';
import AdminCourseManagement from './pages/AdminCourseManagement/AdminCourseManagement';
import OutsideExperts from './pages/OutsideExperts/OutsideExperts';
import ExternalReview from './pages/externalReview/ExternalReview';
import SupervisorDoctoralApproval from './pages/SupervisorDoctoralApproval/SupervisorDoctoralApproval';
import UsersPage from './pages/users/UsersPage';
import PrivacyPolicy from './pages/privacy/PrivacyPolicy';
import Support from './pages/support/Support';


const App = () => {
  return (
    <LoadingProvider>
      <AppContent />
    </LoadingProvider>
  );
};

const AppContent = () => {
  const { loading } = useLoading(); 
  const role=localStorage.getItem('userRole');
  return (
    <>
      {loading && <Loader />}
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
        <Routes>
          {/* Landing Page */}
          <Route path="/" element={<LandingPage />} />
          
          {/* Public Pages */}
          <Route path="/team" element={<Team />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/support" element={<Support />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/google/callback" element={<GoogleCallback />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage/>} />
          <Route path="/external-review/:token" element={<ExternalReview />} />
          
          {/* Dashboard */}
          <Route path="/home" element={<Dashboard/>} />
          {/* <Route path="/team" element={<Team/>} /> */}
          {role==='student' && (
            <>
            <Route path="/forms" element={<FormsPage/>} />
            
            <Route path="/publications" element={<Publications/>} />  
            <Route path="/courses" element={<StudentCourses />} />
            
            </>
          )}
          <Route path="/notifications" element={<AllNotificationsPage />} />
          <Route path="/presentation" element={<PresentationSemester/>} /> 
          <Route path="/presentation/semester" element={<Navigate to="/presentation" replace />} /> 
     
          {/* <Route path="/presentation/form" element={<PresentationListPage/>} />   */}
          
          <Route path="/presentation/semester/:semester_id" element={<PresentationListPage/>} />  
          <Route path="/presentation/semester/:semester_id/:id" element={<Presentation/>} />  

          <Route path="/forms/:form_type" element={<FormListPage/>} />
          <Route path="/forms/:form_type/:id" element={<MainFormPage/>} />
          {(role === 'faculty' || role === 'phd_coordinator' || role==='hod' || role==='doctoral'|| role==='external'|| role==='dordc'  || role==='adordc'  ||role==='dra' || role==='director' || role==='admin') && (
            <>
                 <Route path="/forms" element={<FacultyFormsPage/>} />
                <Route path="/students" element={<StudentsPage />} />
                <Route path="/students/:roll_no" element={<StudentProfile />} />
                <Route path="/students/:roll_no/forms" element={<FormsPage />} />
                <Route path="/students/:roll_no/forms/:form_type" element={<FormListPage />} />
                <Route path="/students/:roll_no/forms/:form_type/:id" element={<MainFormPage />} />
                {(role === 'hod' || role === 'phd_coordinator' || role==='admin') && (
                  <Route path="/courses" element={<AdminCourseManagement />} />
                )}
            </>
          ) }
          {(
            role === 'hod' || role === 'phd_coordinator' || role==='doctoral'|| role==='external'|| role==='dordc'  ||role==='adordc'  ||  role==='dra' || role==='director' || role==='admin') && (
              <>
              <Route path="/faculty" element={<FacultyPage />} />
              <Route path="/departments" element={<DepartmentPage/>}/>
              {/* <Route path="/faculty/:roll_no" element={<StudentProfile />} />
              <Route path="/faculty/:roll_no/forms" element={<FormsPage />} />
              <Route path="/faculty/:roll_no/forms/:form_type" element={<FormListPage />} />
              <Route path="/faculty/:roll_no/forms/:form_type/:id" element={<MainFormPage />} /> */}
            </>
          )}
            {role === 'dordc' && (
              <Route path="/supervisor-doctoral-approvals" element={<SupervisorDoctoralApproval />} />
            )}
            {(
              role==='admin') && (
                <>
                <Route path="/forms/manage" element={<AdminFormManagement/>} />
                <Route path='/areasOfSpecialization' element={<AreaOfSpecialization/>}/>
                <Route path="/courses/manage" element={<AdminCourseManagement />} />
                <Route path="/outside-experts" element={<OutsideExperts />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/users" element={<UsersPage />} />
         
              {/* <Route path="/faculty/:roll_no" element={<StudentProfile />} />
              <Route path="/faculty/:roll_no/forms" element={<FormsPage />} />
              <Route path="/faculty/:roll_no/forms/:form_type" element={<FormListPage />} />
              <Route path="/faculty/:roll_no/forms/:form_type/:id" element={<MainFormPage />} /> */}
            </>
          )}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
};

export default App;

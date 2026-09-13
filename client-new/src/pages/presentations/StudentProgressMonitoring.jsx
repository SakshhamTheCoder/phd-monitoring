import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/dashboard/layout";
import PageHeader from "../../components/pageHeader/PageHeader";
import PagenationTable from "../../components/pagenationTable/PagenationTable";

/**
 * One scholar's progress monitoring, opened from their profile.
 *
 * The portal-wide page asks which semester you want first, because it lists
 * every scholar. Here the scholar is already chosen, so the semesters are the
 * rows rather than the question, and the page never offers to create a semester
 * or import history: those belong to the office, not to a scholar's record.
 */
const StudentProgressMonitoring = () => {
  const { roll_no } = useParams();
  const navigate = useNavigate();

  // The form lives under its semester, so the row's own semester completes the
  // path. A row without one has no form page to open.
  const openPresentation = (presentation) => {
    if (!presentation.period) return;
    navigate(`/students/${roll_no}/forms/presentation/semester/${presentation.period}/${presentation.id}`);
  };

  return (
    <Layout
      children={
        <>
          <PageHeader
            title="Progress Monitoring"
            subtitle={`Every evaluation recorded for ${roll_no}.`}
          />
          <PagenationTable
            endpoint={`/students/${roll_no}/forms/presentation`}
            customOpenForm={openPresentation}
            enableSelect={false}
          />
        </>
      }
    />
  );
};

export default StudentProgressMonitoring;

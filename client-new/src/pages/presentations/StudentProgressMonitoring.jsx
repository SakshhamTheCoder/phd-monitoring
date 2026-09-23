import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Page from "../../components/page/Page";
import Panel from "../../components/panel/Panel";
import PagenationTable from "../../components/pagenationTable/PagenationTable";
import ProgressChart from "../../components/profileCard/ProgressChart";
import useScholarInPath from "../../hooks/useScholarInPath";
import { baseURL } from "../../api/urls";
import { customFetch } from "../../api/base";

/**
 * One scholar's progress monitoring, opened from their profile.
 *
 * The portal-wide page asks which semester you want first, because it lists
 * every scholar. Here the scholar is already chosen, so the semesters are the
 * rows rather than the question, and the page never offers to create a semester
 * or import history: those belong to the office, not to a scholar's record.
 *
 * The chart of the same evaluations over time heads the page. It used to sit
 * open on the profile, under everything else about the scholar, where it is a
 * slow read of the record rather than a fact about the person.
 */
const StudentProgressMonitoring = () => {
  const { roll_no } = useParams();
  const navigate = useNavigate();
  const scholar = useScholarInPath();
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!roll_no) return;
    customFetch(`${baseURL}/students/${roll_no}/progress-history`, "GET", {}, false, false)
      .then((res) => res?.success && setProgress(res.response))
      // Hidden rather than reported: the table below is the page, and a reader
      // who may not read the history still reads that.
      .catch(() => {});
  }, [roll_no]);

  // The form lives under its semester, so the row's own semester completes the
  // path. A row without one has no form page to open.
  const openPresentation = (presentation) => {
    if (!presentation.period) return;
    navigate(`/students/${roll_no}/forms/presentation/semester/${presentation.period}/${presentation.id}`);
  };

  return (
    <Page
      title="Progress monitoring"
      description={`Every evaluation recorded for ${scholar?.label ?? roll_no}.`}
    >
      {progress?.points?.length > 0 && (
        <Panel title="Progress over time">
          <ProgressChart points={progress.points} milestones={progress.milestones} />
        </Panel>
      )}
      <PagenationTable
        endpoint={`/students/${roll_no}/forms/presentation`}
        customOpenForm={openPresentation}
        enableSelect={false}
      />
    </Page>
  );
};

export default StudentProgressMonitoring;

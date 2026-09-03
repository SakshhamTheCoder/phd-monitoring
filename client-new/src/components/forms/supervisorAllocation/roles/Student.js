import React, { useEffect, useState } from "react";
import InputSuggestions from "../../fields/InputSuggestions";
import { baseURL } from "../../../../api/urls";
import GridContainer from "../../fields/GridContainer";
import InputField from "../../fields/InputField";
import { formatDate } from "../../../../utils/timeParse";
import TableComponent from "../../table/TableComponent";
import CustomButton from "../../fields/CustomButton";

import { useLocation } from "react-router-dom";
import { submitForm } from "../../../../api/form";
import { useLoading } from "../../../../context/LoadingContext";
import { customFetch } from "../../../../api/base";
import { toast } from "react-toastify";

const Student = ({ formData }) => {
  const apiUrl_suggestion = baseURL + "/suggestions/faculty";
  const apiUrl_broad_suggestion = baseURL + "/suggestions/specialization";
  const [body, setBody] = useState({});
  const [lock, setLock] = useState(formData.locks?.student);
  const [isLoaded, setIsLoaded] = useState(false);
  const [recs, setRecs] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const location = useLocation();
  const { setLoading } = useLoading();

  const fetchRecs = async (areas) => {
    const clean = (areas || []).filter(Boolean);
    if (clean.length === 0) { setRecs([]); return; }
    setRecLoading(true);
    try {
      const res = await customFetch(baseURL + "/faculty/recommend", "POST", { areas: clean, department_id: formData.department_id || undefined, limit: 8 }, true);
      if (res.success) setRecs(res.response.data || []);
    } catch {} finally { setRecLoading(false); }
  };
  useEffect(() => {
    const prefrences = formData?.prefrences.map(
      (prefrence) => prefrence.faculty_code
    );
    if (prefrences.length < 6) {
      for (let i = prefrences.length; i < 6; i++) prefrences.push(null);
    }
    setBody({
      prefrences: prefrences,
      broad_area_of_research: formData.broad_area_of_research_id,
    });
    setLock(formData.locks?.student);
    setIsLoaded(true);
    // initial recs if areas already filled
    if ((formData.broad_area_of_research_id || []).filter(Boolean).length) {
      setTimeout(() => fetchRecs(formData.broad_area_of_research_id), 400);
    }
  }, [formData]);

  const handlePrefrenceSelect = (value, index) => {
    body.prefrences[index] = value.id;
  };

  const handleBroadAreaSelect = (value, index) => {
    body.broad_area_of_research[index] = value.id;
    // refresh recs after pick (debounced via timeout to let body update)
    setTimeout(() => fetchRecs(body.broad_area_of_research), 300);
  };

  const applyRec = (facultyCode, prefIndex) => {
    body.prefrences[prefIndex] = facultyCode;
    // force re-render by shallow copy
    setBody({ ...body });
    toast.info(`Preference ${prefIndex + 1} set to ${facultyCode}`);
  };

  return (
    <div>
      {isLoaded && formData && (
        <>
          <GridContainer
            elements={[
              <InputField
                label="Roll Number"
                initialValue={formData.roll_no}
                isLocked={true}
              />,
              <InputField
                label="Name"
                initialValue={formData.name}
                isLocked={true}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label="Date Of Admission"
                initialValue={formatDate(formData.date_of_registration)}
                isLocked={true}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label="Email"
                initialValue={formData.email}
                isLocked={true}
              />,
              <InputField
                label="Mobile Number"
                initialValue={formData.phone}
                isLocked={true}
              />,
            ]}
          />

        

          <GridContainer
           label={[<p>Select 3 Broad Areas of Research</p>]}
            elements={[
              <InputSuggestions
                initialValue={formData.broad_area_of_research[0]}
                apiUrl={apiUrl_broad_suggestion}
                onSelect={(value) => handleBroadAreaSelect(value, 0)}
                lock={lock}
                showLabel={false}
                suggestionManadatory={false}
              />,
            ]}
            space={2}
          />
          <GridContainer
            elements={[
              <InputSuggestions
                initialValue={formData.broad_area_of_research[1]}
                apiUrl={apiUrl_broad_suggestion}
                onSelect={(value) => handleBroadAreaSelect(value, 1)}
                lock={lock}
                suggestionManadatory={false}
                showLabel={false}
              />,
            ]}
            space={2}
          />
          <GridContainer
            elements={[
              <InputSuggestions
                initialValue={formData.broad_area_of_research[2]}
                apiUrl={apiUrl_broad_suggestion}
                onSelect={(value) => handleBroadAreaSelect(value, 2)}
                lock={lock}
                showLabel={false}
                suggestionManadatory={false}
              />,
            ]}
            space={2}
          />
        </>
      )}
      {(formData.stage === "student" && !lock) ? (
        <>
          <GridContainer
            label={[<span>Recommended supervisors (top 8) {recLoading && <span style={{ color: 'var(--text-muted)' }}>loading…</span>}</span>]}
            elements={[
              <TableComponent
                data={recs}
                keys={["name","department","expertise","percent"]}
                titles={["Name","Department","Expertise","Match"]}
                components={[
                  {
                    key: "expertise",
                    component: ({ row }) => <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{(row.expertise || []).slice(0,3).join(', ')}</span>
                  },
                  {
                    key: "percent",
                    component: ({ row }) => <span style={{ background: 'var(--primary-wash)', padding: '0.15rem 0.4rem', borderRadius: '0.3rem', fontSize: '0.75rem' }}>{row.percent}%</span>
                  }
                ]}
              />,
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <CustomButton text="Refresh" variant="secondary" onClick={() => fetchRecs(body.broad_area_of_research)} disabled={recLoading} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Based on your broad areas. Free choice — pick anyone or use recommended.</span>
              </div>,
              recs.length === 0 && !recLoading ? <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{(body.broad_area_of_research || []).filter(Boolean).length ? 'No strong matches yet — try adding clearer areas or pick manually.' : 'Select your 3 broad areas above to see recommendations.'}</p> : null,
              recs.length > 0 ? <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>{recs.slice(0,8).map((r) => (
                <CustomButton key={r.faculty_code} text={`Use ${r.name.split(' ')[0]} (${r.percent}%)`} variant="secondary" onClick={() => {
                  const idx = body.prefrences.findIndex((v) => !v);
                  const target = idx === -1 ? 0 : idx;
                  applyRec(r.faculty_code, target);
                }} />
              ))}</div> : null
            ].filter(Boolean)}
            space={3}
          />

          <GridContainer
            label={[<p>Select 6 Tentative Name of Supervisor (in order)</p>]}
            elements={[
              <InputSuggestions
                initialValue={formData.prefrences[0]?.name}
                apiUrl={apiUrl_suggestion}
                onSelect={(value) => handlePrefrenceSelect(value, 0)}
                lock={lock}
                fields={["name","department"]}
                label={"Preference 1"}
              />,
              <InputSuggestions
                initialValue={formData.prefrences[1]?.name}
                apiUrl={apiUrl_suggestion}
                onSelect={(value) => handlePrefrenceSelect(value, 1)}
                lock={lock}
                fields={["name","department"]}
                label={"Preference 2"}
              />,
              <InputSuggestions
                initialValue={formData.prefrences[2]?.name}
                apiUrl={apiUrl_suggestion}
                onSelect={(value) => handlePrefrenceSelect(value, 2)}
                lock={lock}
                fields={["name","department"]}
                label={"Preference 3"}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputSuggestions
                initialValue={formData.prefrences[3]?.name}
                apiUrl={apiUrl_suggestion}
                onSelect={(value) => handlePrefrenceSelect(value, 3)}
                lock={lock}
                fields={["name","department"]}
                label={"Preference 4"}
              />,
              <InputSuggestions
                initialValue={formData.prefrences[4]?.name}
                apiUrl={apiUrl_suggestion}
                onSelect={(value) => handlePrefrenceSelect(value, 4)}
                lock={lock}
                fields={["name","department"]}
                label={"Preference 5"}
              />,
              <InputSuggestions
                initialValue={formData.prefrences[5]?.name}
                apiUrl={apiUrl_suggestion}
                onSelect={(value) => handlePrefrenceSelect(value, 5)}
                lock={lock}
                fields={["name","department"]}
                label={"Preference 6"}
              />,
            ]}
          />
          <GridContainer

            elements={[
              <CustomButton
                text="Submit"
                onClick={() => {
                  submitForm(body, location, setLoading);
                }}
              />,
            ]}
          />
        </>
      ) : (
        <>
      
          <GridContainer
          label={[<p>Student Prefrences</p>]}
            elements={[
              <TableComponent
                data={formData.prefrences}
                keys={["name","email", "department"]}
                titles={["Supervisor Name","Email", "Department"]}
              />,
            ]}
            space={3}
          />
        </>
      )}
    </div>
  );
};

export default Student;

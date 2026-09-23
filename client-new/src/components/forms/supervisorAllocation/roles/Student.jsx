import React, { useEffect, useState, useRef } from "react";
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
  // Suggestions, not a list to choose from. The scholar is describing what they
  // hope to work on, so anything they type is valid; the department's curated
  // areas are offered as a starting point.
  const apiUrl_broad_suggestion = baseURL + "/suggestions/specialization";
  const [body, setBody] = useState({});
  const [lock, setLock] = useState(formData.locks?.student);
  const [isLoaded, setIsLoaded] = useState(false);
  const [recs, setRecs] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const fetchTimer = useRef(null);
  const recCache = useRef(null);
  // Numbers each request. Only the latest may set the list, so a slow answer
  // for earlier areas cannot replace a newer one or refill a cleared list.
  const recRequest = useRef(0);
  const location = useLocation();
  const { setLoading } = useLoading();

  const fetchRecs = async (areas) => {
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    const clean = (areas || []).filter((a) => a !== null && a !== undefined && a !== '' && a !== 0).map(String);
    const sig = clean.join('|');
    const requestId = ++recRequest.current;
    if (clean.length === 0) { setRecs([]); setRecLoading(false); recCache.current = ''; return; }
    // Already showing these areas' list; any request still out is now stale.
    if (sig === recCache.current) { setRecLoading(false); return; }
    fetchTimer.current = setTimeout(async () => {
      setRecLoading(true);
      const res = await customFetch(baseURL + "/faculty/recommend", "POST", { areas: clean, department_id: formData.department_id || undefined, limit: 8 }, true);
      if (requestId !== recRequest.current) return;
      // Remembered only once answered, so a failed request is tried again.
      if (res.success) {
        recCache.current = sig;
        setRecs(res.response.data || []);
      }
      setRecLoading(false);
    }, 500);
  };
  useEffect(() => {
    const prefrences = (formData?.prefrences || []).slice(0, 6).map((p) => ({
      name: p.name || '',
      email: p.email || '',
      department: p.department || '',
      faculty_code: p.faculty_code,
    }));
    while (prefrences.length < 6) prefrences.push({ name: '', email: '', department: '', faculty_code: null });
    setBody({
      prefrences: prefrences,
      broad_area_of_research: formData.broad_area_of_research || [],
    });
    setLock(formData.locks?.student);
    setIsLoaded(true);
    // initial recs if areas already filled
    if ((formData.broad_area_of_research || []).filter(Boolean).length) {
      fetchRecs(formData.broad_area_of_research);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  const alreadySelected = (fc, skipIndex = -1) => body.prefrences.some((p, i) => i !== skipIndex && p?.faculty_code && p.faculty_code === fc);

  const handlePrefrenceSelect = (value, index) => {
    const fc = value.faculty_code || (typeof value === 'object' && value.id ? value.id : value);
    // false tells InputSuggestions to put the slot's saved choice back.
    if (alreadySelected(fc, index)) { toast.warn('This faculty already selected in another slot'); return false; }
    body.prefrences[index] = {
      name: value.name || value,
      email: value.email || '',
      department: value.department || '',
      faculty_code: fc,
    };
    // Re-render so the other slots stop suggesting this faculty.
    setBody({ ...body });
  };

  const chosenElsewhere = (index) => body.prefrences
    .filter((p, i) => i !== index && p?.faculty_code)
    .map((p) => p.faculty_code);

  const handleBroadAreaSelect = (value, index) => {
    body.broad_area_of_research[index] = value?.name ?? value ?? '';
    fetchRecs(body.broad_area_of_research);
  };

  const applyRec = (row) => {
    if (alreadySelected(row.faculty_code)) { toast.warn('This faculty already selected in another slot'); return; }
    const idx = body.prefrences.findIndex((v) => !v || !v.faculty_code);
    const target = idx === -1 ? 0 : idx;
    body.prefrences[target] = {
      name: row.name,
      email: row.email,
      department: row.department,
      faculty_code: row.faculty_code,
    };
    setBody({ ...body });
    toast.info(`Preference ${target + 1} set to ${row.name}`);
  };

  return (
    <div>
      {isLoaded && formData && (
        <>
          <GridContainer
            elements={[
              <InputField
                label="Roll number"
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
                label="Date of admission"
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
                label="Mobile number"
                initialValue={formData.phone}
                isLocked={true}
              />,
            ]}
          />

        

          <GridContainer
           label="Select 3 broad areas of research"
            elements={[
              <InputSuggestions
                initialValue={formData.broad_area_of_research?.[0]}
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
                initialValue={formData.broad_area_of_research?.[1]}
                apiUrl={apiUrl_broad_suggestion}
                onSelect={(value) => handleBroadAreaSelect(value, 1)}
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
                initialValue={formData.broad_area_of_research?.[2]}
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
      {isLoaded && (formData.role === "student" && formData.stage === "student" && !lock) ? (
        <>
          <GridContainer
            label={<>Recommended supervisors (top 8) {recLoading && <span className="supervisor-allocation-note">loading…</span>}</>}
            elements={[
              <TableComponent
                data={recs}
                keys={["name","department","expertise","supervision","select"]}
                titles={["Name","Department","Area of expertise","Availability","Action"]}
                components={[
                  {
                    key: "expertise",
                    component: ({ row }) => <span className="supervisor-allocation-note">{(row.expertise || []).slice(0,3).join(', ')}</span>
                  },
                  {
                    key: "supervision",
                    component: ({ row }) => row.supervision?.is_full ? (
                      <span className="badge badge--warning">Full</span>
                    ) : (
                      <span className="supervisor-allocation-note">{row.supervision ? `${row.supervision.remaining} of ${row.supervision.limit} free` : ''}</span>
                    )
                  },
                  {
                    key: "select",
                    component: ({ row }) => (
                      <CustomButton
                        text="Select"
                        variant="secondary"
                        size="sm"
                        onClick={() => applyRec(row)}
                      />
                    )
                  }
                ]}
              />,
              <span className="supervisor-allocation-note">Based on your broad areas. Free choice: pick anyone or use recommended.</span>,
              recs.length === 0 && !recLoading ? <span className="supervisor-allocation-note">{(body.broad_area_of_research || []).filter(Boolean).length ? 'No strong matches yet. Try adding clearer areas or pick manually.' : 'Select your 3 broad areas above to see recommendations.'}</span> : null,
            ].filter(Boolean)}
            space={3}
          />

          <GridContainer
            label="Select 6 tentative names of supervisors (in order)"
            elements={[
              <InputSuggestions
                initialValue={body.prefrences[0] ? [body.prefrences[0].name, body.prefrences[0].department].filter(Boolean).join(' - ') : ''}
                apiUrl={apiUrl_suggestion}
                onSelect={(value) => handlePrefrenceSelect(value, 0)}
                excludeIds={chosenElsewhere(0)}
                lock={lock}
                fields={["name","department"]}
                label={"Preference 1"}
              />,
              <InputSuggestions
                initialValue={body.prefrences[1] ? [body.prefrences[1].name, body.prefrences[1].department].filter(Boolean).join(' - ') : ''}
                apiUrl={apiUrl_suggestion}
                onSelect={(value) => handlePrefrenceSelect(value, 1)}
                excludeIds={chosenElsewhere(1)}
                lock={lock}
                fields={["name","department"]}
                label={"Preference 2"}
              />,
              <InputSuggestions
                initialValue={body.prefrences[2] ? [body.prefrences[2].name, body.prefrences[2].department].filter(Boolean).join(' - ') : ''}
                apiUrl={apiUrl_suggestion}
                onSelect={(value) => handlePrefrenceSelect(value, 2)}
                excludeIds={chosenElsewhere(2)}
                lock={lock}
                fields={["name","department"]}
                label={"Preference 3"}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputSuggestions
                initialValue={body.prefrences[3] ? [body.prefrences[3].name, body.prefrences[3].department].filter(Boolean).join(' - ') : ''}
                apiUrl={apiUrl_suggestion}
                onSelect={(value) => handlePrefrenceSelect(value, 3)}
                excludeIds={chosenElsewhere(3)}
                lock={lock}
                fields={["name","department"]}
                label={"Preference 4"}
              />,
              <InputSuggestions
                initialValue={body.prefrences[4] ? [body.prefrences[4].name, body.prefrences[4].department].filter(Boolean).join(' - ') : ''}
                apiUrl={apiUrl_suggestion}
                onSelect={(value) => handlePrefrenceSelect(value, 4)}
                excludeIds={chosenElsewhere(4)}
                lock={lock}
                fields={["name","department"]}
                label={"Preference 5"}
              />,
              <InputSuggestions
                initialValue={body.prefrences[5] ? [body.prefrences[5].name, body.prefrences[5].department].filter(Boolean).join(' - ') : ''}
                apiUrl={apiUrl_suggestion}
                onSelect={(value) => handlePrefrenceSelect(value, 5)}
                excludeIds={chosenElsewhere(5)}
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
                  const submitBody = {
                    ...body,
                    // An empty slot is null. Sending the slot object itself made the server
                    // fail on it instead of saying six choices are needed.
                    prefrences: body.prefrences.map((p) => p?.faculty_code ?? null),
                  };
                  submitForm(submitBody, location, setLoading);
                }}
              />,
            ]}
          />
        </>
      ) : isLoaded && formData.prefrences ? (
        <>
      
          <GridContainer
          label="Student preferences"
            elements={[
              <TableComponent
                data={formData.prefrences}
                keys={["name","email", "department"]}
                titles={["Supervisor name","Email", "Department"]}
              />,
            ]}
            space={3}
          />
        </>
      ) : null}
    </div>
  );
};

export default Student;

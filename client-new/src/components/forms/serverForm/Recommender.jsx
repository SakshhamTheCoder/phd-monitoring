import React, { useEffect, useRef, useState } from "react";
import GridContainer from "../fields/GridContainer";
import TableComponent from "../table/TableComponent";
import CustomButton from "../fields/CustomButton";
import { customFetch } from "../../../api/base";
import { baseURL } from "../../../api/urls";

// Matches fetched for the entries of one list as they change, each of which
// can be picked into another list (Field::recommender on the server).
const Recommender = ({ field, entries, onPick }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const shown = useRef(null);
  // Numbers each request. Only the latest may set the list, so a slow answer
  // for earlier entries cannot replace a newer one or refill a cleared list.
  const latest = useRef(0);

  const clean = (entries || []).filter((entry) => entry !== null && entry !== undefined && entry !== "" && entry !== 0).map(String);
  const signature = clean.join("|");

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const request = ++latest.current;
    if (clean.length === 0) {
      setMatches([]);
      setLoading(false);
      shown.current = "";
      return;
    }
    // Already showing these entries' matches; any request still out is stale.
    if (signature === shown.current) {
      setLoading(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      const params = Object.fromEntries(Object.entries(field.params || {}).map(([key, value]) => [key, value || undefined]));
      const res = await customFetch(baseURL + field.source, "POST", { areas: clean, ...params, limit: field.limit }, true);
      if (request !== latest.current) return;
      // Remembered only once answered, so a failed request is tried again.
      if (res.success) {
        shown.current = signature;
        setMatches(res.response.data || []);
      }
      setLoading(false);
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <GridContainer
      label={<>{field.label} {loading && <span className="supervisor-allocation-note">loading…</span>}</>}
      elements={[
        <TableComponent
          data={matches}
          keys={["name", "department", "expertise", "supervision", "select"]}
          titles={["Name", "Department", "Area of expertise", "Availability", "Action"]}
          components={[
            {
              key: "expertise",
              component: ({ row }) => <span className="supervisor-allocation-note">{(row.expertise || []).slice(0, 3).join(", ")}</span>,
            },
            {
              key: "supervision",
              component: ({ row }) =>
                row.supervision?.is_full ? (
                  <span className="badge badge--warning">Full</span>
                ) : (
                  <span className="supervisor-allocation-note">
                    {row.supervision ? `${row.supervision.remaining} of ${row.supervision.limit} free` : ""}
                  </span>
                ),
            },
            {
              key: "select",
              component: ({ row }) => <CustomButton text="Select" variant="secondary" size="sm" onClick={() => onPick(row)} />,
            },
          ]}
        />,
        <span className="supervisor-allocation-note">{field.note}</span>,
        matches.length === 0 && !loading ? (
          <span className="supervisor-allocation-note">{clean.length ? field.empty_with_areas : field.empty_without_areas}</span>
        ) : null,
      ].filter(Boolean)}
      space={3}
    />
  );
};

export default Recommender;

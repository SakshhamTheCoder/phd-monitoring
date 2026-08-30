import React, { useEffect, useState } from "react";
// import axios from 'axios';
import "./FilterBar.css"; // Import external CSS
import DropdownField from "../forms/fields/DropdownField";
import InputSuggestions from "../forms/fields/InputSuggestions";
import { baseURL } from "../../api/urls";
import { customFetch } from "../../api/base";
import { useLoading } from "../../context/LoadingContext";
const FilterBar = ({ onSearch, default_filter,mandatory_filter }) => {
  const [filtersMeta, setFiltersMeta] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState(null);

  const [value, setValue] = useState("");
  const [operator, setOperator] = useState("=");
  const [combinator, setCombinator] = useState("AND");
  const [activeFilters, setActiveFilters] = useState([]);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        let location = window.location;
        let data = await customFetch(
          baseURL + location.pathname + "/filters",
          "GET",
          null,
          false
        );
        const raw = data?.response;
        // Guard: /filters may 404, return object, or non-array on pages without a
        // dedicated filter definition (e.g. /clerk-management). Never store
        // a non-array otherwise .map/.find crashes the whole page.
        if (Array.isArray(raw)) setFiltersMeta(raw);
        else if (Array.isArray(raw?.data)) setFiltersMeta(raw.data);
        else setFiltersMeta([]);
      } catch (error) {
        console.error("Error fetching filters:", error);
        setFiltersMeta([]);
      }
    };
    fetchFilters();
  }, []);

  useEffect(() => {
    if (!default_filter || default_filter.length === 0) return;
    // Always clear old filters and apply new ones
    const newDefaults = default_filter?.map((filter) => ({
      label: filter.label,
      key: filter.key_name,
      op: filter.op || "=",
      value: filter.value || "",
    }));

    setActiveFilters(newDefaults);
  }, [default_filter]);

  const addFilter = () => {
    if (!selectedFilter || !value) return;
    setActiveFilters([
      ...activeFilters,
      {
        label: selectedFilter.label,
        key: selectedFilter.key_name,
        op: operator,
        value,
      },
    ]);
    setValue("");
  };

  const removeFilter = (index) => {
    setActiveFilters(activeFilters.filter((_, i) => i !== index));
  };

  const handleSearch = () => {
    const query = {
      combine: combinator,
      conditions: activeFilters,
      mandatory_filter: mandatory_filter || [],
    };
    onSearch(query);
  };

  return (
    <div className="filter-bar">
      <div className="filter-row">
        <select
          className="filter-select"
          value={selectedFilter?.key_name || ""}
          onChange={(e) => {
            const list = Array.isArray(filtersMeta) ? filtersMeta : [];
            const meta = list.find((f) => f.key_name === e.target.value);
            setSelectedFilter(meta || null);
            setValue("");
          }}
        >
          <option value="">Select Filter</option>
          {(Array.isArray(filtersMeta) ? filtersMeta : []).map((f) => (
            <option key={f.key_name} value={f.key_name}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          className="filter-operator"
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
        >
          <option value="=">EQUAL</option>
          <option value="LIKE">LIKE</option>
          <option value="!=">NOT EQUAL</option>
          <option value="<">SMALLER THAN</option>
          <option value=">">GREATER THAN</option>
          <option value="<=">SMALLER THAN EQUAL TO</option>
          <option value=">=">GREATER THAN EQUAL TO</option>
        </select>

        {selectedFilter && selectedFilter.options ? (
          <DropdownField
            label=""
            style={{ width: "100px" }}
            options={selectedFilter?.options?.map((opt) =>
              typeof opt === "string" ? { value: opt, title: opt } : opt
            )}
            isLocked={false}
            onChange={(val) => setValue(val)}
          />
        ) : selectedFilter && selectedFilter.api_url ? (
          <div className="filter-input-container">
            <InputSuggestions
              label=""
              apiUrl={baseURL + selectedFilter.api_url}
              onSelect={(val) => setValue(val.name || "")}
              showLabel={false}
              suggestionManadatory={false}
            />
          </div>
        ) : selectedFilter && selectedFilter.data_type === "date" ? (
          <input
            type="date"
            className="filter-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        ) : selectedFilter && selectedFilter.data_type === "time" ? (
          <input
            type="time"
            className="filter-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        ) : selectedFilter && selectedFilter.data_type === "number" ? (
          <input
            type="number"
            className="filter-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        ) : (
          <input
            type="text"
            className="filter-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter value"
          />
        )}

        <button className="filter-add" onClick={addFilter}>
          Add Filter
        </button>

        <select
          className="filter-combinator"
          value={combinator}
          onChange={(e) => setCombinator(e.target.value)}
        >
          <option value="AND">AND</option>
          <option value="OR">OR</option>
        </select>

        <button className="filter-search" onClick={handleSearch}>
          Search
        </button>
      </div>

      <div className="active-filters">
        {activeFilters?.map((f, i) => (
          <div key={i} className="filter-chip">
            {`${f.label} ${f.op} ${f.value}`}
            <span className="remove-filter" onClick={() => removeFilter(i)}>
              &times;
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FilterBar;

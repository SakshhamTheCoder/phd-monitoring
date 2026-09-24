import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import GridContainer from "../fields/GridContainer";
import InputField from "../fields/InputField";
import DateField from "../fields/DateField";
import DropdownField from "../fields/DropdownField";
import FileUploadField from "../fields/FileUploadField";
import InputSuggestions from "../fields/InputSuggestions";
import CounterField from "../fields/CounterField";
import Recommendation from "../layouts/Recommendation";
import TableComponent from "../table/TableComponent";
import CustomButton from "../fields/CustomButton";
import { formatDate } from "../../../utils/timeParse";
import { submitForm } from "../../../api/form";
import { toast } from "react-toastify";
import { useLoading } from "../../../context/LoadingContext";
import { baseURL } from "../../../api/urls";
import "./ServerPanel.css";

// One step's panel, drawn from the rows the server sends in `formData.view`
// (server/app/Forms). The server has already decided what this reader may edit
// and what an editor starts from; this only draws it with the form fields every
// other panel uses, and posts what was edited.

const display = (field) => (field.format === "date" ? formatDate(field.value) : field.value);

// A locked list reads as a one-column table.
const asRows = (entries) => (entries || []).map((entry) => ({ entry }));

// An entry left empty in a list someone can add to is dropped, not sent blank.
const isEmpty = (entry) => entry === null || entry === undefined || (typeof entry === "string" && !entry.trim());

// What is posted if nothing is touched: every open field as prefilled, except
// uploads (sent as files) and fields sent only once changed.
const editedValues = (rows) =>
  Object.fromEntries(
    rows
      .flatMap((row) => (row.kind === "grid" ? row.items : [row]))
      .filter((field) => field.key && field.locked === false && field.type !== "file" && field.send !== "changed")
      .map((field) => [field.key, field.value])
  );

const ServerPanel = ({ formData, rows = [], wrapped = true }) => {
  const location = useLocation();
  const { setLoading } = useLoading();
  const [values, setValues] = useState(() => editedValues(rows));
  const [files, setFiles] = useState({});

  const setValue = (key, value) => setValues((now) => ({ ...now, [key]: value }));
  const setEntry = (key, index, entry) =>
    setValues((now) => ({ ...now, [key]: now[key].map((current, at) => (at === index ? entry : current)) }));
  const toggle = (key, value) =>
    setValues((now) => ({
      ...now,
      [key]: now[key].includes(value) ? now[key].filter((pressed) => pressed !== value) : [...now[key], value],
    }));

  const growable = new Set(rows.filter((row) => row.kind === "list" && !row.fixed).map((row) => row.key));
  const submission = () =>
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, growable.has(key) ? value.filter((entry) => !isEmpty(entry)) : value])
    );

  const submit = (field) => {
    if (field.requires && (values[field.requires.key] === null || values[field.requires.key] === undefined)) {
      toast.error(field.requires.message);
      return undefined;
    }
    const extra = field.sends;
    const picked = Object.entries(files).map(([key, file]) => ({ key, file }));
    return submitForm({ ...submission(), ...extra }, location, setLoading, picked.length > 0 ? picked : null);
  };

  const renderField = (field) => {
    switch (field.type) {
      case "text":
        return (
          <InputField
            required={field.required}
            label={field.label}
            initialValue={field.locked ? display(field) : values[field.key]}
            isLocked={field.locked}
            hint={field.hint}
            onChange={field.locked ? undefined : (text) => setValue(field.key, text)}
          />
        );
      case "date":
        return (
          <DateField
            required={field.required}
            label={field.label}
            initialValue={display(field)}
            isLocked={field.locked}
            hint={field.hint}
            onChange={(date) => setValue(field.key, date)}
          />
        );
      case "counter":
        return (
          <CounterField
            label={field.label}
            initialValue={field.locked ? field.value : values[field.key]}
            isLocked={field.locked}
            onChange={(count) => setValue(field.key, count)}
          />
        );
      case "select":
        return (
          <DropdownField
            required={field.required}
            label={field.label}
            initialValue={field.value}
            isLocked={field.locked}
            options={field.options}
            onChange={(choice) => setValue(field.key, choice)}
          />
        );
      case "file":
        return (
          <FileUploadField
            required={field.required}
            label={field.label}
            showLabel={field.show_label !== false}
            maxSizeMB={field.max_mb}
            isLocked={field.locked}
            initialValue={field.value}
            onChange={(file) => setFiles((now) => ({ ...now, [field.key]: file }))}
          />
        );
      case "table":
        return (
          <TableComponent
            label={field.label}
            data={field.value}
            keys={field.columns.map((column) => column.key)}
            titles={field.columns.map((column) => column.title)}
          />
        );
      case "suggest":
        return (
          <InputSuggestions
            label={field.label}
            apiUrl={baseURL + field.source}
            fields={field.shows}
            initialValue={field.display}
            lock={field.locked}
            onSelect={(picked) => setValue(field.key, picked.id)}
          />
        );
      case "submit":
        return <CustomButton text={field.label} onClick={() => submit(field)} />;
      // "blank" is an empty cell holding the row's columns in place.
      default:
        return null;
    }
  };

  // Entries are numbered in their accessible name, when the list has one.
  const entryLabel = (field, index) => (field.item_label ? `${field.item_label} ${index + 1}` : undefined);

  const renderEntry = (field, entry, index) =>
    field.item === "suggest" ? (
      <InputSuggestions
        label={entryLabel(field, index)}
        apiUrl={baseURL + field.source}
        fields={field.shows}
        initialValue={field.displays?.[index]}
        lock={false}
        onSelect={(picked) => setEntry(field.key, index, picked.id)}
      />
    ) : (
      <InputField
        required={field.required}
        label={entryLabel(field, index)}
        showLabel={false}
        initialValue={entry}
        isLocked={field.locked}
        onChange={(text) => setEntry(field.key, index, text)}
      />
    );

  const renderList = (field) =>
    field.fixed ? (
      <GridContainer
        label={field.label}
        elements={values[field.key].map((entry, index) => renderEntry(field, entry, index))}
      />
    ) : field.locked && field.read_as !== "inputs" ? (
      <GridContainer
        elements={[
          <TableComponent
            label={field.label}
            data={asRows(field.value)}
            keys={["entry"]}
            titles={[field.column]}
          />,
        ]}
        space={3}
      />
    ) : (
      <>
        <GridContainer
          label={field.label}
          elements={field.addable ? [
            <CustomButton
              text={field.add_label}
              variant="secondary"
              size="sm"
              onClick={() => setValue(field.key, [...values[field.key], ""])}
            />,
          ] : []}
        />
        <GridContainer
          each={field.each}
          elements={(field.locked ? field.value : values[field.key]).map((entry, index) => renderEntry(field, entry, index))}
        />
        {field.note && <p className="form-note">{field.note}</p>}
      </>
    );

  // Pressed or not, each a button so a keyboard reaches it and a screen reader
  // hears its state.
  const renderToggles = (field) => (
    <GridContainer
      label={field.label}
      elements={field.options.map((option) => {
        const pressed = values[field.key].includes(option.value);
        return (
          <button
            type="button"
            key={option.value}
            onClick={() => toggle(field.key, option.value)}
            aria-pressed={pressed}
            className={`supervisor-box ${pressed ? "selected" : ""}`}
          >
            {option.title}
          </button>
        );
      })}
    />
  );

  // The shared recommendation block inside a panel that asks more; the panel's
  // own submit sends the choice, so the block draws no Submit of its own.
  const renderRecommendation = (field) => (
    <Recommendation
      formData={formData}
      role={field.role}
      allowRejection={field.allow_rejection}
      moreFields={true}
      handleRecommendationChange={(answer) =>
        setValues((now) => ({ ...now, approval: answer.approval, comments: answer.comments }))
      }
    />
  );

  const drawn = rows.map((row, index) =>
    row.kind === "recommendation" ? (
      <React.Fragment key={index}>{renderRecommendation(row)}</React.Fragment>
    ) : row.kind === "list" ? (
      <React.Fragment key={index}>{renderList(row)}</React.Fragment>
    ) : row.kind === "toggles" ? (
      <React.Fragment key={index}>{renderToggles(row)}</React.Fragment>
    ) : (
      <GridContainer
        key={index}
        label={row.label}
        space={row.space}
        each={row.each}
        elements={row.items.map(renderField)}
      />
    )
  );

  return wrapped ? <div>{drawn}</div> : <>{drawn}</>;
};

export default ServerPanel;

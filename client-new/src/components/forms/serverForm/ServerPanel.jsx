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
import RadioButtonGroup from "../fields/RadioButtonGroup";
import StatusNotice from "../../common/StatusNotice";
import PublicationsBlock from "./PublicationsBlock";
import TableComponent from "../table/TableComponent";
import CustomButton from "../fields/CustomButton";
import { formatDate } from "../../../utils/timeParse";
import { submitForm } from "../../../api/form";
import { toast } from "react-toastify";
import { useLoading } from "../../../context/LoadingContext";
import { baseURL } from "../../../api/urls";
import "./ServerPanel.css";

// One step's panel, drawn from the rows the server sends in `formData.view`
// (server/app/Forms/FormDefinition.php describes the shape). The server has
// already decided what this reader may edit and what an editor starts from;
// this only draws it with the form fields every other panel uses, and posts
// what was edited.

const display = (field) => (field.format === "date" ? formatDate(field.value) : field.value);

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

// A list drawn as a table has one column.
const asRows = (entries) => (entries || []).map((entry) => ({ entry }));

// An entry left empty in a list someone can add to is dropped, not sent blank.
// -1 is the placeholder the old panels put in a box nothing was picked for.
const isEmpty = (entry) =>
  entry === null || entry === undefined || entry === -1 || (typeof entry === "string" && !entry.trim());

// Every field in the rows, with groups opened.
const fieldsOf = (rows) =>
  rows.flatMap((row) => (row.kind === "grid" ? row.items : row.kind === "group" ? fieldsOf(row.rows) : [row]));

// What is posted if nothing is touched: every open field as prefilled, except
// uploads (sent as files) and fields sent only once changed. A recommendation
// seeds its recorded answer for every reader, since what it shows below it
// depends on that answer.
const editedValues = (rows) =>
  Object.fromEntries(
    fieldsOf(rows)
      .filter((field) => field.key && (field.locked === false || field.kind === "recommendation"))
      .filter((field) => field.type !== "file" && field.send !== "changed")
      .flatMap((field) => [
        [field.key, field.value],
        ...(field.sends_comments ? [["comments", field.comments]] : []),
      ])
  );

// Whether a submit's checks let it through; the first that fails is toasted.
const passes = (checks = [], values, files) => {
  const failed = checks.find((check) => {
    if (check.when && !values[check.when]) return false;
    return check.keys.some((key) => {
      if (check.check === "file") return !files[key];
      if (check.check === "truthy") return !values[key];
      return values[key] === null || values[key] === undefined;
    });
  });
  if (failed) toast.error(failed.message);
  return !failed;
};

// Whether a part is on the page for the answers as they stand (show_if).
const shows = (tests = [], values) =>
  tests.every((test) =>
    test.test === "above" ? parseFloat(values[test.key] || 0) > test.than : !!values[test.key]
  );

const ServerPanel = ({ formData, rows = [], wrapped = true }) => {
  const location = useLocation();
  const { setLoading } = useLoading();
  const [values, setValues] = useState(() => editedValues(rows));
  const [files, setFiles] = useState({});
  // What each field holds, answered or recorded, so a condition reads the same
  // for everyone who opens the form.
  const recorded = Object.fromEntries(fieldsOf(rows).filter((field) => field.key).map((field) => [field.key, field.value]));
  const answers = { ...recorded, ...values };

  const setValue = (key, value) => setValues((now) => ({ ...now, [key]: value }));
  const setEntry = (key, index, entry) =>
    setValues((now) => ({ ...now, [key]: now[key].map((current, at) => (at === index ? entry : current)) }));
  const toggle = (key, value) =>
    setValues((now) => ({
      ...now,
      [key]: now[key].includes(value) ? now[key].filter((pressed) => pressed !== value) : [...now[key], value],
    }));

  const growable = new Set(fieldsOf(rows).filter((field) => field.kind === "list" && !field.fixed).map((field) => field.key));
  const submission = () =>
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, growable.has(key) ? value.filter((entry) => !isEmpty(entry)) : value])
    );

  const submit = (field) => {
    if (!passes(field.requires, values, files)) return undefined;
    const picked = Object.entries(files).map(([key, file]) => ({ key, file }));
    return submitForm({ ...submission(), ...field.sends }, location, setLoading, picked.length > 0 ? picked : null);
  };

  // A capped number is set back to its cap, with a word why, once typed past it.
  const typeInto = (field, text) => {
    const number = parseFloat(text);
    if (field.max !== undefined && Number.isFinite(number) && number > field.max) {
      setValue(field.key, field.max);
      toast.error(field.max_message);
      return;
    }
    setValue(field.key, text);
  };

  const shownValue = (field) => {
    if (field.total_of) {
      return Number(field.total_of.base ?? NaN) + (parseFloat(answers[field.total_of.key]) || 0);
    }
    return field.locked ? display(field) : values[field.key];
  };

  const renderField = (field) => {
    if (field.show_if && !shows(field.show_if, answers)) return null;
    switch (field.type) {
      case "text":
        return (
          <InputField
            required={field.required}
            label={field.label}
            initialValue={shownValue(field)}
            isLocked={field.locked}
            hint={field.hint}
            onChange={field.locked ? undefined : (text) => typeInto(field, text)}
          />
        );
      case "radio":
        return (
          <RadioButtonGroup
            name={field.name}
            titles={field.options.map((option) => option.title)}
            values={field.options.map((option) => option.value)}
            defaultValue={values[field.key]}
            onSelect={(choice) => setValue(field.key, choice)}
          />
        );
      case "notice":
        return <StatusNotice tone={field.tone}>{field.text}</StatusNotice>;
      case "publications":
        return <PublicationsBlock formData={formData} field={field} />;
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
            initialValue={has(field, "display") ? field.display : field.value}
            isLocked={field.locked}
            options={field.options}
            // A select hands back text; a yes or no choice is kept as true or false.
            onChange={(choice) => setValue(field.key, field.boolean ? choice === "true" : choice)}
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
            components={field.columns
              .filter((column) => column.format === "title-case")
              .map((column) => ({
                key: column.key,
                component: ({ data }) => <span>{data ? data.replace(/\b\w/g, (c) => c.toUpperCase()) : data}</span>,
              }))}
          />
        );
      case "suggest":
        return (
          <InputSuggestions
            required={field.required}
            label={field.label}
            apiUrl={baseURL + field.source}
            fields={field.shows}
            body={field.params}
            hint={field.hint}
            suggestionManadatory={!field.free}
            initialValue={field.display}
            lock={field.locked}
            onSelect={(picked) => setValue(field.key, field.free ? picked?.name ?? picked ?? "" : picked.id)}
          />
        );
      case "submit":
        return <CustomButton text={field.label} onClick={() => submit(field)} />;
      // "blank" is an empty cell holding the row's columns in place.
      default:
        return null;
    }
  };

  // Entries are numbered in their accessible name and hint, when the list has one.
  const entryLabel = (field, index) => (field.item_label ? `${field.item_label} ${index + 1}` : undefined);
  const entryHint = (field, index) => field.item_hint?.replace("{n}", index + 1);

  const renderEntry = (field, entry, index) =>
    field.item === "suggest" ? (
      <InputSuggestions
        label={entryLabel(field, index)}
        showLabel={field.item_show_label !== false}
        apiUrl={baseURL + field.source}
        fields={field.shows}
        body={field.params}
        hint={entryHint(field, index)}
        suggestionManadatory={!field.free}
        initialValue={field.free ? entry : field.displays?.[index]}
        lock={field.locked}
        onSelect={(picked) => setEntry(field.key, index, field.free ? picked?.name : picked.id)}
      />
    ) : (
      <InputField
        required={field.required}
        label={entryLabel(field, index)}
        showLabel={false}
        initialValue={entry}
        isLocked={field.locked}
        hint={entryHint(field, index)}
        onChange={(text) => setEntry(field.key, index, text)}
      />
    );

  const addEntry = (field) => {
    if (field.max && values[field.key].length >= field.max) {
      toast.error(field.max_message);
      return;
    }
    setValue(field.key, [...values[field.key], ""]);
  };

  // The label row, with the add button where this reader may add. Some panels
  // kept an empty cell there when they may not.
  const renderAddRow = (field) => {
    const button = field.addable ? (
      <CustomButton text={field.add_label} variant="secondary" size="sm" onClick={() => addEntry(field)} />
    ) : null;
    return <GridContainer label={field.label} elements={field.keep_add_slot ? [button] : button ? [button] : []} />;
  };

  const renderList = (field) => {
    const entries = field.locked ? field.value : values[field.key];
    if (field.fixed) {
      return <GridContainer label={field.label} elements={entries.map((entry, index) => renderEntry(field, entry, index))} />;
    }
    const shownAs = field.as ?? (field.locked ? "table" : "inputs");
    if (shownAs === "table") {
      const table = field.table || {};
      return (
        <>
          {table.keep_add_row && renderAddRow(field)}
          <GridContainer
            elements={[
              <TableComponent
                label={table.labelled === false ? undefined : field.label}
                data={asRows(field.value)}
                keys={["entry"]}
                titles={[field.column]}
              />,
            ]}
            space={table.space ?? 3}
          />
        </>
      );
    }
    return (
      <>
        {renderAddRow(field)}
        <GridContainer each={field.each} elements={entries.map((entry, index) => renderEntry(field, entry, index))} />
        {field.note && <p className="form-note">{field.note}</p>}
      </>
    );
  };

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
      moreFields={field.more_fields !== false}
      title={field.title}
      isLocked={field.is_locked}
      handleRecommendationChange={(answer) =>
        setValues((now) => ({ ...now, approval: answer.approval, comments: answer.comments }))
      }
    />
  );

  const drawRows = (rowsToDraw) =>
    rowsToDraw.map((row, index) => {
      if (row.show_if && !shows(row.show_if, answers)) return null;
      switch (row.kind) {
        case "publications":
          return <PublicationsBlock key={index} formData={formData} field={row} />;
        case "recommendation":
          return <React.Fragment key={index}>{renderRecommendation(row)}</React.Fragment>;
        case "list":
          return <React.Fragment key={index}>{renderList(row)}</React.Fragment>;
        case "hidden":
          return null;
        case "toggles":
          return <React.Fragment key={index}>{renderToggles(row)}</React.Fragment>;
        // Kept on the page while hidden, so what was picked stays on screen.
        case "group":
          return (
            <div key={index} hidden={!answers[row.hidden_unless]}>
              {drawRows(row.rows)}
            </div>
          );
        default:
          return (
            <GridContainer
              key={index}
              label={row.label}
              space={row.space}
              each={row.each}
              elements={row.items.map(renderField)}
            />
          );
      }
    });

  const drawn = drawRows(rows);
  return wrapped ? <div>{drawn}</div> : <>{drawn}</>;
};

export default ServerPanel;

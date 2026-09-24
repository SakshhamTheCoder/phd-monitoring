import React, { Suspense, lazy, useEffect, useState } from "react";
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
import ToggleSwitch from "../fields/ToggleSwitch";
import StatusNotice from "../../common/StatusNotice";
import PublicationsBlock from "./PublicationsBlock";
import Recommender from "./Recommender";
import ExaminerList from "./ExaminerList";
import { badgeClass } from "../../../data/badges";

// Lazy because it brings react-datepicker and its stylesheet, which no other
// form needs.
const LeaveApplication = lazy(() => import("./LeaveApplication"));
import TableComponent from "../table/TableComponent";
import CustomButton from "../fields/CustomButton";
import { formatDate } from "../../../utils/timeParse";
import { submitForm } from "../../../api/form";
import { customFetch } from "../../../api/base";
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

// Whether a part is on the page for the answers as they stand (show_if).
const shows = (tests = [], values) =>
  tests.every((test) => {
    if (test.test === "above") return parseFloat(values[test.key] || 0) > test.than;
    if (test.test === "equals") return values[test.key] === test.than;
    if (test.test === "differs") return values[test.key] !== test.than;
    return !!values[test.key];
  });

// A list drawn as a table has one column.
const asRows = (entries) => (entries || []).map((entry) => ({ entry }));

// An entry left empty in a list someone can add to is dropped, not sent blank.
// -1 is the placeholder the old panels put in a box nothing was picked for.
const isEmpty = (entry) =>
  entry === null || entry === undefined || entry === -1 || (typeof entry === "string" && !entry.trim());

// Every field in the rows, with groups opened.
const fieldsOf = (rows) =>
  rows.flatMap((row) => (row.kind === "grid" ? row.items : row.kind === "group" ? fieldsOf(row.rows) : [row]));

// What is posted if nothing is touched: every open field as prefilled, and a
// locked one the view says is sent anyway, except uploads (sent as files) and
// fields sent only once changed. A recommendation
// seeds its recorded answer for every reader, since what it shows below it
// depends on that answer.
const editedValues = (rows) =>
  Object.fromEntries(
    fieldsOf(rows)
      .filter((field) => field.key && (field.locked === false || field.kind === "recommendation" || field.send === "always"))
      .filter((field) => field.type !== "file" && field.send !== "changed" && field.send !== "never")
      .flatMap((field) => [
        [field.key, field.value],
        ...(field.sends_comments ? [["comments", field.comments]] : []),
        ...(field.type === "decisions" ? [[field.rejects, field.rejected]] : []),
      ])
  );

// Whether a submit's checks let it through; the first that fails is toasted.
// A check with `if` applies only while those show_if tests pass.
const passes = (checks = [], values, files, answers = values) => {
  const failed = checks.find((check) => {
    if (check.when && !values[check.when]) return false;
    if (check.if && !shows(check.if, answers)) return false;
    return check.keys.some((key) => {
      if (check.check === "file") return !files[key];
      if (check.check === "truthy") return !values[key];
      if (check.check === "filled") return !`${values[key] ?? ""}`.trim();
      if (check.check === "number") return isNaN(Number(values[key]));
      if (check.check === "named") return !`${values[key] ?? ""}`.trim();
      return values[key] === null || values[key] === undefined;
    });
  });
  if (failed?.check === "named") {
    // Names every field left blank, not only the first.
    const missing = failed.keys.filter((key) => !`${values[key] ?? ""}`.trim()).map((key) => failed.names[key]);
    toast.error(failed.message + missing.join(", "));
  } else if (failed) {
    toast.error(failed.message);
  }
  return !failed;
};


// `host` carries what a page hosting the form adds: a submit path when the form
// is drawn away from its own route, and what to do after a reload or a delete.
// A dialog hosts it too: it takes the answers (submit), closes (onCancel) and
// says when its request is in flight (busy).
const ServerPanel = ({ formData, rows = [], wrapped = true, host = {} }) => {
  const location = useLocation();
  const { setLoading } = useLoading();
  const [values, setValues] = useState(() => editedValues(rows));
  const [files, setFiles] = useState({});
  // What each field holds, answered or recorded, so a condition reads the same
  // for everyone who opens the form.
  const recorded = Object.fromEntries(fieldsOf(rows).filter((field) => field.key).map((field) => [field.key, field.value]));
  const answers = { ...recorded, ...values };

  const setValue = (key, value) => setValues((now) => ({ ...now, [key]: value }));
  // A box past the end of a shorter list is filled in place, leaving gaps as
  // they were.
  const setEntry = (key, index, entry) =>
    setValues((now) => {
      const list = [...(now[key] || [])];
      list[index] = entry;
      return { ...now, [key]: list };
    });
  // What a search box in a list shows once something is picked into it, and
  // the box a pick from elsewhere last landed in.
  const [labels, setLabels] = useState({});
  const [landed, setLanded] = useState({});
  const labelOf = (field, picked) => (field.shows || ["name"]).map((part) => picked[part]).filter(Boolean).join(" - ");
  const toggle = (key, value) =>
    setValues((now) => ({
      ...now,
      [key]: now[key].includes(value) ? now[key].filter((pressed) => pressed !== value) : [...now[key], value],
    }));

  const growable = new Set(fieldsOf(rows).filter((field) => field.kind === "list" && !field.fixed).map((field) => field.key));
  const trimmed = new Set(fieldsOf(rows).filter((field) => field.trim).map((field) => field.key));
  const sending = Object.fromEntries(fieldsOf(rows).filter((field) => field.key && field.send).map((field) => [field.key, field.send]));
  const submission = () =>
    Object.fromEntries(
      Object.entries(values)
        // An optional value left empty is left out.
        .filter(([key, value]) => !(sending[key] === "filled" && !value))
        .map(([key, value]) => [
          key,
          growable.has(key) ? value.filter((entry) => !isEmpty(entry))
            : trimmed.has(key) ? `${value ?? ""}`.trim()
            : sending[key] === "null_if_empty" ? value || null
            // A yes or no not always answered: '' is not stated.
            : sending[key] === "yes_no" ? (value === "" ? null : value === "1")
            : value,
        ])
    );

  const submit = (field) => {
    if (!passes(field.requires, values, files, answers)) return undefined;
    if (host.submit) return host.submit(submission(), files, field);
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

  // Options a select reads from the server, by field key: once when the rows
  // are drawn, or again whenever the answer they depend on changes.
  const [fetchedOptions, setFetchedOptions] = useState({});
  const optionFields = fieldsOf(rows).filter((field) => field.options_from);
  const dependsOn = (field) => field.options_from.depends_on;
  const optionsKey = JSON.stringify(optionFields.map((field) => (dependsOn(field) ? answers[dependsOn(field)] ?? null : null)));
  useEffect(() => {
    let cancelled = false;
    optionFields.forEach((field) => {
      const { path, value, title } = field.options_from;
      if (dependsOn(field) && !answers[dependsOn(field)]) {
        setFetchedOptions((now) => ({ ...now, [field.key]: [] }));
        return;
      }
      customFetch(baseURL + path.replace(/\{(\w+)\}/g, (_, name) => answers[name] ?? ""), "GET", {}, !dependsOn(field)).then((res) => {
        if (cancelled || !res?.success) return;
        const options = (res.response?.data || []).map((entry) => ({
          value: entry[value],
          title: title.replace(/\{(\w+)\}/g, (_, name) => entry[name] ?? ""),
        }));
        setFetchedOptions((now) => ({ ...now, [field.key]: options }));
      });
    });
    return () => { cancelled = true; };
    // Read again only when an answer the options depend on changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey]);

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
            type={field.input_type}
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
      // Accept or Reject on each row, kept as two lists of row ids.
      case "decisions": {
        const accepted = values[field.key] || [];
        const rejected = values[field.rejects] || [];
        const decide = (id, choice) =>
          setValues((now) => {
            const without = (list) => (list || []).filter((item) => item !== id);
            const add = (list) => ((list || []).includes(id) ? list : [...(list || []), id]);
            if (choice === 1) return { ...now, [field.key]: add(now[field.key]), [field.rejects]: without(now[field.rejects]) };
            if (choice === 0) return { ...now, [field.rejects]: add(now[field.rejects]), [field.key]: without(now[field.key]) };
            return now;
          });
        return (
          <TableComponent
            data={field.rows}
            titles={[...field.columns.map((column) => column.title), field.choice_title]}
            keys={[...field.columns.map((column) => column.key), "decision"]}
            components={[
              {
                key: "decision",
                component: ({ row }) => (
                  <RadioButtonGroup
                    titles={["Accept", "Reject"]}
                    values={[1, 0]}
                    defaultValue={accepted.includes(row.id) ? 1 : rejected.includes(row.id) ? 0 : null}
                    onSelect={(choice) => decide(row.id, choice)}
                  />
                ),
              },
            ]}
          />
        );
      }
      case "notice":
        return <StatusNotice tone={field.tone}>{field.text}</StatusNotice>;
      // A tick box per option, keeping the values ticked.
      case "checks": {
        const ticked = values[field.key] || [];
        return (
          <div className={field.grid_class}>
            {field.options.length === 0 ? (
              <span className={field.empty_class}>{field.empty}</span>
            ) : (
              field.options.map((option) => {
                const chosen = ticked.includes(option.value);
                return (
                  <label key={option.value} className={`${field.class_name}${chosen ? " is-chosen" : ""}`}>
                    <input type="checkbox" checked={chosen} onChange={() => toggle(field.key, option.value)} />
                    <span>{option.parts ? option.parts.flatMap((part, at) => (at ? [" ", part] : [part])) : option.title}</span>
                  </label>
                );
              })
            )}
          </div>
        );
      }
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
      case "switch":
        return (
          <ToggleSwitch
            label={field.label}
            isOn={values[field.key]}
            onToggle={() => setValue(field.key, !values[field.key])}
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
            // A select whose options follow another answer starts over when
            // that answer changes.
            key={field.options_from?.depends_on ? String(answers[field.options_from.depends_on] ?? "") : undefined}
            required={field.required}
            label={field.label}
            initialValue={has(field, "display") ? field.display : field.value}
            isLocked={field.locked}
            options={field.options_from ? fetchedOptions[field.key] : field.options}
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
            onSelect={(picked) =>
              field.picks
                ? setValues((now) => {
                    const next = Object.fromEntries(Object.entries(field.picks).map(([key, from]) => [key, picked[from]]));
                    const changed = Object.entries(next).some(([key, value]) => String(now[key]) !== String(value));
                    const cleared = changed ? Object.fromEntries((field.clears || []).map((key) => [key, ""])) : {};
                    return { ...now, ...next, ...cleared };
                  })
                : setValue(field.key, field.free ? picked?.name ?? picked ?? "" : picked.id)
            }
          />
        );
      case "submit":
        // A send button that is only held off while sending shows no spinner.
        return field.held_while_sending ? (
          <CustomButton text={field.label} variant={field.variant} onClick={() => submit(field)} disabled={!!host.busy} />
        ) : (
          <CustomButton text={field.label} variant={field.variant} onClick={() => submit(field)} busy={host.busy} />
        );
      case "cancel":
        return (
          <CustomButton
            text={field.label}
            variant="quiet"
            onClick={host.onCancel}
            disabled={field.held_while_sending ? !!host.busy : undefined}
          />
        );
      // "blank" is an empty cell holding the row's columns in place.
      default:
        return null;
    }
  };

  // Entries are numbered in their accessible name and hint, when the list has one.
  const entryLabel = (field, index) => (field.item_label ? `${field.item_label} ${index + 1}` : undefined);
  const entryHint = (field, index) => field.item_hint?.replace("{n}", index + 1);

  // In a list that takes each pick once, the other boxes are not offered what
  // is already picked, and a pick of it is refused.
  const pickedElsewhere = (field, index) =>
    (values[field.key] || []).filter((code, at) => at !== index && code !== null && code !== undefined && code !== "");

  const pickInto = (field, index, picked) => {
    if (field.free) {
      setEntry(field.key, index, picked?.name ?? picked ?? "");
      return undefined;
    }
    if (field.unique && pickedElsewhere(field, index).includes(picked.id)) {
      toast.warn(field.unique_message);
      return false;
    }
    setEntry(field.key, index, picked.id);
    setLabels((now) => ({ ...now, [`${field.key}.${index}`]: labelOf(field, picked) }));
    return undefined;
  };

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
        initialValue={field.free ? entry : labels[`${field.key}.${index}`] ?? field.displays?.[index]}
        excludeIds={field.unique ? pickedElsewhere(field, index) : undefined}
        inputClassName={landed[field.key] === index ? "just-added" : undefined}
        lock={field.locked}
        onSelect={(picked) => pickInto(field, index, picked)}
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
      // A set number of boxes, however many answers there are yet, split into
      // rows where the list says so; the label heads the first.
      const count = field.slots ?? entries.length;
      const boxes = Array.from({ length: count }, (_, index) => renderEntry(field, entries[index], index));
      const perRow = field.per_row || count || 1;
      const rowsOfBoxes = [];
      for (let start = 0; start < Math.max(count, 1); start += perRow) rowsOfBoxes.push(boxes.slice(start, start + perRow));
      return (
        <>
          {rowsOfBoxes.map((rowBoxes, at) => (
            <GridContainer key={at} label={at === 0 ? field.label : undefined} elements={rowBoxes} space={field.row_space} />
          ))}
        </>
      );
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
      decision={field.decision}
      submitPath={host.submitPath}
      isLocked={field.is_locked}
      handleRecommendationChange={(answer) =>
        setValues((now) => ({ ...now, approval: answer.approval, comments: answer.comments }))
      }
    />
  );

  // A recommended match goes into the first empty box of the list it fills.
  const pickRecommended = (field, match) => {
    const target = fieldsOf(rows).find((candidate) => candidate.key === field.fills);
    const list = values[field.fills] || [];
    if (list.some((code) => code && code === match.faculty_code)) {
      toast.warn(target.unique_message);
      return;
    }
    const empty = list.findIndex((code) => !code);
    const index = empty === -1 ? 0 : empty;
    setEntry(field.fills, index, match.faculty_code);
    setLabels((now) => ({ ...now, [`${field.fills}.${index}`]: labelOf(target, match) }));
    setLanded((now) => ({ ...now, [field.fills]: index }));
    toast.info(field.picked.replace("{n}", index + 1).replace("{name}", match.name));
  };

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
        case "leave":
          return (
            <Suspense key={index} fallback={null}>
              <LeaveApplication field={row} onReload={host.onReload} onDraftDeleted={host.onDraftDeleted} />
            </Suspense>
          );
        // Label and value pairs read out, a value optionally as a badge.
        case "facts":
          return (
            <div key={index} className={row.class_name}>
              {row.facts.map((fact) => (
                <div key={fact.label} className={`${row.class_name}__row`}>
                  <span>{fact.label}</span>
                  <span className={fact.badge ? badgeClass(fact.value) : undefined}>{fact.value}</span>
                </div>
              ))}
            </div>
          );
        case "examiners": {
          const listOf = (key) => (row.locked ? recorded[key] : values[key]) || [];
          return (
            <ExaminerList
              key={index}
              field={row}
              entries={listOf(row.key)}
              setEntries={(change) => setValues((now) => ({ ...now, [row.key]: change(now[row.key] || []) }))}
              everyone={row.together.flatMap(listOf)}
            />
          );
        }
        case "recommender":
          return (
            <Recommender key={index} field={row} entries={values[row.from]} onPick={(match) => pickRecommended(row, match)} />
          );
        case "toggles":
          return <React.Fragment key={index}>{renderToggles(row)}</React.Fragment>;
        case "heading":
          return row.level === 3
            ? <h3 key={index} className="modal-title">{row.text}</h3>
            : <h2 key={index} className="modal-title">{row.text}</h2>;
        // What a dialog is about, read from the row it was opened on.
        case "lines":
          return (
            <div key={index} className={row.class_name}>
              {row.lines.map((line) => (
                <p key={line.label}><strong>{`${line.label}:`}</strong> {line.value}</p>
              ))}
            </div>
          );
        case "paragraph":
          return <p key={index} className={row.class_name}>{row.text}</p>;
        // A dialog's closing buttons.
        case "actions":
          return (
            <div key={index} className="modal-actions">
              {row.items.map((field, at) => <React.Fragment key={at}>{renderField(field)}</React.Fragment>)}
            </div>
          );
        // Kept on the page while hidden, so what was picked stays on screen.
        case "group":
          return (
            <div
              key={index}
              className={row.class_name}
              hidden={row.hidden_unless ? !answers[row.hidden_unless] : undefined}
            >
              {drawRows(row.rows)}
            </div>
          );
        default:
          // A field on a row of its own, as a stacked dialog draws them.
          if (!row.items) return <React.Fragment key={index}>{renderField(row)}</React.Fragment>;
          return (
            <GridContainer
              key={index}
              label={row.label}
              space={row.space}
              each={row.each}
              ratio={row.ratio}
              elements={row.items.map(renderField)}
            />
          );
      }
    });

  const drawn = drawRows(rows);
  return wrapped ? <div>{drawn}</div> : <>{drawn}</>;
};

export default ServerPanel;

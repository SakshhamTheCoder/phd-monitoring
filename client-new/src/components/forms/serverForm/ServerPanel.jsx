import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import GridContainer from "../fields/GridContainer";
import InputField from "../fields/InputField";
import DateField from "../fields/DateField";
import DropdownField from "../fields/DropdownField";
import FileUploadField from "../fields/FileUploadField";
import TableComponent from "../table/TableComponent";
import CustomButton from "../fields/CustomButton";
import { formatDate } from "../../../utils/timeParse";
import { submitForm } from "../../../api/form";
import { useLoading } from "../../../context/LoadingContext";

// One step's panel, drawn from the rows the server sends in `formData.view`
// (server/app/Forms). The server has already decided what this reader may edit
// and what an editor starts from; this only draws it with the form fields every
// other panel uses, and posts what was edited.

const display = (field) => (field.format === "date" ? formatDate(field.value) : field.value);

// A locked list reads as a one-column table.
const asRows = (entries) => (entries || []).map((entry) => ({ entry }));

// What is posted if nothing is touched: every open field as prefilled, except
// uploads (sent as files) and fields sent only once changed.
const editedValues = (rows) =>
  Object.fromEntries(
    rows
      .flatMap((row) => (row.kind === "grid" ? row.items : [row]))
      .filter((field) => field.key && field.locked === false && field.type !== "file" && field.send !== "changed")
      .map((field) => [field.key, field.value])
  );

const ServerPanel = ({ formData, rows = [] }) => {
  const location = useLocation();
  const { setLoading } = useLoading();
  const [values, setValues] = useState(() => editedValues(rows));
  const [files, setFiles] = useState({});

  const setValue = (key, value) => setValues((now) => ({ ...now, [key]: value }));
  const setEntry = (key, index, text) =>
    setValue(key, values[key].map((entry, at) => (at === index ? text : entry)));

  // A list box left empty is an entry dropped, not a blank one.
  const submission = () =>
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, Array.isArray(value) ? value.filter((text) => text?.trim()) : value])
    );

  const submit = () => {
    const picked = Object.entries(files).map(([key, file]) => ({ key, file }));
    return submitForm(submission(), location, setLoading, picked.length > 0 ? picked : null);
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
            initialValue={field.value}
            isLocked={field.locked}
            onChange={(date) => setValue(field.key, date)}
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
      case "submit":
        return <CustomButton text={field.label} onClick={submit} />;
      // "blank" is an empty cell holding the row's columns in place.
      default:
        return null;
    }
  };

  const renderList = (field) =>
    field.locked ? (
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
          elements={[
            <CustomButton
              text={field.add_label}
              variant="secondary"
              size="sm"
              onClick={() => setValue(field.key, [...values[field.key], ""])}
            />,
          ]}
        />
        <GridContainer
          each={field.each}
          elements={values[field.key].map((entry, index) => (
            <InputField
              required={field.required}
              label={`${field.item_label} ${index + 1}`}
              showLabel={false}
              initialValue={entry}
              isLocked={false}
              onChange={(text) => setEntry(field.key, index, text)}
            />
          ))}
        />
        {field.note && <p className="form-note">{field.note}</p>}
      </>
    );

  return (
    <div>
      {rows.map((row, index) =>
        row.kind === "list" ? (
          <React.Fragment key={index}>{renderList(row)}</React.Fragment>
        ) : (
          <GridContainer
            key={index}
            label={row.label}
            space={row.space}
            each={row.each}
            elements={row.items.map(renderField)}
          />
        )
      )}
    </div>
  );
};

export default ServerPanel;

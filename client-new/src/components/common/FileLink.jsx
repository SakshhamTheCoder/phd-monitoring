import React from "react";
import { FaFilePdf } from "react-icons/fa";
import { rootURL } from "../../api/urls";
import "./FileLink.css";

// Extensions we treat as viewable PDF/document files.
const DOC_RE = /\.(pdf|docx?|pptx?|xlsx?|odt|txt)$/i;

// True when a value looks like a stored PDF/doc path or URL.
export const isFilePath = (val) =>
  typeof val === "string" && DOC_RE.test(val.trim());

// Turn a stored path into a servable URL (mirrors FileUploadField).
export const fileUrlFrom = (val) => {
  const v = String(val).trim();
  if (/^https?:\/\//i.test(v)) return v;
  return rootURL + v.replace("app/public", "storage");
};

// Red PDF-icon link used wherever a document path is shown in a table.
const FileLink = ({ value, label = "View" }) => (
  <a
    className="file-cell-link"
    href={fileUrlFrom(value)}
    target="_blank"
    rel="noopener noreferrer"
    title="Open file"
    onClick={(e) => e.stopPropagation()}
  >
    <FaFilePdf className="file-cell-icon" />
    {label && <span>{label}</span>}
  </a>
);

export default FileLink;

import React from "react";
import { storedFileUrl, storedFileClick } from "../../api/fileAccess";
import "./FileLink.css";

// Extensions we treat as viewable PDF/document files.
const DOC_RE = /\.(pdf|docx?|pptx?|xlsx?|odt|txt)$/i;

// True when a value looks like a stored PDF/doc path or URL.
export const isFilePath = (val) =>
  typeof val === "string" && DOC_RE.test(val.trim());

// Red PDF-icon link used wherever a document path is shown in a table.
const FileLink = ({ value, label = "View" }) => (
  <a
    className="file-cell-link"
    href={storedFileUrl(value)}
    target="_blank"
    rel="noopener noreferrer"
    title="Open file"
    onClick={storedFileClick(value)}
  >
    <i className="fa fa-file-pdf-o file-cell-icon" aria-hidden="true" />
    {label && <span>{label}</span>}
  </a>
);

export default FileLink;

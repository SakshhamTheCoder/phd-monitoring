import React from "react";
import { FaFilePdf } from "react-icons/fa";
import { resolveFileUrl, openStoredFile } from "../../api/fileAccess";
import "./FileLink.css";

// Extensions we treat as viewable PDF/document files.
const DOC_RE = /\.(pdf|docx?|pptx?|xlsx?|odt|txt)$/i;

// True when a value looks like a stored PDF/doc path or URL.
export const isFilePath = (val) =>
  typeof val === "string" && DOC_RE.test(val.trim());

// Kept for callers that only need the URL string, not a click handler.
export const fileUrlFrom = (val) => resolveFileUrl(String(val).trim());

// Red PDF-icon link used wherever a document path is shown in a table. Private
// paths need a fetch carrying the bearer token, so the click is handled in JS
// rather than left to plain <a href> navigation.
const FileLink = ({ value, label = "View" }) => (
  <a
    className="file-cell-link"
    href={fileUrlFrom(value)}
    target="_blank"
    rel="noopener noreferrer"
    title="Open file"
    onClick={(e) => {
      e.stopPropagation();
      e.preventDefault();
      openStoredFile(String(value).trim());
    }}
  >
    <FaFilePdf className="file-cell-icon" />
    {label && <span>{label}</span>}
  </a>
);

export default FileLink;

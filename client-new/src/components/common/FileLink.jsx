import React from "react";
import { FaFilePdf } from "react-icons/fa";
import { resolveFileUrl, openStoredFile } from "../../api/fileAccess";
import "./FileLink.css";

// Extensions we treat as viewable PDF/document files.
const DOC_RE = /\.(pdf|docx?|pptx?|xlsx?|odt|txt)$/i;

// True when a value looks like a stored PDF/doc path or URL.
export const isFilePath = (val) =>
  typeof val === "string" && DOC_RE.test(val.trim());

export const fileUrlFrom = (val) => resolveFileUrl(String(val).trim());

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

import React, { useEffect, useState } from "react";
import "./FormList.css";
import { Link, useLocation } from "react-router-dom";
import { baseURL } from "../../../api/urls";
import { customFetch } from "../../../api/base";
import { useLoading } from "../../../context/LoadingContext";
import { parseDateTime } from "../../../utils/timeParse";
import { currentRole } from '../../../auth/access';
import LoadError from "../../common/LoadError";

const FormList = () => {
  const [forms, setForms] = useState([]);
  const { setLoading } = useLoading();
  const location = useLocation();
  const [role, setRole] = useState();
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // Bumped by "Try again" to run the load once more.
  const [attempt, setAttempt] = useState(0);
  // The page is reused across form types, so the old list is dropped and a
  // late answer for the previous path is ignored.
  useEffect(() => {
    let cancelled = false;
    setRole(currentRole());
    setForms([]);
    setLoaded(false);
    setLoadFailed(false);
    setLoading(true);
    const url = baseURL + location.pathname;

    customFetch(url, "GET").then((data) => {
      if (cancelled) return;
      if (data.success) setForms(data.response.data);
      else setLoadFailed(true);
      setLoaded(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, [location.pathname, setLoading, attempt]);

  const formPath = (form) => {
    let path = location.pathname;
    if (path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    return `${path}/${form.form_id ?? form.id}`;
  };

  if (loadFailed) {
    return (
      <LoadError
        message="Could not load your forms. Check your connection and try again."
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  }

  if (!loaded) return <p>Loading forms…</p>;

  return (
    <>
      {forms?.length > 0 ? (
        <div className="form-card-stack">
          {forms.map((form) => (
            <div
              key={form.id}
              className="form-card-list"
            >
              {/* Covers the whole card, so the card opens by click or keyboard.
                  It is a sibling of the fields rather than around them, because
                  the approved form's own link below cannot sit inside another. */}
              <Link
                to={formPath(form)}
                className="form-card-list-link"
                aria-label={`Open ${role === "student" ? "form" : `${form.name}'s form`} created ${parseDateTime(form.created_at)}`}
              />
              {form.completion === "incomplete" && (
                <span className="action-label-list"></span>
              )}
              {form.completion === "complete" && form.status === "accepted" && (
                <span className="action-label-list"></span>
              )}
              {form.completion === "complete" && form.status === "rejected" && (
                <span className="action-label-list"></span>
              )}
              {role === "student" ? (
                <>
                  {" "}
                  <p className="form-title">
                    <b>Stage:</b> <br /> {form.stage}
                  </p>
                  <p className="form-title">
                    <b>Status:</b> <br /> {form.status}
                  </p>
                  <p className="form-title">
                    <b>Created:</b> <br /> {parseDateTime(form.created_at)}
                  </p>
                  <p className="form-title">
                    <b>Updated:</b> <br /> {parseDateTime(form.updated_at)}
                  </p>
                </>
              ) : (
                <>
                  <p className="form-title">
                    <b>Name:</b> <br /> {form.name}
                  </p>
                  <p className="form-title">
                    <b>Stage:</b> <br /> {form.stage}
                  </p>
                  <p className="form-title">
                    <b>Status:</b> <br /> {form.status}
                  </p>
                  <p className="form-title">
                    <b>Created:</b> <br /> {parseDateTime(form.created_at)}
                  </p>
                  {form.completion === "complete" &&
                    form.status === "accepted" && (
                      <p className="form-title">
                        <b>Link:</b> <br /> <a href={form.link}>View Link</a>
                      </p>
                    )}
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p>No forms yet.</p>
      )}
    </>
  );
};

export default FormList;

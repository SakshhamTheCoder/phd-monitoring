import React, { useEffect, useState } from "react";
import "./FormList.css";
import { useLocation } from "react-router-dom";
import { baseURL } from "../../../api/urls";
import { customFetch } from "../../../api/base";
import { useLoading } from "../../../context/LoadingContext";
import { parseDateTime } from "../../../utils/timeParse";

const FormList = () => {
  const [forms, setForms] = useState([]);
  const { setLoading } = useLoading();
  const location = useLocation();
  const [role, setRole] = useState();
  useEffect(() => {
    setRole(localStorage.getItem("userRole"));
    setLoading(true);
    const url = baseURL + location.pathname;

    customFetch(url, "GET")
      .then((data) => {
        if (data && data.success) {
          setForms(data.response.data);
        }
      })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        setLoading(false); 
      });
  }, [location.pathname, setLoading]); 

  const handleClick = (form) => {
    let path = location.pathname;
    if (path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    if (form.form_id === undefined) form.form_id = form.id;
    const newUrl = `${path}/${form.form_id}`;
    window.location.href = newUrl;
  };

  return (
    <>
      {forms?.length > 0 ? (
        <div className="form-list-container">
          {forms.map((form) => (
            <div
              key={form.id}
              onClick={() => handleClick(form)}
              className="form-card-list"
            >
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
        <p>No forms to display</p>
      )}
    </>
  );
};

export default FormList;

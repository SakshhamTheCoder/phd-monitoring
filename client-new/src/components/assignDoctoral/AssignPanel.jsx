import { useEffect, useState } from "react";
import "./card.css";
import { customFetch } from "../../api/base";
import { baseURL } from "../../api/urls";
import InputSuggestions from "../forms/fields/InputSuggestions";
import { toast } from "react-toastify";

export default function AssignPanel({ roll_no }) {
  const [supervisor, setSupervisor] = useState({
    student_id: "",
    faculty_id: "",
  });
  const [doctoral, setDoctoral] = useState({ student_id: "", faculty_id: "" });

  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const apiUrl_suggestion = baseURL + "/suggestions/faculty";

  const handleChange = (e, type) => {
    const { name, value } = e.target;
    if (type === "supervisor") {
      setSupervisor({ ...supervisor, [name]: value });
    } else {
      setDoctoral({ ...doctoral, [name]: value });
    }
  };
  useEffect(() => {
    if (roll_no) {
      setSupervisor((prev) => ({ ...prev, student_id: roll_no }));
      setDoctoral((prev) => ({ ...prev, student_id: roll_no }));
    }
  }, [roll_no]);
  
  if (!roll_no) return "No Roll Number Provided";
  const handleSubmit = async (e, type) => {
    e.preventDefault();
    setErrors({});
    setMessage("");
    try {
        
      const data = type === "supervisor" ? supervisor : doctoral;
      const url =
        type === "supervisor"
          ? "/admin/allot-supervisor"
          : "/admin/allot-doctoral";
        data.student_id = roll_no;
      const res = customFetch(baseURL + url, "POST", data,true);
      if(res.success) {
        toast.success("Assigned successfully");
        alert("Assigned successfully")
      }
      else
      setMessage(res.response.message);
    
      if (type === "supervisor") {
        setSupervisor({ student_id: roll_no, faculty_id: "" });
      } else {
        setDoctoral({ student_id: roll_no, faculty_id: "" });
      }
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors || {});
      } else {
        setMessage(err.response?.data?.message || "Something went wrong");
      }
    }
  };

  return (
    <div className="assign-container">
      {message && (
        <div
          className={`assign-message ${
            message.includes("successfully") ? "success" : "error"
          }`}
        >
          {message}
        </div>
      )}

      <div className="assign-card">
        <h2>Assign Supervisor</h2>
        <form onSubmit={(e) => handleSubmit(e, "supervisor")}>
          <label className="assign-label">Student ID</label>
          <input
            type="number"
            name="student_id"
            value={roll_no}
            disabled={true}
            // onChange={(e) => handleChange(e, 'supervisor')}
            className="assign-input"
            required
          />
          {errors.student_id && (
            <p className="assign-error">{errors.student_id}</p>
          )}

          <label className="assign-label">Faculty ID</label>
          <InputSuggestions
            apiUrl={apiUrl_suggestion}
            onSelect={(value) =>
              handleChange(
                { target: { name: "faculty_id", value: value.id } },
                "supervisor"
              )
            }
            value={supervisor.faculty_id}
            fields={["name", "department"]}
            label={"Faculty"}
            name="faculty_id"
            required
          />

          {errors.faculty_id && (
            <p className="assign-error">{errors.faculty_id}</p>
          )}

          <button type="submit" className="assign-button">
            Assign Supervisor
          </button>
        </form>
      </div>

      <div className="assign-card">
        <h2>Assign Doctoral Committee</h2>
        <form onSubmit={(e) => handleSubmit(e, "doctoral")}>
          <label className="assign-label">Student ID</label>
          <input
            type="number"
            name="student_id"
            disabled={true}
            value={roll_no}
            className="assign-input"
            required
          />
          {errors.student_id && (
            <p className="assign-error">{errors.student_id}</p>
          )}

          <label className="assign-label">Faculty ID</label>
          <InputSuggestions
            apiUrl={apiUrl_suggestion}
            onSelect={(value) =>
                handleChange(
                    { target: { name: "faculty_id", value: value.id } },
                "doctoral"
              )}
            
            value={supervisor.doctoral_supervisor_id}
            fields={["name", "department"]}
            label={"Doctoral Supervisor"}
            name="doctoral_supervisor_id"
            required
          />

          {errors.faculty_id && (
            <p className="assign-error">{errors.faculty_id}</p>
          )}

          <button type="submit" className="assign-button green">
            Assign Doctoral
          </button>
        </form>
      </div>
    </div>
  );
}

import { toast } from "react-toastify";
import { customFetch, isNetworkError, NETWORK_ERROR_MESSAGE } from "./base";
import { baseURL } from "./urls";

export const submitForm = async (body, location, setLoading, files = null) => {
    setLoading(true);
    const url = baseURL + location.pathname;
    
  
    let formData

    // Append each file if provided
    if (files) {
        formData = new FormData();
        files.forEach((file) => {
            formData.append(file.key, file.file);
        });
  
        Object.keys(body).forEach((key) => {
            // FormData turns null into the string "null", which the server reads
            // as a value and rejects as "not a valid date" rather than missing.
            if (body[key] === null || body[key] === undefined) {
                return;
            }
            if (Array.isArray(body[key])) {
                body[key].forEach((item) => formData.append(`${key}[]`, item));
            } else if (typeof body[key] === "boolean") {
                // FormData sends "true", which Laravel's boolean rule refuses.
                // It takes "1" and "0", so send those.
                formData.append(key, body[key] ? "1" : "0");
            } else {
                formData.append(key, body[key]);
            }
        });
    }
    else{
        formData = body
    }


    // After a success the overlay stays up until the reload, so Submit cannot
    // be pressed a second time in the gap.
    let reloading = false;
    try {
        const data = await customFetch(url, "POST", formData, true, files !== null);
        if (data && data.success) {
            const completed = data.response && data.response.completed;
            // A step shared by several people answers 201 with what is still
            // outstanding ("moves on once every supervisor has approved"). That
            // is the message to show, not a flat "submitted".
            toast.success(completed ? "Form completed successfully" : (data.response?.message || "Form submitted successfully"));
            // Delay the reload so the toast is visible before the page refreshes.
            setTimeout(() => window.location.reload(), 1200);
            reloading = true;
        } else {
            // show validation errors if available
            if (data && data.response && data.response.errors) {
                const errorString = Object.values(data.response.errors).flat().join("\n");
                toast.error(errorString);
            } else if (data && data.response && data.response.message) {
                toast.error(data.response.message);
            } else {
                toast.error("Failed to submit the form");
            }
        }
    } catch (error) {
        toast.error(isNetworkError(error)
            ? NETWORK_ERROR_MESSAGE
            : "Failed to submit the form: " + (error.message || error));
    } finally {
        if (!reloading) setLoading(false);
    }
};

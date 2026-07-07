import { toast } from "react-toastify";
import { customFetch } from "./base";
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
            if (Array.isArray(body[key])) {
                body[key].forEach((item) => formData.append(`${key}[]`, item));
            } else {
                formData.append(key, body[key]);
            }
        });
    }
    else{
        formData = body
    }


    try {
        const data = await customFetch(url, "POST", formData, true, files !== null);
        if (data && data.success) {
            const completed = data.response && data.response.completed;
            toast.success(completed ? "Form completed successfully" : "Form submitted successfully");
            // Delay the reload so the toast is visible before the page refreshes.
            setTimeout(() => window.location.reload(), 1200);
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
            console.log("Form submission response:", data);
        }
    } catch (error) {
        toast.error("Failed to submit the form:" + (error.message || error));
        console.log(error);
    } finally {
        setLoading(false);
    }
};

import { toast } from "react-toastify";
import { baseURL } from "./urls";
import { customFetch } from "./base";

export const APIaddPublication = async (body, close, url = false) => {
    try {
        const formData = new FormData();
        Object.keys(body).forEach((key) => {
            formData.append(key, body[key]);
        });

        // customFetch with showToast=true handles error toasts
        const result = await customFetch(url ? baseURL + url : baseURL + "/publications", 'POST', formData, true, true);

        if (result.success) {
            toast.success("Publication added successfully.");
            if (close) close(true);
        }
    } catch (error) {
        console.error("APIaddPublication error:", error);
        toast.error("An error occurred: " + (error?.message || error.toString()));
    }
};

export const APIupdatePublication = async (id, body, close, url = false) => {
    try {
        const formData = new FormData();
        Object.keys(body).forEach((key) => {
            if (body[key] !== null && body[key] !== undefined) {
                formData.append(key, body[key]);
            }
        });

        formData.append('_method', 'PUT');

        const requestUrl = url ? baseURL + url + "/" + id : baseURL + "/publications/" + id;
        const result = await customFetch(requestUrl, 'POST', formData, true, true);

        if (result.success) {
            toast.success("Publication updated successfully.");
            if (close) close(true);
        }
    } catch (error) {
        console.error("APIupdatePublication error:", error);
        toast.error("An error occurred: " + (error?.message || error.toString()));
    }
};

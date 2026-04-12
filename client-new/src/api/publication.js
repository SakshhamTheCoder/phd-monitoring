import { toast } from "react-toastify";
import { baseURL } from "./urls";
import { customFetch } from "./base";

export const APIaddPublication = async (body,close,url=false) => {
    try {
        const formData = new FormData();
        Object.keys(body).forEach((key) => {
            formData.append(key, body[key]);
        });

        const result = await customFetch(url?baseURL+url:baseURL+"/publications", 'POST', formData, true, true);

        if (result.success) {
            toast.success("Publication added successfully.");
            if(close){
                close();
            }
        } else {
            toast.error("Failed to add publication.");
        }
    } catch (error) {
        toast.error(error);
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

        const targetURL = url ? baseURL + url + "/" + id : baseURL + "/publications/" + id;
        const result = await customFetch(targetURL, 'POST', formData, true, true);

        if (result.success) {
            toast.success("Publication updated successfully.");
            if (close) {
                close();
            }
        } else {
            toast.error("Failed to update publication.");
        }
    } catch (error) {
        toast.error(error);
    }
};

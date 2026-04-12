import { toast } from "react-toastify";

// In-memory cache store with timestamp
const cacheStore = new Map();
const CACHE_DURATION = 0 * 60 * 1000; // 5 minutes in milliseconds

export const customFetch = async (
  link,
  method = "GET",
  body = {},
  showToast = true,
  isFormData = false,
  useCache = true // cache toggle
) => {
  const cacheKey = `${method}:${link}:${isFormData ? "form" : JSON.stringify(body)}`;

  // Check if valid cached response exists
  if (useCache && method === "GET" && cacheStore.has(cacheKey)) {
    const { timestamp, data } = cacheStore.get(cacheKey);
    const now = Date.now();

    if (now - timestamp < CACHE_DURATION) {
      return { success: true, response: data };
    } else {
      cacheStore.delete(cacheKey); // Expired, remove from cache
    }
  }

  try {
    const options = {
      method,
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        Accept: "application/json",
      },
    };

    if (isFormData) {
      options.body = body;
    } else {
      options.headers["Content-Type"] = "application/json";
      if (method !== "GET" && method !== "HEAD") {
        options.body = JSON.stringify(body);
      }
    }

    const response = await fetch(link, options);

    if (response.ok) {
      const json = await response.json();
      if (useCache && method === "GET") {
        cacheStore.set(cacheKey, { data: json, timestamp: Date.now() });
      }
      return { success: true, response: json };
    } else {
      throw response;
    }

  } catch (error) {
    if (error instanceof Response) {
      try {
        const data = await error.json();

        if (error.status === 422) {
          if (showToast) toast.error(data.message);
        } else if (error.status === 401) {
          if (showToast) toast.error(data.error);
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = "/login";
        } else if (error.status === 500) {
          if (showToast)
            toast.error(data.message || data.error || "Internal server error");
        } else if (error.status === 400) {
          const errorString = Object.entries(data)
            .map(([key, val]) => `${key}: ${val}`)
            .join("\n");
          if (showToast) toast.error(errorString);
        } else {
          if (showToast) toast.error(data.message);
        }

        return { success: false, response: data };
      } catch (jsonError) {
        console.error("Error parsing JSON:", jsonError);
        return { success: false, response: jsonError };
      }
    } else {
      if (showToast) toast.error("Unexpected error: " + error);
      return { success: false, response: error };
    }
  }
};

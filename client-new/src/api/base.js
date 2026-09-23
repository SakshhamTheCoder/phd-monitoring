import { toast } from "react-toastify";

export const NETWORK_ERROR_MESSAGE =
  "Network unstable. Check your internet connection and try again.";

// fetch() rejects with a TypeError when the request never reached the server.
export const isNetworkError = (error) =>
  !navigator.onLine || error instanceof TypeError;

export const customFetch = async (
  link,
  method = "GET",
  body = {},
  showToast = true,
  isFormData = false
) => {
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
      return { success: true, response: await response.json() };
    } else {
      throw response;
    }

  } catch (error) {
    if (error instanceof Response) {
      // A gateway error page (502, 504) is HTML, so the body may not parse.
      // The status still decides what happens, a 401 above all.
      const data = await error.json().catch(() => null);

      if (error.status === 401) {
        if (showToast) toast.error(data?.error || "Your session has ended. Sign in again.");
        localStorage.clear();
        sessionStorage.clear();
        // Already there: navigating again reloads the page and repeats
        // whatever request just failed, forever.
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return { success: false, response: data || {} };
      }

      if (!data) {
        const message = error.status >= 500
          ? `The server did not respond properly (error ${error.status}). Try again in a moment.`
          : `The request failed (error ${error.status}).`;
        if (showToast) toast.error(message);
        return { success: false, response: { message } };
      }

      if (error.status === 422) {
        if (showToast) toast.error(data.message);
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
    } else if (isNetworkError(error)) {
      // Browser reports a failed fetch the same way for offline, DNS failure and a
      // dead server, so blame the connection rather than showing "Failed to fetch".
      if (showToast) toast.error(NETWORK_ERROR_MESSAGE, { toastId: "network-error" });
      return { success: false, response: error, networkError: true };
    } else {
      if (showToast) toast.error("Unexpected error: " + error);
      return { success: false, response: error };
    }
  }
};

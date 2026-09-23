import { toast } from "react-toastify";

export const NETWORK_ERROR_MESSAGE =
  "Network unstable. Check your internet connection and try again.";

// A failed request's toast, keyed by its text. The same failure from two
// requests at once (or a dev double mount) shows once, and a page that shows
// the failure in place can take the toast back with dismissRequestErrors.
const shownErrors = new Set();
const showError = (message, toastId = `request-error:${message}`) => {
  shownErrors.add(toastId);
  toast.error(message, { toastId });
};
export const dismissRequestErrors = () => {
  shownErrors.forEach((toastId) => toast.dismiss(toastId));
  shownErrors.clear();
};

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
        const { pathname, search } = window.location;
        if (pathname !== "/login") {
          window.location.href = `/login?next=${encodeURIComponent(pathname + search)}`;
        }
        return { success: false, response: data || {} };
      }

      if (!data) {
        const message = error.status >= 500
          ? `The server did not respond properly (error ${error.status}). Try again in a moment.`
          : `The request failed (error ${error.status}).`;
        if (showToast) showError(message);
        return { success: false, response: { message }, status: error.status };
      }

      if (error.status === 422) {
        if (showToast) showError(data.message);
      } else if (error.status === 500) {
        if (showToast)
          showError(data.message || data.error || "Internal server error");
      } else if (error.status === 400) {
        const errorString = Object.entries(data)
          .map(([key, val]) => `${key}: ${val}`)
          .join("\n");
        if (showToast) showError(errorString);
      } else {
        if (showToast) showError(data.message);
      }

      // The status lets a caller tell "not there" (404) from "could not ask".
      return { success: false, response: data, status: error.status };
    } else if (isNetworkError(error)) {
      // Browser reports a failed fetch the same way for offline, DNS failure and a
      // dead server, so blame the connection rather than showing "Failed to fetch".
      if (showToast) showError(NETWORK_ERROR_MESSAGE, "network-error");
      return { success: false, response: error, networkError: true };
    } else {
      if (showToast) showError("Unexpected error: " + error);
      return { success: false, response: error };
    }
  }
};

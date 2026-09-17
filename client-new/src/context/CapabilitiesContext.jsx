import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { baseURL } from '../api/urls';
import { customFetch } from '../api/base';

// What the acting role may do, from GET /my-roles.
//
// Used only to decide whether the UI offers an action. The API enforces the same
// capabilities on every request, so a stale or missing answer here costs a
// button, never access.
//
// One provider rather than a hook each page called for itself: the sidebar is
// always mounted and asks, and so did every page that wanted a capability, so
// /students and /users each made two identical requests on load.
//
// Cached in localStorage because the answer only changes when the role does;
// SwitchRole clears it.
const CACHE_KEY = 'capabilities';

const readCache = () => {
    try {
        return JSON.parse(localStorage.getItem(CACHE_KEY)) || null;
    } catch {
        return null;
    }
};

export const clearCapabilities = () => localStorage.removeItem(CACHE_KEY);

const CapabilitiesContext = createContext(null);

export const CapabilitiesProvider = ({ children }) => {
    const [capabilities, setCapabilities] = useState(readCache);

    useEffect(() => {
        let cancelled = false;

        // Signed out there is nothing to ask. The request answered 401, and the
        // 401 handler sent the login page to /login, which mounted this again.
        if (!localStorage.getItem('token')) return undefined;

        customFetch(`${baseURL}/my-roles`, 'GET', {}, false).then((data) => {
            if (cancelled || !data?.success) return;
            const fresh = data.response.capabilities || {};
            localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
            setCapabilities(fresh);
        });

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <CapabilitiesContext.Provider value={capabilities}>
            {children}
        </CapabilitiesContext.Provider>
    );
};

// Returns a stable `can(name)`. Unknown reads as false, so the UI stays closed
// until the answer arrives.
export const useCapabilities = () => {
    const capabilities = useContext(CapabilitiesContext);

    return useCallback(
        (name) => Boolean(capabilities?.[name]),
        [capabilities]
    );
};

// False until the answer has arrived at least once, for a page that must pick
// between two fetches rather than just hide a button.
export const useCapabilitiesKnown = () => useContext(CapabilitiesContext) !== null;

export default useCapabilities;

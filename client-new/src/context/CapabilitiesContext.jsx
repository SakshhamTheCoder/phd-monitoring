import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { baseURL } from '../api/urls';
import { customFetch } from '../api/base';
import { currentRole } from '../auth/access';

// What the acting role may do and reach, from GET /me (server:
// App\Support\Navigation and config/navigation.php): its capabilities, which
// areas of the portal it may open, and the sidebar, page names and home tiles
// to draw for it. The app reads the same answer, so the two cannot drift.
//
// The API still enforces everything on every request; this decides what the
// UI offers. One provider, so the sidebar and every page share one request.
//
// Cached in localStorage with the role it was for, because it changes only
// when the role does; SwitchRole clears it. A cached answer for another role
// is never used.
const CACHE_KEY = 'access';

const readCache = () => {
    try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        return cached && cached.current_role === currentRole() ? cached : null;
    } catch {
        return null;
    }
};

export const clearCapabilities = () => {
    localStorage.removeItem(CACHE_KEY);
    // The key the capabilities alone were kept under before /me.
    localStorage.removeItem('capabilities');
};

const CapabilitiesContext = createContext(null);
const AccessFailedContext = createContext(false);

export const CapabilitiesProvider = ({ children }) => {
    const [access, setAccess] = useState(readCache);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;

        // Signed out there is nothing to ask. The request answered 401, and the
        // 401 handler sent the login page to /login, which mounted this again.
        if (!localStorage.getItem('token')) return undefined;

        customFetch(`${baseURL}/me`, 'GET', {}, false).then((data) => {
            if (cancelled) return;
            if (!data?.success) {
                setFailed(true);
                return;
            }
            localStorage.setItem(CACHE_KEY, JSON.stringify(data.response));
            setAccess(data.response);
        });

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <CapabilitiesContext.Provider value={access}>
            <AccessFailedContext.Provider value={failed}>
            {children}
            </AccessFailedContext.Provider>
        </CapabilitiesContext.Provider>
    );
};

// Returns a stable `can(name)`. Unknown reads as false, so the UI stays closed
// until the answer arrives.
export const useCapabilities = () => {
    const access = useContext(CapabilitiesContext);

    return useCallback(
        (name) => Boolean(access?.capabilities?.[name]),
        [access]
    );
};

// False until the answer has arrived at least once, for a page that must pick
// between two fetches rather than just hide a button.
export const useCapabilitiesKnown = () => useContext(CapabilitiesContext) !== null;

// Areas, sidebar, page names and home tiles for the acting role. `known` is
// false until the answer for this role has arrived.
export const useAccess = () => {
    const access = useContext(CapabilitiesContext);
    const failed = useContext(AccessFailedContext);

    return useMemo(() => ({
        known: access !== null,
        // No answer could be had and none was cached.
        failed: access === null && failed,
        may: (area) => Boolean(access?.areas?.[area]),
        nav: access?.nav || [],
        labels: access?.labels || {},
        tiles: access?.tiles || [],
    }), [access, failed]);
};

export default useCapabilities;

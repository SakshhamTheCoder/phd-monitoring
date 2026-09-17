import React, { createContext, useContext, useEffect, useState } from 'react';
import { baseURL } from '../api/urls';
import { customFetch } from '../api/base';

// Everything defaults to on, and a failed request leaves it that way. The
// switch exists to take a module out deliberately, so a slow or unreachable
// API must never be the thing that hides one.
const DEFAULTS = { project_management: true, job_openings: true };

// The last answer the API gave, so a reload starts from it rather than from
// DEFAULTS. Without this every reload drew the nav with every module on, then
// removed the ones that are off a moment later, and the switched-off items
// visibly flashed in and out.
//
// Still only a starting point: the request below runs regardless and replaces
// this, so turning a module off reaches everyone on their next load.
const CACHE_KEY = 'features';

const readCache = () => {
    try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        return cached && typeof cached === 'object' ? { ...DEFAULTS, ...cached } : DEFAULTS;
    } catch {
        return DEFAULTS;
    }
};

const FeaturesContext = createContext(DEFAULTS);

export const useFeatures = () => useContext(FeaturesContext);

export const FeaturesProvider = ({ children }) => {
    const [features, setFeatures] = useState(readCache);

    useEffect(() => {
        let cancelled = false;

        customFetch(`${baseURL}/features`, 'GET', {}, false).then(({ success, response }) => {
            if (!success || !response || cancelled) return;
            localStorage.setItem(CACHE_KEY, JSON.stringify(response));
            setFeatures({ ...DEFAULTS, ...response });
        });

        return () => {
            cancelled = true;
        };
    }, []);

    return <FeaturesContext.Provider value={features}>{children}</FeaturesContext.Provider>;
};

import React, { createContext, useContext, useEffect, useState } from 'react';
import { baseURL } from '../api/urls';
import { customFetch } from '../api/base';

// Everything defaults to on, and a failed request leaves it that way. The
// switch exists to take a module out deliberately, so a slow or unreachable
// API must never be the thing that hides one.
const DEFAULTS = { research_profile: true, project_management: true, job_openings: true };

const FeaturesContext = createContext(DEFAULTS);

export const useFeatures = () => useContext(FeaturesContext);

export const FeaturesProvider = ({ children }) => {
    const [features, setFeatures] = useState(DEFAULTS);

    useEffect(() => {
        let cancelled = false;

        customFetch(`${baseURL}/features`, 'GET', {}, false).then(({ success, response }) => {
            if (success && response && !cancelled) {
                setFeatures({ ...DEFAULTS, ...response });
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    return <FeaturesContext.Provider value={features}>{children}</FeaturesContext.Provider>;
};

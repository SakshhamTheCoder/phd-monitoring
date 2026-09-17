import React, { createContext, useContext, useMemo, useState } from "react";

const LoadingContext = createContext();

export const useLoading = () => useContext(LoadingContext);

export const LoadingProvider = ({ children }) => {
    const [loading, setLoading] = useState(false);

    // A fresh object each render re-rendered every consumer, and this provider
    // wraps the whole application.
    const value = useMemo(() => ({ loading, setLoading }), [loading]);

    return (
        <LoadingContext.Provider value={value}>
            {children}
        </LoadingContext.Provider>
    );
};

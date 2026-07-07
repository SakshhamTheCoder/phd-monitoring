import React, { useState, useEffect, useRef } from 'react';
import { customFetch } from '../../../api/base';
import "./Fields.css";

const InputSuggestions = ({ apiUrl, hint, initialValue, onSelect, label, lock = false, showLabel = true, body, suggestionManadatory = true, fields=["name"], required = false}) => {
    const [inputValue, setInputValue] = useState(initialValue || '');
    const [suggestions, setSuggestions] = useState([]);
    const [isLocked, setIsLocked] = useState(lock || false);
    const [hintText, setHintText] = useState(hint || 'Type to get suggestions...');
    const [showHint, setShowHint] = useState(true);
    const [userSelected, setUserSelected] = useState(false);
    const [loading, setLoading] = useState(false);

    const containerRef = useRef(null);
    const abortControllerRef = useRef(null);
    const cacheRef = useRef({});  // Caching previous results
    const debounceTimeout = useRef(null);

    const handleInputChange = (event) => {
        const value = event.target.value;
        setInputValue(value);
        setShowHint(true);
        setUserSelected(false);

        if (value) {
            if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

            debounceTimeout.current = setTimeout(() => {
                fetchSuggestions(value);
            }, 300);
        } else {
            setSuggestions([]);
        }
    };

    const fetchSuggestions = async (value) => {
        if (cacheRef.current[value]) {
            setSuggestions(cacheRef.current[value]);
            return;
        }
    
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;
    
        const finalBody = body ? { ...body, text: value } : { text: value };
        console.log("Final body for suggestions:", finalBody);
        try {
            setLoading(true);
            const data = await customFetch(apiUrl, 'POST', finalBody, false);
            setLoading(false);
    
            if (data && data.success) {
                const fetchedSuggestions = data.response || [];
                cacheRef.current[value] = fetchedSuggestions;
                setSuggestions(fetchedSuggestions);
            } else {
                setSuggestions([]);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Fetch error:', error);
            }
            setLoading(false);
        }
    };
    
useEffect(() => {
    if(initialValue){
        setInputValue(initialValue);
        setShowHint(false);
    }
},[initialValue] )
    const handleSuggestionClick = (suggestion) => {
        setShowHint(false);
        setUserSelected(true);
        setInputValue(renderSuggestionText(suggestion));
        setSuggestions([]);
        if (onSelect) {
            onSelect(suggestion); 
        }
    };

    const handleBlur = (event) => {
        if (!containerRef.current.contains(event.relatedTarget)) { // Check if the newly focused element is outside the component
            console.log("hiii",event,inputValue)
            if (!suggestionManadatory) {
                setSuggestions([]);
                setShowHint(false);
                setUserSelected(true);
                onSelect({ name: inputValue, id: inputValue });
                console.log("Clicked outside, suggestions hidden", inputValue);
            }
        }
    };
    const renderSuggestionText = (suggestion) => {
        return fields.map(field => suggestion[field] || '').join(' - ');
    };

    return (
        <div 
            className="input-suggestions-container" 
            ref={containerRef}
            tabIndex={-1}  // This makes the div focusable, allowing onBlur to work correctly
            onBlur={handleBlur}
        >
            <div className="input-field-container">
                {showLabel && (<label className="input-label">{label}{required && <span style={{ color: 'red', marginLeft: '4px' }}>*</span>}</label>)}
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder={hintText}
                    className="input-field"
                    disabled={isLocked}
                />
            </div>

            {inputValue && (
                <ul className="suggestions-list">
                    {loading && (
                        <li className="suggestion-item loading">Loading...</li>
                    )}
                    {!loading && suggestions.length > 0 && suggestions.map((suggestion) => (
                        <li
                            key={suggestion.id}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="suggestion-item"
                        >
                              {renderSuggestionText(suggestion)}
                        </li>
                    ))}
                    {!loading && suggestions.length === 0 && showHint && (
                        <li className="suggestion-item no-suggestions-message">No suggestions available</li>
                    )}
                </ul>
            )}
        </div>
    );
};

export default InputSuggestions;

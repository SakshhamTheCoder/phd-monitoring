import React, { useEffect, useId, useRef, useState } from 'react';
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
    // The list used to render purely on `inputValue`, so once a field had text its
    // dropdown stayed mounted for good — sitting over the field below and
    // swallowing that field's clicks. It must not outlive focus.
    const [isFocused, setIsFocused] = useState(false);
    // The suggestion the arrow keys are on, -1 for none. Hover moves it too, so
    // the mouse and the keyboard always agree on which row Enter would pick.
    const [activeIndex, setActiveIndex] = useState(-1);

    const fieldId = useId();
    const containerRef = useRef(null);
    const listRef = useRef(null);
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
    
useEffect(() => { setActiveIndex(-1); }, [suggestions]);

// Keep the highlighted row in view when the arrows walk past the list's edge.
useEffect(() => {
    listRef.current?.querySelectorAll('.suggestion-item')[activeIndex]?.scrollIntoView({ block: 'nearest' });
}, [activeIndex]);

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

    const handleKeyDown = (event) => {
        const count = suggestions.length;
        if (event.key === 'ArrowDown' && count) {
            event.preventDefault();
            setActiveIndex((i) => (i + 1) % count);
        } else if (event.key === 'ArrowUp' && count) {
            event.preventDefault();
            setActiveIndex((i) => (i <= 0 ? count - 1 : i - 1));
        } else if (event.key === 'Enter' && activeIndex >= 0 && activeIndex < count) {
            // Only swallow Enter when it picks a row, so it still submits otherwise.
            event.preventDefault();
            handleSuggestionClick(suggestions[activeIndex]);
        } else if (event.key === 'Escape') {
            setSuggestions([]);
        }
    };

    const handleBlur = (event) => {
        if (!containerRef.current.contains(event.relatedTarget)) { // Check if the newly focused element is outside the component
            // Always close on the way out. Whether the typed text is committed as a
            // free-text value still depends on suggestionManadatory, but that is a
            // separate question from whether the dropdown stays on screen.
            setIsFocused(false);
            setSuggestions([]);
            // Only text typed since the last pick is free text. Committing on every
            // blur replaced a row already chosen with its own label as the id.
            if (!suggestionManadatory && !userSelected) {
                setShowHint(false);
                setUserSelected(true);
                onSelect({ name: inputValue, id: inputValue });
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
                {showLabel && (<label className="input-label" htmlFor={fieldId}>{label}{required && <span className="req" aria-hidden="true">*</span>}</label>)}
                <input
                    id={fieldId}
                    aria-required={required || undefined}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setIsFocused(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={isLocked && !inputValue ? 'Not provided' : hintText}
                    className="input-field"
                    disabled={isLocked}
                />
            </div>

            {isFocused && inputValue && (loading || suggestions.length > 0 || showHint) && (
                <ul
                    className="suggestions-list"
                    ref={listRef}
                    // Keep focus in the input while a row is pressed. Otherwise the
                    // input blurs first, and a free-text picker commits what was
                    // typed ("CHED") in place of the row that was clicked.
                    onMouseDown={(event) => event.preventDefault()}
                >
                    {loading && (
                        <li className="suggestion-item loading">Loading...</li>
                    )}
                    {!loading && suggestions.length > 0 && suggestions.map((suggestion, index) => (
                        <li
                            key={suggestion.id}
                            aria-selected={index === activeIndex}
                            onMouseEnter={() => setActiveIndex(index)}
                            // Keep focus on the input: without this the input blurs on
                            // mousedown, the list unmounts, and the click never lands.
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className={`suggestion-item${index === activeIndex ? ' active' : ''}`}
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

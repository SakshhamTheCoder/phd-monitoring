import React from 'react';
import "./Fields.css";

// `each` spans every element the same number of columns, for a row that is a
// list of like items (objectives, keywords). `space` widens only the first
// element, which is right for a row of different fields and made a list
// uneven: one wide item, then narrow ones.
const GridContainer = ({ elements, space = 1, ratio = [], label = "", each }) => {
    return (
        <div className="grid-container-wrapper">
            {label && <div className="grid-label">{label}</div>}
            {elements?.length > 0 && <div className="grid-container">
                {elements.map((element, index) => (
                    <div
                        key={index}
                        className={`grid-item ${each ? `span-${each}` : ratio[index] ? `span-${ratio[index]}` : (index === 0 ? `span-${space}` : '')}`}
                    >
                        {element}
                    </div>
                ))}
            </div>}
        </div>
    );
};

export default GridContainer;

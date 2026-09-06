import React from 'react';
import "./Fields.css";

const GridContainer = ({ elements, space = 1, ratio = [], label = "" }) => {
    return (
        <div className="grid-container-wrapper">
            {label && <div className="grid-label">{label}</div>}
            <div className="grid-container">
                {elements.map((element, index) => (
                    <div
                        key={index}
                        className={`grid-item ${ratio[index] ? `span-${ratio[index]}` : (index === 0 ? `span-${space}` : '')}`}
                    >
                        {element}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GridContainer;

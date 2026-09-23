import React from 'react';
import './TableComponent.css';
import FileLink, { isFilePath } from '../../common/FileLink';

// `leading`, when given, draws a column before S.No, such as a row's selection
// tick box. It and each `components[].component` are called as plain render
// functions rather than used as component types: callers define them inline,
// so as types they would be new on every render and remount every cell,
// dropping focus and local state. They must not call hooks for that reason.
const TableComponent = ({ data, keys, titles, components = [], rowStyle, label, leading = null }) => {
    // Create a dictionary from components for easy lookup
    const componentMap = components.reduce((acc, comp) => {
        acc[comp.key] = comp.component;
        return acc;
    }, {});

    return (
        <div className="table-container">
            {label && <h3 className="table-label" style={{ textAlign: 'left', fontWeight: 'bold' }}>{label}</h3>}
            <table className="custom-table">
                <thead>
                    <tr className="table-header">
                        {leading && <th></th>}
                        <th>S.No</th>
                        {titles?.map((title, index) => (
                            <th key={index}>{title}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data?.map((row, index) => (
                        <tr key={index} style={rowStyle ? rowStyle(row) : {}}>
                            {leading && <td>{leading({ row })}</td>}
                            <td>{index + 1}</td> {/* S.No */}
                            {keys?.map((key, keyIndex) => {
                                const value = row[key];
                                const renderCell = componentMap[key];

                                return (
                                    <td key={keyIndex}>
                                        {renderCell ? (
                                            renderCell({ row, data: value })
                                        ) : isFilePath(value) ? (
                                            <FileLink value={value} />
                                        ) : (
                                            typeof value === 'string' && value.startsWith('http') ? (
                                                <a href={value} target="_blank" rel="noopener noreferrer">link</a>
                                            ) : (
                                                value
                                            )
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TableComponent;

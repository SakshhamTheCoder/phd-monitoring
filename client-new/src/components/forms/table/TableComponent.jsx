import React from 'react';
import './TableComponent.css';
import FileLink, { isFilePath } from '../../common/FileLink';

// `leading`, when given, is a component drawn in a column before S.No, such as
// a row's selection tick box.
const TableComponent = ({ data, keys, titles, components = [], rowStyle, label, leading: Leading = null }) => {
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
                        {Leading && <th></th>}
                        <th>S.No</th>
                        {titles?.map((title, index) => (
                            <th key={index}>{title}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data?.map((row, index) => (
                        <tr key={index} style={rowStyle ? rowStyle(row) : {}}>
                            {Leading && <td><Leading row={row} /></td>}
                            <td>{index + 1}</td> {/* S.No */}
                            {keys?.map((key, keyIndex) => {
                                const value = row[key];
                                const CustomComponent = componentMap[key];

                                return (
                                    <td key={keyIndex}>
                                        {CustomComponent ? (
                                            <CustomComponent row={row} data={value} /> // Pass the row and data
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

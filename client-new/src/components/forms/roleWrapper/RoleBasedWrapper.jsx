import React from 'react';

const RoleBasedWrapper = ({ roleHierarchy, currentRole, children }) => {
    const currentRoleIndex = roleHierarchy.indexOf(currentRole);

    return (
        <>
            {React.Children.toArray(children).map((child, index) => {
                if (!React.isValidElement(child)) return null;

                // roleHierarchy is formData.steps, an ordered workflow sequence, not a role hierarchy
                if (index <= currentRoleIndex || currentRole === "admin") {
                    return child;
                }

                return null;
            })}
        </>
    );
};

export default RoleBasedWrapper;

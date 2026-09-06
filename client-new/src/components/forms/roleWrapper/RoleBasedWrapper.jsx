import React from 'react';

const RoleBasedWrapper = ({ roleHierarchy, currentRole, children }) => {
    const currentRoleIndex = roleHierarchy.indexOf(currentRole);

    return (
        <>
            {React.Children.toArray(children).map((child, index) => {
                if (!React.isValidElement(child)) return null;

                console.log(index,currentRoleIndex,currentRole)
                if (index <= currentRoleIndex || currentRole === "admin") {
                    return child; // Render the component if allowed by role hierarchy
                }

                return null;
            })}
        </>
    );
};

export default RoleBasedWrapper;

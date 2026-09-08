import React, { useEffect, useState } from 'react'
import GridContainer from '../forms/fields/GridContainer'
import DropdownField from '../forms/fields/DropdownField'
import { useLoading } from '../../context/LoadingContext';
import { toast } from 'react-toastify';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import {getRoleName} from '../../utils/roleName';
const SwitchRole = () => {
    const [body, setBody] = useState({});
    const { setLoading } = useLoading();
    const [roles, setRoles] = useState([]);

    // localStorage holds whatever the last login returned. A role granted since
    // then is missing from it, and the user cannot pick a role the dropdown does
    // not list, so re-read the roles from the server on mount.
    useEffect(() => {
        const toOptions = (list) => (list || []).map((rol) => ({ title: getRoleName(rol), value: rol }));

        setRoles(toOptions(JSON.parse(localStorage.getItem("available_roles")) || []));

        customFetch(`${baseURL}/my-roles`, "GET", {}, true).then((data) => {
            if (!data?.success) return;
            const fresh = data.response.available_roles || [];
            localStorage.setItem("available_roles", JSON.stringify(fresh));
            setRoles(toOptions(fresh));
        });
    }, [])

   const setRole=(role) => {
        // Ignore the empty "Select" placeholder — switching to "" is rejected by the
        // backend with a 401, which the fetch layer treats as a session expiry and logs
        // the user out. Also skip switching to the role that's already active.
        if (!role) return;
        if (role === localStorage.getItem("userRole")) return;
        setLoading(true);
        const url = `${baseURL}/switch-role`;
        customFetch(url, "POST",{role:role}).then((data) => {
            if (data && data.success) {
                localStorage.setItem("user", JSON.stringify(data.response.user));
                localStorage.setItem("userRole", data.response.user.role.role);
                toast.success("Role switched successfully");
                // Broadcast the change so the header, notifications and any listening
                // view re-fetch for the newly-active role — no full page reload needed.
                window.dispatchEvent(new Event("rolechange"));
            } else {
                console.error("No data found or unauthorized access.");
            }
            setLoading(false);
        });
    }
    
    return (
        <div style={{color:"black"}}>
            <h2 className="section-heading">Switch Role</h2>
            <GridContainer elements={[
                <DropdownField
                    label="Role"
                    options={roles}
                    onChange={(value)=>{
                        setRole(value);

                    }} 
                />
            ]} space={2}/>
        
        </div>
    )
}
export default SwitchRole;
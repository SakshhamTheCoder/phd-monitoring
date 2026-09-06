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

    const available_roles= JSON.parse(localStorage.getItem("available_roles")) || [];
    
    useEffect(() => {
        const rls=[]
        available_roles.forEach(rol => {
            let tt={
                title:getRoleName( rol),
                value:rol
            }
            rls.push(tt);
        });
        setRoles(rls);
        console.log(roles);
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
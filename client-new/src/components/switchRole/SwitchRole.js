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
        setLoading(true);
        const url = `${baseURL}/switch-role`;
        customFetch(url, "POST",{role:role}).then((data) => {
            if (data && data.success) {
                localStorage.setItem("user", JSON.stringify(data.response.user));
                localStorage.setItem("userRole", data.response.user.role.role);
                toast.success("Role switched successfully");
                // Reload so notifications, the dashboard and forms re-fetch for the
                // newly-active role instead of showing the previous role's data.
                setTimeout(() => window.location.reload(), 600);
                return;
            }
            console.error("No data found or unauthorized access.");
            setLoading(false);
        });
    }
    
    return (
        <div style={{color:"black"}}>
            <h1 style={{fontSize:"24px"}}>Switch Role</h1>
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
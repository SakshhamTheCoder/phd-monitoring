import { customFetch } from "./base"
import { ENDPOINTS } from "./urls"

export const loginAPI = async (email, password, captchaToken) => {
    const result = await customFetch(ENDPOINTS.LOGIN,"POST",{
        email: email,
        password: password,
        captcha_token: captchaToken
    });
  
    if(result && result.success){
        localStorage.setItem("token",result.response.token);
        localStorage.setItem("userRole",result.response.user.role.role);
        localStorage.setItem("available_roles",JSON.stringify(result.response.available_roles));
        localStorage.setItem("user",JSON.stringify(result.response.user));
        return { success: true };
    }
    
    // `unverified` is the one refusal the user can clear themselves.
    return { 
        success: false, 
        error: result?.response?.error || result?.response?.message || 'Login failed',
        unverified: result?.response?.unverified === true,
        email: result?.response?.email
    };
}

export const logoutAPI = async () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    localStorage.removeItem("available_roles");
    localStorage.removeItem("user");
    // Both caches are read on the next mount to avoid a flash. Capabilities
    // belong to the role that just signed out, so leaving them would draw the
    // previous role's menu for whoever signs in next on this browser.
    localStorage.removeItem("capabilities");
    localStorage.removeItem("features");
    return true;
}
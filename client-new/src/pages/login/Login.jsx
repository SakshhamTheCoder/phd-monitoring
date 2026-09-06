import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { loginAPI } from "../../api/login";
import { CLOUDFLARE_SITE_KEY, rootURL } from "../../api/urls";
import Loader from "../../components/loader/loader";
import { toast } from "react-toastify";

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const { register, handleSubmit } = useForm();

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      window.location.href = "/home";
    }

    return () => {
      // Cleanup if needed
    };
  }, []);

  // Separate effect for Turnstile - only render when email form is shown
  useEffect(() => {
    if (!showEmailForm) return;

    let widgetId = null;

    // Wait for Turnstile to be available and render widget
    const renderWidget = () => {
      if (window.turnstile) {
        const container = document.getElementById('turnstile-container');
        if (container && !container.hasChildNodes()) {
          try {
            widgetId = window.turnstile.render('#turnstile-container', {
              sitekey: CLOUDFLARE_SITE_KEY,
              theme: 'light',
              callback: (token) => {
                setCaptchaToken(token);
              },
            });
          } catch (error) {
            console.error('Turnstile render error:', error);
          }
        }
      } else {
        // Retry if turnstile is not loaded yet
        setTimeout(renderWidget, 100);
      }
    };

    const timer = setTimeout(renderWidget, 100);

    // Cleanup function
    return () => {
      clearTimeout(timer);
      if (widgetId !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch (error) {
          console.error('Turnstile cleanup error:', error);
        }
      }
    };
  }, [showEmailForm]);

  // Handle Google Sign-In with popup (more reliable than FedCM)
  const handleGoogleSignIn = () => {
    setLoading(true);
    
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    // Open Google OAuth popup
    const googleAuthUrl = rootURL+`/api/google/redirect`;
    const popup = window.open(
      googleAuthUrl,
      'Google Sign In',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Set a timeout to stop loading if no response after 60 seconds
    const timeout = setTimeout(() => {
      setLoading(false);
      window.removeEventListener('message', messageListener);
      toast.error('Google Sign-In timed out. Please try again.');
    }, 60000);

    // Listen for messages from the popup
    const messageListener = (event) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        clearTimeout(timeout);
        window.removeEventListener('message', messageListener);
        
        // Store the auth data
        localStorage.setItem('token', event.data.token);
        localStorage.setItem('userRole', event.data.user.role.role);
        localStorage.setItem('available_roles', JSON.stringify(event.data.available_roles));
        localStorage.setItem('user', JSON.stringify(event.data.user));
        
        // Redirect to appropriate page
        const onLogin = new URLSearchParams(window.location.search).get("onLogin");
        if (onLogin) {
          window.location.href = onLogin;
        } else {
          window.location.href = "/home";
        }
      } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
        clearTimeout(timeout);
        window.removeEventListener('message', messageListener);
        setLoading(false);
        
        toast.error(event.data.error || 'Google login failed');
      }
    };

    window.addEventListener('message', messageListener);

    // Check if popup was blocked
    if (!popup) {
      clearTimeout(timeout);
      setLoading(false);
      window.removeEventListener('message', messageListener);
      toast.error('Popup was blocked. Please allow popups for this site.');
    }
  };

  // Define the onSubmit function
  const onSubmit = async (data) => {
    setLoading(true);

    const result = await loginAPI(data.email, data.password, captchaToken);
    
    if (result.success) {
      const onLogin = new URLSearchParams(window.location.search).get(
        "onLogin"
      );
      if (onLogin) {
        window.location.href = onLogin;
      } else {
        window.location.href = "/home";
      }
    } else {
      setLoading(false);
      toast.error(result.error || 'Invalid credentials');
      
      // Reset captcha
      setCaptchaToken(null);
      if (window.turnstile) {
        try {
          window.turnstile.reset();
        } catch (error) {
          console.error('Turnstile reset error:', error);
        }
      }
    }
  };

  return (
    <>
      {loading && <Loader />}
      <div
        className="tw-bg-cover tw-bg-center tw-h-screen tw-flex tw-items-center tw-justify-center"
        style={{ backgroundImage: "url('/image-1@2x.png')" }}
      >
        <div className="tw-bg-white tw-p-8 tw-rounded-lg tw-shadow-lg tw-w-full tw-max-w-md sm:tw-p-6 sm:tw-max-w-sm xs:tw-p-4 xs:tw-max-w-xs">
          <img
            src="/images/tiet_logo.png"
            alt="TIETLogo"
            className="tw-mx-auto tw-mb-6 tw-w-24 sm:tw-w-20 xs:tw-w-16"
          />
          
          {/* Google Sign-In Button */}
          <div className="tw-flex tw-flex-col tw-items-center tw-mb-3">
            <button
              onClick={handleGoogleSignIn}
              className="tw-bg-white tw-border-2 tw-border-gray-300 tw-text-gray-700 tw-px-6 tw-py-3 tw-rounded-md tw-font-semibold hover:tw-bg-gray-50 hover:tw-border-gray-400 tw-duration-200 tw-w-full tw-max-w-[350px] tw-flex tw-items-center tw-justify-center tw-gap-3"
            >
              <svg className="tw-w-5 tw-h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
          </div>

          {/* Sign in with Email Button */}
          {!showEmailForm && (
            <div className="tw-flex tw-justify-center tw-mt-3">
              <button
                onClick={() => setShowEmailForm(true)}
                className="tw-bg-white tw-border-2 tw-border-gray-300 tw-text-gray-700 tw-px-6 tw-py-3 tw-rounded-md tw-font-semibold hover:tw-bg-gray-50 hover:tw-border-gray-400 tw-duration-200 tw-w-full tw-max-w-[350px] tw-flex tw-items-center tw-justify-center tw-gap-3"
              >
                <svg className="tw-w-5 tw-h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                </svg>
                Sign in with Email & Password
              </button>
            </div>
          )}

          {/* Email/Password Form - shown when button is clicked */}
          {showEmailForm && (
            <>
              <div className="tw-flex tw-items-center tw-justify-center tw-mt-4">
                <span className="tw-border-t tw-border-gray-600 tw-flex-grow"></span>
                <span className="tw-px-4 tw-text-gray-700 tw-text-sm">Or sign in with email</span>
                <span className="tw-border-t tw-border-gray-600 tw-flex-grow"></span>
              </div>
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="tw-space-y-4 tw-mt-5"
              >
                <div className="tw-relative">
                  <input
                    {...register("email")}
                    id="email"
                    type="email"
                    placeholder=""
                    className="tw-peer tw-bg-opacity-50 tw-px-4 tw-pt-6 tw-pb-2.5 tw-w-full tw-rounded tw-border tw-border-slate-600 tw-text-black focus:tw-ring-2 focus:tw-ring-white tw-outline-none invalid:tw-border-red-500"
                  />
                  <label
                    htmlFor="email"
                    className="tw-absolute tw-text-slate-500 tw-left-3 tw-duration-300 tw-scale-75 tw-top-1 peer-placeholder-shown:tw-scale-100 peer-placeholder-shown:tw-top-4 peer-focus:tw-left-3 peer-focus:tw-scale-75 peer-focus:tw-top-1"
                  >
                    Email
                  </label>
                </div>
                <div className="tw-relative">
                  <input
                    {...register("password")}
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder=""
                    className="tw-peer tw-bg-opacity-50 tw-px-4 tw-pt-6 tw-pb-2.5 tw-pr-12 tw-w-full tw-rounded tw-border tw-border-slate-600 tw-text-black focus:tw-ring-2 focus:tw-ring-white tw-outline-none invalid:tw-border-red-500"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="tw-absolute tw-right-3 tw-top-1/2 tw-text-gray-600 hover:tw-text-gray-800 focus:tw-outline-none"
                    style={{ transform: 'translateY(-50%)' }}
                  >
                    {showPassword ? (
                      <i className="fa fa-eye-slash"></i>
                    ) : (
                      <i className="fa fa-eye"></i>
                    )}
                  </button>

                  <label
                    htmlFor="password"
                    className="tw-absolute tw-text-slate-500 tw-left-3 tw-duration-300 tw-scale-75 tw-top-1 peer-placeholder-shown:tw-scale-100 peer-placeholder-shown:tw-top-4 peer-focus:tw-left-3 peer-focus:tw-scale-75 peer-focus:tw-top-1"
                  >
                    Password
                  </label>
                </div>
                <div className="tw-flex tw-items-center tw-justify-between">
                  <Link
                    to="/forgot-password"
                    className="tw-text-brand hover:tw-underline"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="tw-flex tw-justify-center tw-my-4">
                  <div id="turnstile-container"></div>
                </div>

                <button
                  type="submit"
                  className="tw-bg-brand tw-w-4/5 tw-mx-auto tw-block tw-text-center tw-text-white tw-py-2 tw-rounded-md tw-font-bold hover:tw-bg-brand-hover tw-duration-200"
                >
                  Login
                </button>
              </form>
            </>
          )}
          
          {/* Footer Links */}
          <div className="tw-mt-6 tw-pt-4 tw-border-t tw-border-gray-200 tw-flex tw-flex-wrap tw-justify-center tw-gap-4 tw-text-sm">
            <Link
              to="/privacy"
              className="tw-text-gray-600 hover:tw-text-brand hover:tw-underline"
            >
              Privacy Policy
            </Link>
            <span className="tw-text-gray-400">|</span>
            <Link
              to="/support"
              className="tw-text-gray-600 hover:tw-text-brand hover:tw-underline"
            >
              Support
            </Link>
            <span className="tw-text-gray-400">|</span>
            <Link
              to="/team"
              className="tw-text-gray-600 hover:tw-text-brand hover:tw-underline"
            >
              Team
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;

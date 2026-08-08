import React, { useState, useEffect } from 'react';
import { useForm } from "react-hook-form";
import { customFetch } from '../../api/base';
import { baseURL, CLOUDFLARE_SITE_KEY } from '../../api/urls';
import { toast } from 'react-toastify';


const ForgotPasswordPage = () => {
    const { register, handleSubmit } = useForm();
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [captchaToken, setCaptchaToken] = useState(null);

    useEffect(() => {
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

        // Cleanup function to remove widget when component unmounts
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
    }, []);

    const onSubmit = async (data) => {
        setLoading(true);
        const response = await customFetch(baseURL+"/forgot-password", "POST", {
            ...data,
            captcha_token: captchaToken
        });
        setLoading(false);

        if (response && response.success) {
            toast.success(response.message || 'Password reset link sent successfully!');
            setMessage(response.message);
        } else if (response && response.error) {
            toast.error(response.error || 'Failed to send reset link');
        }

        // Reset captcha
        setCaptchaToken(null);
        if (window.turnstile) {
            try {
                window.turnstile.reset();
            } catch (error) {
                console.error('Turnstile reset error:', error);
            }
        }
    };

    return (
        <div
        className="tw-bg-cover tw-bg-center tw-h-screen tw-flex tw-items-center tw-justify-center"
        style={{ backgroundImage: "url('/image-1@2x.png')" }}
      >
            <form onSubmit={handleSubmit(onSubmit)} className="tw-bg-white tw-p-8 tw-rounded tw-shadow-md tw-w-full tw-max-w-sm">
                <img
                    src="/images/tiet_logo.png"
                    alt="TIETLogo"
                    className="tw-mx-auto tw-mb-4 tw-w-24 sm:tw-w-20 xs:tw-w-16"
                />
                <h2 className="tw-text-xl tw-font-semibold tw-mb-4 tw-text-center">Forgot Password</h2>
                <div className="tw-mb-4">
                    <label htmlFor="email" className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-2">
                        Email
                    </label>
                    <input
                        {...register("email")}
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        required
                        className="tw-w-full tw-px-4 tw-py-2 tw-border tw-rounded"
                    />
                </div>
                
                <div className="tw-flex tw-justify-center tw-my-4">
                    <div id="turnstile-container"></div>
                </div>

                <button
                    type="submit"
                    className="tw-w-full tw-bg-brand tw-text-white tw-py-2 tw-rounded hover:tw-bg-brand-hover"
                    disabled={loading}
                >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
                {message && (
                    <div className="tw-mt-4 tw-p-3 tw-bg-green-50 tw-border tw-border-green-200 tw-rounded">
                        <p className="tw-text-sm tw-text-green-800 tw-text-center">{message}</p>
                    </div>
                )}
            </form>
        </div>
    );
};

export default ForgotPasswordPage;

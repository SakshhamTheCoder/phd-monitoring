import React, { useState, useEffect } from 'react';
import { useForm } from "react-hook-form";
import { customFetch, NETWORK_ERROR_MESSAGE } from '../../api/base';
import { baseURL } from '../../api/urls';
import { toast } from 'react-toastify';
import { mountTurnstile } from '../login/turnstile';


const ForgotPasswordPage = () => {
    const { register, handleSubmit } = useForm();
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [captchaToken, setCaptchaToken] = useState(null);

    useEffect(() => mountTurnstile(setCaptchaToken), []);

    const onSubmit = async (data) => {
        setLoading(true);
        // Toast off: this endpoint answers 422 with `errors` or `error` and no
        // `message`, which customFetch would show as an empty toast.
        const response = await customFetch(baseURL+"/forgot-password", "POST", {
            ...data,
            captcha_token: captchaToken
        }, false);
        setLoading(false);

        const body = response.response;
        if (response.success) {
            const sent = body?.message || 'Password reset link sent successfully!';
            toast.success(sent);
            setMessage(sent);
        } else if (response.networkError) {
            toast.error(NETWORK_ERROR_MESSAGE);
        } else {
            const fieldError = body?.errors && Object.values(body.errors).flat()[0];
            toast.error(body?.message || body?.error || fieldError || 'Failed to send reset link');
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
        className="tw-bg-cover tw-bg-center tw-min-h-screen tw-flex tw-items-center tw-justify-center tw-p-4"
        style={{ backgroundImage: "url('/image-1@2x.png')" }}
      >
            <form onSubmit={handleSubmit(onSubmit)} className="tw-bg-white tw-p-8 tw-rounded tw-shadow-md tw-w-full tw-max-w-sm">
                <img
                    src="/images/tiet_logo.png"
                    alt="TIETLogo"
                    className="tw-mx-auto tw-mb-4 tw-w-24 sm:tw-w-20"
                />
                <h2 className="tw-text-xl tw-font-semibold tw-mb-4 tw-text-center">Forgot Password</h2>
                <div className="tw-mb-4">
                    <label className="tw-block tw-text-sm tw-font-medium tw-text-gray-700 tw-mb-2" htmlFor="forgot-password-page-email">
                        Email
                    </label>
                    <input
                        {...register("email")}
                        id="forgot-password-page-email"
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

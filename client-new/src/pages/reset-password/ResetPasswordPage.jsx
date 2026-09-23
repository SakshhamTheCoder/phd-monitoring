import React from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import Loader from "../../components/loader/loader";
import { customFetch } from "../../api/base";
import { baseURL } from "../../api/urls";
import { toast } from "react-toastify";
// import { resetPasswordAPI } from "../../api/resetPassword"; // You need to implement this

const ResetPasswordPage = () => {
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const { register, handleSubmit, watch } = useForm({
    defaultValues: {
      email: email || ""
    }
  });

 
  const onSubmit = async (data) => {
    // Enter in a field submits again while the first request is in flight.
    if (loading) return;
    setLoading(true);
    // The email comes from the link. The field showing it is disabled, and a
    // disabled field is left out of the form's data, so the request went without
    // one and was refused.
    const response = await customFetch(baseURL + "/reset-password", "POST", {
        token,
        email,
        password: data.password,
        password_confirmation: data.confirmPassword,
      });

    setLoading(false);
    // customFetch has already shown the server's reason. This used to report
    // success for any answer at all, refusals included, and leave for /login.
    if (!response.success) return;

    toast.success("Password reset. Sign in with the new password.");
    // In-app, so the toast is still on screen when sign in opens.
    navigate("/login");
  };

  return (
    <>
      {loading && <Loader />}
      <div className="tw-bg-cover tw-bg-center tw-min-h-screen tw-flex tw-items-center tw-justify-center tw-p-4"
           style={{ backgroundImage: "url('/image-1@2x.png')" }}>
        <div className="tw-bg-white tw-p-8 tw-rounded-lg tw-shadow-lg tw-w-full tw-max-w-md">
          <img src="/images/tiet_logo.png" alt="TIETLogo"
               className="tw-mx-auto tw-mb-4 tw-w-24"/>
          <h2 className="tw-text-xl tw-font-bold tw-text-center tw-mb-4">Reset Password</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="tw-space-y-4">
            <input {...register("email")} type="email" placeholder="Email" aria-label="Email" className="tw-w-full tw-p-2 tw-border tw-rounded tw-bg-gray-100" disabled value={email || ""} />
            
            <div className="tw-relative">
              <input 
                {...register("password")} 
                type={showPassword ? "text" : "password"} 
                placeholder="New Password" 
                aria-label="New password"

                className="tw-w-full tw-p-2 tw-border tw-rounded tw-pr-10" 
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="tw-absolute tw-right-2 tw-top-1/2 tw-transform -tw-translate-y-1/2 tw-text-gray-600 hover:tw-text-gray-800"
              >
                {showPassword ? (
                  <i className="fa fa-eye-slash"></i>
                ) : (
                  <i className="fa fa-eye"></i>
                )}
              </button>
            </div>

            <div className="tw-relative">
              <input 
                {...register("confirmPassword")} 
                type={showConfirmPassword ? "text" : "password"} 
                placeholder="Confirm Password" 
                aria-label="Confirm new password"

                className="tw-w-full tw-p-2 tw-border tw-rounded tw-pr-10" 
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                className="tw-absolute tw-right-2 tw-top-1/2 tw-transform -tw-translate-y-1/2 tw-text-gray-600 hover:tw-text-gray-800"
              >
                {showConfirmPassword ? (
                  <i className="fa fa-eye-slash"></i>
                ) : (
                  <i className="fa fa-eye"></i>
                )}
              </button>
            </div>

            <button type="submit" disabled={loading} className="tw-bg-brand tw-text-white tw-py-2 tw-rounded tw-w-full hover:tw-bg-brand-hover">
              Reset Password
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default ResetPasswordPage;

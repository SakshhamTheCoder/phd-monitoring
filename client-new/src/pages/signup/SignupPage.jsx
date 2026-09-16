import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import Loader from '../../components/loader/loader';
import { apiUrfDepartments, apiUrfResendVerification, apiUrfSignup } from '../../api/urf';
import { CLOUDFLARE_SITE_KEY } from '../../api/urls';

const YEARS = [
  { value: 1, label: '1st Year' },
  { value: 2, label: '2nd Year' },
  { value: 3, label: '3rd Year' },
  { value: 4, label: '4th Year' },
];

const field = 'tw-w-full tw-rounded tw-border tw-border-slate-400 tw-px-3 tw-py-2 tw-text-black focus:tw-ring-2 focus:tw-ring-brand tw-outline-none';

const Field = ({ id, label, error, children }) => (
  <div>
    <label htmlFor={id} className="tw-block tw-text-sm tw-text-gray-700 tw-mb-1">{label}</label>
    {children}
    {error && <p className="tw-text-red-600 tw-text-xs tw-mt-1">{error}</p>}
  </div>
);

/**
 * Sign-up for undergraduates applying to the URF. Everyone else is given an
 * account by an admin, so this asks only for what a fellowship application
 * needs and hands the student on to the confirmation email.
 */
const SignupPage = () => {
  const { register, handleSubmit } = useForm();
  const [branches, setBranches] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [sentTo, setSentTo] = useState(null);

  useEffect(() => {
    apiUrfDepartments().then((res) => res.success && setBranches(res.response));
  }, []);

  // The same widget the login page mounts, while the form is on screen.
  useEffect(() => {
    if (sentTo) return undefined;
    let widgetId = null;
    const renderWidget = () => {
      if (!window.turnstile) {
        setTimeout(renderWidget, 100);
        return;
      }
      const container = document.getElementById('turnstile-container');
      if (container && !container.hasChildNodes()) {
        widgetId = window.turnstile.render('#turnstile-container', {
          sitekey: CLOUDFLARE_SITE_KEY,
          theme: 'light',
          callback: setCaptchaToken,
        });
      }
    };
    const timer = setTimeout(renderWidget, 100);
    return () => {
      clearTimeout(timer);
      if (widgetId !== null && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [sentTo]);

  const onSubmit = async (data) => {
    setLoading(true);
    setErrors({});
    const result = await apiUrfSignup({ ...data, captcha_token: captchaToken });
    setLoading(false);

    if (result.success) {
      setSentTo(data.email);
      return;
    }

    // A 422 names the field it refused, so each message sits under its input.
    const refused = result.response?.errors;
    if (refused) {
      setErrors(Object.fromEntries(Object.entries(refused).map(([key, messages]) => [key, messages[0]])));
      toast.error('Check the highlighted fields.');
    } else {
      toast.error(result.response?.error || result.response?.message || 'Could not create the account.');
    }
    setCaptchaToken(null);
    if (window.turnstile) window.turnstile.reset();
  };

  const resend = async () => {
    const result = await apiUrfResendVerification(sentTo);
    toast.info(result.response?.message || 'The link is on its way.');
  };

  return (
    <>
      {loading && <Loader />}
      <div
        className="tw-bg-cover tw-bg-center tw-min-h-screen tw-flex tw-items-center tw-justify-center tw-py-8"
        style={{ backgroundImage: "url('/image-1@2x.png')" }}
      >
        <div className="tw-bg-white tw-p-8 tw-rounded-lg tw-shadow-lg tw-w-full tw-max-w-2xl sm:tw-p-6">
          <img src="/images/tiet_logo.png" alt="TIET Logo" className="tw-mx-auto tw-mb-4 tw-w-20" />

          {sentTo ? (
            <div className="tw-text-center">
              <h1 className="tw-text-xl tw-font-semibold tw-mb-2">Confirm your email</h1>
              <p className="tw-text-gray-700">
                We sent a link to <strong>{sentTo}</strong>. Open it to finish creating your
                account, then sign in and apply.
              </p>
              <div className="tw-mt-6 tw-flex tw-justify-center tw-items-center tw-gap-4">
                <Link to="/login" className="tw-bg-brand tw-text-white tw-px-5 tw-py-2 tw-rounded-md tw-font-bold hover:tw-bg-brand-hover">
                  Go to sign in
                </Link>
                <button type="button" onClick={resend} className="tw-text-brand hover:tw-underline">
                  Send the link again
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="tw-text-xl tw-font-semibold tw-text-center">Create your URF account</h1>
              <p className="tw-text-sm tw-text-gray-600 tw-text-center tw-mt-1 tw-mb-6">
                For undergraduates applying to the Undergraduate Research Fellowship. PhD scholars
                are given an account by the office.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-4">
                <Field id="first_name" label="First name" error={errors.first_name}>
                  <input id="first_name" className={field} {...register('first_name', { required: true })} />
                </Field>
                <Field id="last_name" label="Last name" error={errors.last_name}>
                  <input id="last_name" className={field} {...register('last_name', { required: true })} />
                </Field>

                <Field id="email" label="Institute email" error={errors.email}>
                  <input id="email" type="email" placeholder="name@thapar.edu" className={field} {...register('email', { required: true })} />
                </Field>
                <Field id="phone" label="Phone" error={errors.phone}>
                  <input id="phone" type="tel" className={field} {...register('phone', { required: true })} />
                </Field>

                <Field id="roll_no" label="Roll number" error={errors.roll_no}>
                  <input id="roll_no" className={field} {...register('roll_no', { required: true })} />
                </Field>
                <Field id="gender" label="Gender" error={errors.gender}>
                  <select id="gender" className={field} defaultValue="" {...register('gender', { required: true })}>
                    <option value="" disabled>Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </Field>

                <Field id="department_id" label="Branch" error={errors.department_id}>
                  <select id="department_id" className={field} defaultValue="" {...register('department_id', { required: true })}>
                    <option value="" disabled>Select</option>
                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </Field>
                <Field id="year" label="Year of study" error={errors.year}>
                  <select id="year" className={field} defaultValue="" {...register('year', { required: true })}>
                    <option value="" disabled>Select</option>
                    {YEARS.map((year) => <option key={year.value} value={year.value}>{year.label}</option>)}
                  </select>
                </Field>

                <Field id="password" label="Password" error={errors.password}>
                  <input id="password" type="password" autoComplete="new-password" className={field} {...register('password', { required: true })} />
                </Field>
                <Field id="password_confirmation" label="Confirm password" error={errors.password_confirmation}>
                  <input id="password_confirmation" type="password" autoComplete="new-password" className={field} {...register('password_confirmation', { required: true })} />
                </Field>

                <div className="sm:tw-col-span-2 tw-flex tw-justify-center">
                  <div id="turnstile-container"></div>
                </div>

                <button
                  type="submit"
                  className="sm:tw-col-span-2 tw-bg-brand tw-text-white tw-py-2 tw-rounded-md tw-font-bold hover:tw-bg-brand-hover tw-duration-200"
                >
                  Create account
                </button>
              </form>

              <p className="tw-text-center tw-text-sm tw-mt-5">
                Already have an account? <Link to="/login" className="tw-text-brand hover:tw-underline">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default SignupPage;

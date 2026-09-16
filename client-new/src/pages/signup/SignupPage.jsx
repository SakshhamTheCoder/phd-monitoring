import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import Loader from '../../components/loader/loader';
import { apiUrfDepartments, apiUrfResendVerification, apiUrfSignup } from '../../api/urf';
import { CLOUDFLARE_SITE_KEY, rootURL } from '../../api/urls';

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
  const { register, handleSubmit, reset } = useForm();
  const [branches, setBranches] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [sentTo, setSentTo] = useState(null);
  // Set once Google has vouched for an address: the form then knows who this
  // is, so it asks only for what Google cannot tell it.
  const [google, setGoogle] = useState(null);

  useEffect(() => {
    apiUrfDepartments().then((res) => res.success && setBranches(res.response));

    // Where the callback lands when it could not reach an opener.
    const params = new URLSearchParams(window.location.search);
    if (params.get('ticket')) {
      setGoogle({ ticket: params.get('ticket'), email: params.get('email'), name: params.get('name') });
    }
  }, []);

  // Google gives a display name, which the two name fields start from.
  useEffect(() => {
    if (!google) return;
    const [first, ...rest] = String(google.name || '').trim().split(' ');
    reset({ first_name: first || '', last_name: rest.join(' '), email: google.email });
  }, [google, reset]);

  const signUpWithGoogle = () => {
    const popup = window.open(
      `${rootURL}/api/google/redirect`,
      'Google Sign Up',
      'width=500,height=600',
    );
    if (!popup) {
      toast.error('Allow popups for this site to sign up with Google.');
      return;
    }

    const listener = (event) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'GOOGLE_SIGNUP') {
        window.removeEventListener('message', listener);
        setGoogle(event.data);
      } else if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        // The address already has an account, so this was a sign-in.
        window.removeEventListener('message', listener);
        localStorage.setItem('token', event.data.token);
        localStorage.setItem('userRole', event.data.user.role.role);
        localStorage.setItem('available_roles', JSON.stringify(event.data.available_roles));
        localStorage.setItem('user', JSON.stringify(event.data.user));
        window.location.href = '/home';
      } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
        window.removeEventListener('message', listener);
        toast.error(event.data.error || 'Google sign-in failed.');
      }
    };
    window.addEventListener('message', listener);
  };

  // The same widget the login page mounts, while the form is on screen.
  useEffect(() => {
    if (sentTo || google) return undefined;
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
  }, [sentTo, google]);

  const onSubmit = async (data) => {
    setLoading(true);
    setErrors({});
    const result = await apiUrfSignup(google
      ? { ...data, email: google.email, google_ticket: google.ticket }
      : { ...data, captcha_token: captchaToken });
    setLoading(false);

    if (result.success) {
      // Google already proved the address, so that account can sign in at once.
      if (result.response?.verified) {
        toast.success(result.response.message);
        window.location.href = '/login';
        return;
      }
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
    if (window.turnstile && !google) window.turnstile.reset();
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
                For undergraduates applying to the Undergraduate Research Fellowship, using the
                institute address that carries your programme and year, like name_be23@thapar.edu.
                PhD scholars are given an account by the office.
              </p>

              {google ? (
                <p className="tw-text-sm tw-text-center tw-mb-6 tw-text-gray-700">
                  Signed in with Google as <strong>{google.email}</strong>. Fill in the rest and
                  your account is ready.
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={signUpWithGoogle}
                    className="tw-bg-white tw-border-2 tw-border-gray-300 tw-text-gray-700 tw-px-6 tw-py-3 tw-rounded-md tw-font-semibold hover:tw-bg-gray-50 hover:tw-border-gray-400 tw-duration-200 tw-w-full tw-flex tw-items-center tw-justify-center tw-gap-3"
                  >
                    <svg className="tw-w-5 tw-h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Sign up with your institute Google account
                  </button>
                  <div className="tw-flex tw-items-center tw-justify-center tw-my-5">
                    <span className="tw-border-t tw-border-gray-300 tw-flex-grow"></span>
                    <span className="tw-px-4 tw-text-gray-600 tw-text-sm">or fill it in yourself</span>
                    <span className="tw-border-t tw-border-gray-300 tw-flex-grow"></span>
                  </div>
                </>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-4">
                <Field id="first_name" label="First name" error={errors.first_name}>
                  <input id="first_name" className={field} {...register('first_name', { required: true })} />
                </Field>
                <Field id="last_name" label="Last name" error={errors.last_name}>
                  <input id="last_name" className={field} {...register('last_name', { required: true })} />
                </Field>

                <Field id="email" label="Institute email" error={errors.email}>
                  <input
                    id="email"
                    type="email"
                    placeholder="name_be23@thapar.edu"
                    className={field}
                    readOnly={!!google}
                    {...register('email', { required: true })}
                  />
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

                {!google && (
                  <>
                    <Field id="password" label="Password" error={errors.password}>
                      <input id="password" type="password" autoComplete="new-password" className={field} {...register('password', { required: true })} />
                    </Field>
                    <Field id="password_confirmation" label="Confirm password" error={errors.password_confirmation}>
                      <input id="password_confirmation" type="password" autoComplete="new-password" className={field} {...register('password_confirmation', { required: true })} />
                    </Field>

                    <div className="sm:tw-col-span-2 tw-flex tw-justify-center">
                      <div id="turnstile-container"></div>
                    </div>
                  </>
                )}

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

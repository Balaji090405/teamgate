'use client';

import { FormEvent, useState } from 'react';
import {
  confirmForgotPassword,
  confirmSignUp,
  forgotPassword,
  login,
  resendConfirmationCode,
  signUp,
} from '@/lib/auth';

type AuthMode =
  | 'login'
  | 'signup'
  | 'confirm-signup'
  | 'forgot-password'
  | 'reset-password';

function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.8}
        stroke="currentColor"
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.98 8.223A10.477 10.477 0 001.5 12c1.563 4.145 5.5 7 10.5 7 1.69 0 3.282-.4 4.69-1.11M6.228 6.228A10.45 10.45 0 0112 5c5 0 8.937 2.855 10.5 7a10.51 10.51 0 01-4.047 5.15M6.228 6.228L3 3m3.228 3.228l12.544 12.544M9.88 9.88a3 3 0 104.24 4.24"
        />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.644C3.423 7.51 7.36 5 12 5c4.64 0 8.577 2.51 9.964 6.678a1.012 1.012 0 010 .644C20.577 16.49 16.64 19 12 19c-4.64 0-8.577-2.51-9.964-6.678z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-12 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />

      <button
        type="button"
        onClick={() => setShowPassword((current) => !current)}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        title={showPassword ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
      >
        <EyeIcon hidden={!showPassword} />
      </button>
    </div>
  );
}

function PasswordRequirement({
  valid,
  children,
}: {
  valid: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-2 text-xs ${
        valid ? 'text-green-600' : 'text-gray-500'
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
          valid
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-gray-300'
        }`}
      >
        {valid ? '✓' : ''}
      </span>

      <span>{children}</span>
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<AuthMode>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [confirmationCode, setConfirmationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function clearMessages() {
    setMessage('');
    setError('');
  }

  function switchMode(newMode: AuthMode) {
    clearMessages();

    setMode(newMode);

    setPassword('');
    setConfirmPassword('');
    setNewPassword('');
    setConfirmationCode('');
  }

  /*
   * Password validation
   */
  const passwordRequirements = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  const isPasswordValid =
    passwordRequirements.minLength &&
    passwordRequirements.uppercase &&
    passwordRequirements.lowercase &&
    passwordRequirements.number;

  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  /*
   * Login
   */
  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    clearMessages();
    setLoading(true);

    try {
      await login(email.trim(), password);

      window.location.href = '/dashboard';
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Login failed. Please check your email and password.',
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Signup
   */
  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    clearMessages();

    if (!isPasswordValid) {
      setError(
        'Password must be at least 8 characters and contain uppercase, lowercase, and a number.',
      );
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await signUp(email.trim(), password);

      setMessage(
        'Account created successfully. A verification code has been sent to your email.',
      );

      setMode('confirm-signup');
      setConfirmationCode('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Signup failed. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Confirm signup
   */
  async function handleConfirmSignUp(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    clearMessages();
    setLoading(true);

    try {
      await confirmSignUp(email.trim(), confirmationCode.trim());

      setMessage(
        'Email verified successfully. You can now log in.',
      );

      setMode('login');
      setConfirmationCode('');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Verification failed. Please check the code.',
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Resend confirmation code
   */
  async function handleResendCode() {
    clearMessages();
    setLoading(true);

    try {
      await resendConfirmationCode(email.trim());

      setMessage(
        'A new verification code has been sent to your email.',
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not resend the verification code.',
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Forgot password
   */
  async function handleForgotPassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    clearMessages();

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);

    try {
      await forgotPassword(email.trim());

      setMessage(
        'A password reset code has been sent to your email.',
      );

      setMode('reset-password');
      setConfirmationCode('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start password reset.',
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Reset password
   */
  async function handleResetPassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    clearMessages();

    if (confirmationCode.trim().length === 0) {
      setError('Please enter the verification code.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    const validNewPassword =
      /[A-Z]/.test(newPassword) &&
      /[a-z]/.test(newPassword) &&
      /[0-9]/.test(newPassword);

    if (!validNewPassword) {
      setError(
        'New password must contain uppercase, lowercase, and a number.',
      );
      return;
    }

    clearMessages();
    setLoading(true);

    try {
      await confirmForgotPassword(
        email.trim(),
        confirmationCode.trim(),
        newPassword,
      );

      setMessage(
        'Password reset successfully. You can now log in.',
      );

      setMode('login');
      setConfirmationCode('');
      setNewPassword('');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not reset your password.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 transition-colors">
      <div className="grid min-h-screen lg:grid-cols-2">

        {/* =======================================================
            LEFT SIDE - BRANDING
        ======================================================= */}

        <section className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-900 to-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">

          {/* Background decoration */}
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" />

          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />

          {/* Logo */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-xl font-bold text-blue-700 shadow-lg">
              T
            </div>

            <span className="text-2xl font-bold">
              TeamGate
            </span>
          </div>

          {/* Main content */}
          <div className="relative z-10 max-w-xl">

            <div className="mb-6 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm backdrop-blur">
              Secure team workspace
            </div>

            <h2 className="text-5xl font-bold leading-tight">
              Manage your team.
              <br />
              Manage your projects.
            </h2>

            <p className="mt-6 max-w-lg text-lg leading-8 text-blue-100">
              TeamGate is a role-based project management
              platform built with AWS services and secure
              authentication.
            </p>

            {/* Features */}
            <div className="mt-10 space-y-4">

              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                  ✓
                </div>

                <div>
                  <p className="font-semibold">
                    Role-based access
                  </p>

                  <p className="text-sm text-blue-100">
                    Admin, Manager and Employee permissions
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                  ✓
                </div>

                <div>
                  <p className="font-semibold">
                    Secure authentication
                  </p>

                  <p className="text-sm text-blue-100">
                    Powered by Amazon Cognito
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                  ✓
                </div>

                <div>
                  <p className="font-semibold">
                    Cloud based
                  </p>

                  <p className="text-sm text-blue-100">
                    Built on AWS serverless architecture
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 text-sm text-blue-200">
            TeamGate © 2026
          </div>
        </section>

        {/* =======================================================
            RIGHT SIDE - AUTHENTICATION
        ======================================================= */}

        <section className="flex min-h-screen items-center justify-center bg-gray-50 px-5 py-10 sm:px-8 transition-colors">

          <div className="w-full max-w-md">

            {/* Mobile logo */}
            <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white">
                T
              </div>

              <span className="text-2xl font-bold text-gray-900">
                TeamGate
              </span>
            </div>

            {/* Authentication card */}
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl sm:p-8">

              {/* =================================================
                  LOGIN
              ================================================= */}

              {mode === 'login' && (
                <>
                  <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                      Welcome back
                    </h1>

                    <p className="mt-2 text-sm text-gray-500">
                      Sign in to access your workspace.
                    </p>
                  </div>

                  {/* Messages */}
                  {message && (
                    <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                      {message}
                    </div>
                  )}

                  {error && (
                    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <form
                    onSubmit={handleLogin}
                    className="space-y-5"
                  >

                    {/* Email */}
                    <div>
                      <label
                        htmlFor="login-email"
                        className="mb-2 block text-sm font-medium text-gray-700"
                      >
                        Email address
                      </label>

                      <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(event) =>
                          setEmail(event.target.value)
                        }
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label
                          htmlFor="login-password"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Password
                        </label>
                      </div>

                      <PasswordInput
                        value={password}
                        onChange={setPassword}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                      />
                    </div>

                    {/* Forgot */}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          switchMode('forgot-password')
                        }
                        className="text-sm font-medium text-blue-600 transition hover:text-blue-700 hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>

                    {/* Login button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-blue-600 px-4 py-3.5 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? 'Signing in...' : 'Sign in'}
                    </button>

                  </form>

                  {/* Signup */}
                  <div className="mt-7 text-center text-sm text-gray-600">
                    Don&apos;t have an account?{' '}

                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Create account
                    </button>
                  </div>
                </>
              )}

              {/* =================================================
                  SIGN UP
              ================================================= */}

              {mode === 'signup' && (
                <>
                  <div className="mb-7">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                      Create account
                    </h1>

                    <p className="mt-2 text-sm text-gray-500">
                      Create your TeamGate account to get started.
                    </p>
                  </div>

                  {message && (
                    <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                      {message}
                    </div>
                  )}

                  {error && (
                    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <form
                    onSubmit={handleSignUp}
                    className="space-y-5"
                  >

                    {/* Email */}
                    <div>
                      <label
                        htmlFor="signup-email"
                        className="mb-2 block text-sm font-medium text-gray-700"
                      >
                        Email address
                      </label>

                      <input
                        id="signup-email"
                        type="email"
                        value={email}
                        onChange={(event) =>
                          setEmail(event.target.value)
                        }
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <label
                        htmlFor="signup-password"
                        className="mb-2 block text-sm font-medium text-gray-700"
                      >
                        Password
                      </label>

                      <PasswordInput
                        value={password}
                        onChange={setPassword}
                        placeholder="Create a password"
                        autoComplete="new-password"
                      />

                      {/* Requirements */}
                      <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-gray-50 p-3">

                        <PasswordRequirement
                          valid={passwordRequirements.minLength}
                        >
                          At least 8 characters
                        </PasswordRequirement>

                        <PasswordRequirement
                          valid={passwordRequirements.uppercase}
                        >
                          At least one uppercase letter
                        </PasswordRequirement>

                        <PasswordRequirement
                          valid={passwordRequirements.lowercase}
                        >
                          At least one lowercase letter
                        </PasswordRequirement>

                        <PasswordRequirement
                          valid={passwordRequirements.number}
                        >
                          At least one number
                        </PasswordRequirement>

                      </div>
                    </div>

                    {/* Confirm password */}
                    <div>
                      <label
                        htmlFor="signup-confirm-password"
                        className="mb-2 block text-sm font-medium text-gray-700"
                      >
                        Confirm password
                      </label>

                      <PasswordInput
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        placeholder="Confirm your password"
                        autoComplete="new-password"
                      />

                      {confirmPassword.length > 0 && (
                        <p
                          className={`mt-2 text-xs ${
                            passwordsMatch
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {passwordsMatch
                            ? '✓ Passwords match'
                            : 'Passwords do not match'}
                        </p>
                      )}
                    </div>

                    {/* Create account */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-blue-600 px-4 py-3.5 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading
                        ? 'Creating account...'
                        : 'Create account'}
                    </button>

                  </form>

                  {/* Login */}
                  <div className="mt-7 text-center text-sm text-gray-600">
                    Already have an account?{' '}

                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Sign in
                    </button>
                  </div>
                </>
              )}

              {/* =================================================
                  CONFIRM SIGNUP
              ================================================= */}

              {mode === 'confirm-signup' && (
                <>
                  <div className="mb-7 text-center">

                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-2xl">
                      ✉
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900">
                      Verify your email
                    </h1>

                    <p className="mt-2 text-sm leading-6 text-gray-500">
                      We sent a verification code to
                    </p>

                    <p className="mt-1 break-all font-medium text-gray-800">
                      {email}
                    </p>
                  </div>

                  {message && (
                    <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                      {message}
                    </div>
                  )}

                  {error && (
                    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <form
                    onSubmit={handleConfirmSignUp}
                    className="space-y-5"
                  >

                    <div>
                      <label
                        htmlFor="confirmation-code"
                        className="mb-2 block text-sm font-medium text-gray-700"
                      >
                        Verification code
                      </label>

                      <input
                        id="confirmation-code"
                        type="text"
                        value={confirmationCode}
                        onChange={(event) =>
                          setConfirmationCode(
                            event.target.value,
                          )
                        }
                        placeholder="Enter 6-digit code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-center text-lg tracking-[0.35em] text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-blue-600 px-4 py-3.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading
                        ? 'Verifying...'
                        : 'Verify email'}
                    </button>

                  </form>

                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={loading}
                    className="mt-4 w-full rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Resend verification code
                  </button>

                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="mt-5 w-full text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Back to sign in
                  </button>
                </>
              )}

              {/* =================================================
                  FORGOT PASSWORD
              ================================================= */}

              {mode === 'forgot-password' && (
                <>
                  <div className="mb-7 text-center">

                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-2xl">
                      🔑
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900">
                      Forgot password?
                    </h1>

                    <p className="mt-2 text-sm leading-6 text-gray-500">
                      Enter your email and we&apos;ll send you
                      a password reset code.
                    </p>
                  </div>

                  {message && (
                    <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                      {message}
                    </div>
                  )}

                  {error && (
                    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <form
                    onSubmit={handleForgotPassword}
                    className="space-y-5"
                  >

                    <div>
                      <label
                        htmlFor="forgot-email"
                        className="mb-2 block text-sm font-medium text-gray-700"
                      >
                        Email address
                      </label>

                      <input
                        id="forgot-email"
                        type="email"
                        value={email}
                        onChange={(event) =>
                          setEmail(event.target.value)
                        }
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-blue-600 px-4 py-3.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading
                        ? 'Sending code...'
                        : 'Send reset code'}
                    </button>

                  </form>

                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="mt-6 w-full text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Back to sign in
                  </button>
                </>
              )}

              {/* =================================================
                  RESET PASSWORD
              ================================================= */}

              {mode === 'reset-password' && (
                <>
                  <div className="mb-7 text-center">

                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-2xl">
                      🔐
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900">
                      Reset password
                    </h1>

                    <p className="mt-2 text-sm leading-6 text-gray-500">
                      Enter the code sent to your email and
                      create a new password.
                    </p>
                  </div>

                  {message && (
                    <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                      {message}
                    </div>
                  )}

                  {error && (
                    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <form
                    onSubmit={handleResetPassword}
                    className="space-y-5"
                  >

                    {/* Code */}
                    <div>
                      <label
                        htmlFor="reset-code"
                        className="mb-2 block text-sm font-medium text-gray-700"
                      >
                        Verification code
                      </label>

                      <input
                        id="reset-code"
                        type="text"
                        value={confirmationCode}
                        onChange={(event) =>
                          setConfirmationCode(
                            event.target.value,
                          )
                        }
                        placeholder="Enter verification code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-center text-lg tracking-[0.3em] text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    {/* New password */}
                    <div>
                      <label
                        htmlFor="reset-password"
                        className="mb-2 block text-sm font-medium text-gray-700"
                      >
                        New password
                      </label>

                      <PasswordInput
                        value={newPassword}
                        onChange={setNewPassword}
                        placeholder="Create a new password"
                        autoComplete="new-password"
                      />

                      <div className="mt-3 space-y-2 rounded-xl bg-gray-50 p-3">

                        <PasswordRequirement
                          valid={newPassword.length >= 8}
                        >
                          At least 8 characters
                        </PasswordRequirement>

                        <PasswordRequirement
                          valid={/[A-Z]/.test(newPassword)}
                        >
                          At least one uppercase letter
                        </PasswordRequirement>

                        <PasswordRequirement
                          valid={/[a-z]/.test(newPassword)}
                        >
                          At least one lowercase letter
                        </PasswordRequirement>

                        <PasswordRequirement
                          valid={/[0-9]/.test(newPassword)}
                        >
                          At least one number
                        </PasswordRequirement>

                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-blue-600 px-4 py-3.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading
                        ? 'Resetting password...'
                        : 'Reset password'}
                    </button>

                  </form>

                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="mt-6 w-full text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Back to sign in
                  </button>
                </>
              )}

            </div>

            {/* Security footer */}
            <p className="mt-6 text-center text-xs text-gray-500">
              Your account is secured with Amazon Cognito.
            </p>

          </div>
        </section>
      </div>
    </main>
  );
}
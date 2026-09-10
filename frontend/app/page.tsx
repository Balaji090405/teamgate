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
          d="M3.98 8.223A10.477 10.477 0 001.5 12c1.563 4.145 5.5 7 10.5 7
          1.69 0 3.282-.4 4.69-1.11M6.228 6.228A10.45 10.45 0 0112 5
          c5 0 8.937 2.855 10.5 7a10.51 10.51 0 01-4.047 5.15M6.228 6.228
          L3 3m3.228 3.228l12.544 12.544M9.88 9.88a3 3 0 104.24 4.24"
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
        d="M2.036 12.322a1.012 1.012 0 010-.644
        C3.423 7.51 7.36 5 12 5c4.64 0 8.577 2.51 9.964 6.678
        a1.012 1.012 0 010 .644C20.577 16.49 16.64 19 12 19
        c-4.64 0-8.577-2.51-9.964-6.678z"
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
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-12 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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

export default function Home() {
  const [mode, setMode] = useState<AuthMode>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
    setNewPassword('');
    setConfirmationCode('');
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    clearMessages();
    setLoading(true);

    try {
      await login(email, password);

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

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    clearMessages();
    setLoading(true);

    try {
      await signUp(email, password);

      setMessage(
        'Account created. We sent a verification code to your email.',
      );

      setMode('confirm-signup');
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

  async function handleConfirmSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    clearMessages();
    setLoading(true);

    try {
      await confirmSignUp(email, confirmationCode);

      setMessage(
        'Email verified successfully. You can now log in.',
      );

      setMode('login');
      setConfirmationCode('');
      setPassword('');
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

  async function handleResendCode() {
    clearMessages();
    setLoading(true);

    try {
      await resendConfirmationCode(email);

      setMessage('A new verification code has been sent to your email.');
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

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    clearMessages();
    setLoading(true);

    try {
      await forgotPassword(email);

      setMessage(
        'A password reset code has been sent to your email.',
      );

      setMode('reset-password');
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

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    clearMessages();
    setLoading(true);

    try {
      await confirmForgotPassword(
        email,
        confirmationCode,
        newPassword,
      );

      setMessage(
        'Password reset successfully. You can now log in.',
      );

      setMode('login');
      setConfirmationCode('');
      setNewPassword('');
      setPassword('');
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

  function renderPasswordRequirements() {
    return (
      <p className="mt-2 text-xs text-gray-500">
        Minimum 8 characters, including uppercase, lowercase, and a number.
      </p>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-10">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white">
              T
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              TeamGate
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Role-based project management
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

          {/* LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Email
                </label>

                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Password
                </label>

                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => switchMode('forgot-password')}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Logging in...' : 'Log in'}
              </button>

              <p className="text-center text-sm text-gray-600">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Sign up
                </button>
              </p>
            </form>
          )}

          {/* SIGN UP */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-5">
              <div>
                <label
                  htmlFor="signup-email"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Email
                </label>

                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

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

                {renderPasswordRequirements()}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Creating account...' : 'Create account'}
              </button>

              <p className="text-center text-sm text-gray-600">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Log in
                </button>
              </p>
            </form>
          )}

          {/* CONFIRM SIGN UP */}
          {mode === 'confirm-signup' && (
            <form
              onSubmit={handleConfirmSignUp}
              className="space-y-5"
            >
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  Verify your email
                </h2>

                <p className="mt-2 text-sm text-gray-500">
                  Enter the verification code sent to{' '}
                  <span className="font-medium text-gray-700">
                    {email}
                  </span>
                </p>
              </div>

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
                    setConfirmationCode(event.target.value)
                  }
                  placeholder="Enter verification code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-center tracking-[0.3em] text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Verifying...' : 'Verify email'}
              </button>

              <button
                type="button"
                onClick={handleResendCode}
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Resend code
              </button>

              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                Back to login
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD */}
          {mode === 'forgot-password' && (
            <form
              onSubmit={handleForgotPassword}
              className="space-y-5"
            >
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  Forgot your password?
                </h2>

                <p className="mt-2 text-sm text-gray-500">
                  Enter your email and we&apos;ll send you a password
                  reset code.
                </p>
              </div>

              <div>
                <label
                  htmlFor="forgot-email"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Email
                </label>

                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Sending code...' : 'Send reset code'}
              </button>

              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                Back to login
              </button>
            </form>
          )}

          {/* RESET PASSWORD */}
          {mode === 'reset-password' && (
            <form
              onSubmit={handleResetPassword}
              className="space-y-5"
            >
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  Reset password
                </h2>

                <p className="mt-2 text-sm text-gray-500">
                  Enter the code sent to your email and choose a new
                  password.
                </p>
              </div>

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
                    setConfirmationCode(event.target.value)
                  }
                  placeholder="Enter verification code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-center tracking-[0.3em] text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

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
                  placeholder="Enter new password"
                  autoComplete="new-password"
                />

                {renderPasswordRequirements()}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Resetting...' : 'Reset password'}
              </button>

              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                Back to login
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
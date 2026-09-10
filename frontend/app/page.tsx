'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  login,
  signUp,
  confirmSignUp,
  resendConfirmationCode,
  forgotPassword,
  confirmForgotPassword,
} from '@/lib/auth';

type Mode =
  | 'login'
  | 'signup'
  | 'confirm-signup'
  | 'forgot-password'
  | 'reset-password';

export default function Home() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function clearMessages() {
    setError('');
    setSuccess('');
  }

  function switchMode(newMode: Mode) {
    clearMessages();
    setMode(newMode);
    setPassword('');
    setConfirmPassword('');
    setCode('');
  }

  // ------------------------------------------------------------
  // LOGIN
  // ------------------------------------------------------------

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    clearMessages();
    setLoading(true);

    try {
      await login(email, password);

      router.push('/dashboard');
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error
          ? err.message
          : 'Invalid email or password.';

      if (message.includes('UserNotConfirmedException')) {
        setError(
          'Your account is not verified yet. Please verify your email.',
        );
        setMode('confirm-signup');
      } else {
        setError('Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------------------------------------
  // SIGN UP
  // ------------------------------------------------------------

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    clearMessages();

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password);

      setSuccess(
        'Account created! Check your email for the verification code.',
      );

      setMode('confirm-signup');
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error
          ? err.message
          : 'Unable to create account.';

      if (message.includes('UsernameExistsException')) {
        setError(
          'An account with this email already exists. Try signing in or resetting your password.',
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------------------------------------
  // CONFIRM SIGN UP
  // ------------------------------------------------------------

  async function handleConfirmSignup(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    clearMessages();
    setLoading(true);

    try {
      await confirmSignUp(email, code);

      setSuccess(
        'Email verified successfully! You can now sign in.',
      );

      setPassword('');
      setConfirmPassword('');
      setCode('');

      setMode('login');
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error
          ? err.message
          : 'Invalid verification code.';

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------------------------------------
  // RESEND SIGNUP CODE
  // ------------------------------------------------------------

  async function handleResendCode() {
    clearMessages();
    setLoading(true);

    try {
      await resendConfirmationCode(email);

      setSuccess(
        'A new verification code has been sent to your email.',
      );
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error
          ? err.message
          : 'Unable to resend verification code.';

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------------------------------------
  // FORGOT PASSWORD
  // ------------------------------------------------------------

  async function handleForgotPassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    clearMessages();
    setLoading(true);

    try {
      await forgotPassword(email);

      setSuccess(
        'Password reset code sent to your email.',
      );

      setMode('reset-password');
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error
          ? err.message
          : 'Unable to start password reset.';

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------------------------------------
  // RESET PASSWORD
  // ------------------------------------------------------------

  async function handleResetPassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    clearMessages();

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      await confirmForgotPassword(
        email,
        code,
        password,
      );

      setSuccess(
        'Password reset successfully! You can now sign in.',
      );

      setPassword('');
      setConfirmPassword('');
      setCode('');

      setMode('login');
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error
          ? err.message
          : 'Unable to reset password.';

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------------------------------------
  // MESSAGE COMPONENTS
  // ------------------------------------------------------------

  function ErrorMessage() {
    if (!error) {
      return null;
    }

    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  function SuccessMessage() {
    if (!success) {
      return null;
    }

    return (
      <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
        {success}
      </div>
    );
  }

  // ------------------------------------------------------------
  // LOGIN PAGE
  // ------------------------------------------------------------

  function renderLogin() {
    return (
      <>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome back
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Sign in to continue to TeamGate
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="space-y-5"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="admin@test.com"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>

              <button
                type="button"
                onClick={() =>
                  switchMode('forgot-password')
                }
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Forgot password?
              </button>
            </div>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter your password"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <ErrorMessage />
          <SuccessMessage />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don&apos;t have an account?
          </p>

          <button
            type="button"
            onClick={() => switchMode('signup')}
            className="mt-1 font-semibold text-blue-600 hover:text-blue-700"
          >
            Create an account
          </button>
        </div>
      </>
    );
  }

  // ------------------------------------------------------------
  // SIGNUP PAGE
  // ------------------------------------------------------------

  function renderSignup() {
    return (
      <>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Create account
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Create your TeamGate account
          </p>
        </div>

        <form
          onSubmit={handleSignup}
          className="space-y-5"
        >
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
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@example.com"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label
              htmlFor="signup-password"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Password
            </label>

            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="At least 8 characters"
              required
              minLength={8}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Confirm password
            </label>

            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              placeholder="Confirm your password"
              required
              minLength={8}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <ErrorMessage />
          <SuccessMessage />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? 'Creating account...'
              : 'Create account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            ← Back to sign in
          </button>
        </div>
      </>
    );
  }

  // ------------------------------------------------------------
  // CONFIRM SIGNUP
  // ------------------------------------------------------------

  function renderConfirmSignup() {
    return (
      <>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Verify your email
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Enter the verification code sent to
          </p>

          <p className="mt-1 font-medium text-gray-900">
            {email}
          </p>
        </div>

        <form
          onSubmit={handleConfirmSignup}
          className="space-y-5"
        >
          <div>
            <label
              htmlFor="verification-code"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Verification code
            </label>

            <input
              id="verification-code"
              type="text"
              value={code}
              onChange={(event) =>
                setCode(event.target.value)
              }
              placeholder="Enter verification code"
              required
              autoComplete="one-time-code"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-lg tracking-widest outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <ErrorMessage />
          <SuccessMessage />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? 'Verifying...'
              : 'Verify email'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={handleResendCode}
            disabled={loading}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            Resend verification code
          </button>
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            ← Back to sign in
          </button>
        </div>
      </>
    );
  }

  // ------------------------------------------------------------
  // FORGOT PASSWORD
  // ------------------------------------------------------------

  function renderForgotPassword() {
    return (
      <>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Forgot password?
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Enter your email and we&apos;ll send you a password reset code.
          </p>
        </div>

        <form
          onSubmit={handleForgotPassword}
          className="space-y-5"
        >
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
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@example.com"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <ErrorMessage />
          <SuccessMessage />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? 'Sending code...'
              : 'Send reset code'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            ← Back to sign in
          </button>
        </div>
      </>
    );
  }

  // ------------------------------------------------------------
  // RESET PASSWORD
  // ------------------------------------------------------------

  function renderResetPassword() {
    return (
      <>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Reset password
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Enter the code sent to
          </p>

          <p className="mt-1 font-medium text-gray-900">
            {email}
          </p>
        </div>

        <form
          onSubmit={handleResetPassword}
          className="space-y-5"
        >
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
              value={code}
              onChange={(event) =>
                setCode(event.target.value)
              }
              placeholder="Enter reset code"
              required
              autoComplete="one-time-code"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-lg tracking-widest outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label
              htmlFor="new-password"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              New password
            </label>

            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="At least 8 characters"
              required
              minLength={8}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label
              htmlFor="reset-confirm-password"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Confirm new password
            </label>

            <input
              id="reset-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              placeholder="Confirm new password"
              required
              minLength={8}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <ErrorMessage />
          <SuccessMessage />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? 'Resetting password...'
              : 'Reset password'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            ← Back to sign in
          </button>
        </div>
      </>
    );
  }

  // ------------------------------------------------------------
  // MAIN PAGE
  // ------------------------------------------------------------

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            TeamGate
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Role-based project tracker
          </p>
        </div>

        {mode === 'login' && renderLogin()}

        {mode === 'signup' && renderSignup()}

        {mode === 'confirm-signup' &&
          renderConfirmSignup()}

        {mode === 'forgot-password' &&
          renderForgotPassword()}

        {mode === 'reset-password' &&
          renderResetPassword()}
      </div>
    </main>
  );
}
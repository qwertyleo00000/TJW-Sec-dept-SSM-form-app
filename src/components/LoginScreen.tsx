import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import type { AuthSessionResponse } from '../types';
import {
  forgotPassword,
  loginWithPassword,
  registerNewAccount,
  resetPassword,
} from '../lib/api';
import { VaultEmblem } from './BrandMark';

interface LoginScreenProps {
  onAuthenticated: (session: AuthSessionResponse) => void;
  idleLogoutNotice?: string;
}

export function LoginScreen({ onAuthenticated, idleLogoutNotice }: LoginScreenProps) {
  const [mode, setMode] = useState<
    'signin' | 'register' | 'forgot' | 'reset'
  >('signin');

  // Sign In state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Register state
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCompanyName, setRegCompanyName] = useState('');
  const [regMyCoId, setRegMyCoId] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // Reset password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [resetConfirmPasswordInput, setResetConfirmPasswordInput] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check URL query params for reset token on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    const e = params.get('email');
    if (t && e) {
      setResetToken(t);
      setResetEmail(e);
      setMode('reset');
    }
  }, []);

  const hasMinLength = regPassword.length >= 12;
  const hasUpper = /[A-Z]/.test(regPassword);
  const hasLower = /[a-z]/.test(regPassword);
  const passwordsMatch = regPassword.length > 0 && regPassword === regConfirmPassword;

  const resetHasMinLength = resetPasswordInput.length >= 12;
  const resetHasUpper = /[A-Z]/.test(resetPasswordInput);
  const resetHasLower = /[a-z]/.test(resetPasswordInput);
  const resetPasswordsMatch =
    resetPasswordInput.length > 0 &&
    resetPasswordInput === resetConfirmPasswordInput;

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await loginWithPassword(signInEmail.trim(), signInPassword);
      if (session && session.user) {
        onAuthenticated(session);
      } else {
        throw new Error('Invalid authentication response from server.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!hasMinLength || !hasUpper || !hasLower || !passwordsMatch) {
      setError('Please satisfy all password security requirements.');
      return;
    }
    setLoading(true);
    try {
      await registerNewAccount({
        fullName: regFullName,
        email: regEmail,
        password: regPassword,
        confirmPassword: regConfirmPassword,
        companyName: regCompanyName,
        myCoId: regMyCoId,
      });
      setRegisteredSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(forgotEmail);
      setForgotSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!resetHasMinLength || !resetHasUpper || !resetHasLower || !resetPasswordsMatch) {
      setError('Please satisfy all password security requirements.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword({
        email: resetEmail,
        recoveryToken: resetToken,
        newPassword: resetPasswordInput,
        confirmPassword: resetConfirmPasswordInput,
      });
      setResetSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 grid lg:grid-cols-12 items-stretch">
      {/* Left Institutional Brand Column */}
      <div className="lg:col-span-5 bg-[#0F172A] text-white px-8 py-12 lg:px-14 lg:py-16 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <VaultEmblem className="w-9 h-9 shrink-0" />
            <div>
              <p className="font-display text-lg font-bold tracking-tight text-white leading-none">
                CoSec Vault
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Corporate Secretarial Portal
              </p>
            </div>
          </div>

          <div className="mt-14 max-w-md">
            <h1 className="font-display text-3xl lg:text-[2.25rem] font-bold tracking-tight text-white leading-[1.18] [text-wrap:balance]">
              Statutory filings for your Malaysian companies, on demand.
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-slate-300">
              Access your entity&apos;s latest SSM Companies Act 2016 statutory forms, search in plain English, download authenticated PDFs, and request signed Certified True Copies directly from your Company Secretary.
            </p>
          </div>

          <dl className="mt-12 space-y-6 border-t border-slate-800 pt-8 max-w-md">
            <div className="flex items-start gap-3.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <dt className="text-sm font-semibold text-white">
                  Strict Multi-Tenant Isolation
                </dt>
                <dd className="text-sm text-slate-400 mt-1 leading-relaxed">
                  Verified against the Client Access Registry. Directors only view and download filings inside their explicitly authorized company folders.
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <Building2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <dt className="text-sm font-semibold text-white">
                  Multi-Entity Director Access
                </dt>
                <dd className="text-sm text-slate-400 mt-1 leading-relaxed">
                  Seamlessly switch across Sdn. Bhd. entities linked to your corporate email without separate logins.
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <Lock className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <dt className="text-sm font-semibold text-white">
                  Authenticated Proxy Downloads
                </dt>
                <dd className="text-sm text-slate-400 mt-1 leading-relaxed">
                  Documents stream through a verified backend proxy with zero public file links exposed.
                </dd>
              </div>
            </div>
          </dl>
        </div>

        <p className="mt-12 text-xs text-slate-500">
          Companies Act 2016 (Act 777) · Suruhanjaya Syarikat Malaysia (SSM) Statutory Repository
        </p>
      </div>

      {/* Right Authentication Canvas */}
      <div className="lg:col-span-7 flex items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-md">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 shadow-sm">
            {mode === 'signin' && (
              <>
                <div>
                  <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                    Sign in to your vault
                  </h2>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    Enter your registered corporate email address and password.
                  </p>
                </div>

                {idleLogoutNotice && (
                  <div
                    role="alert"
                    className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 font-medium"
                  >
                    {idleLogoutNotice}
                  </div>
                )}

                {error && (
                  <div
                    role="alert"
                    className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  >
                    {error}
                  </div>
                )}

                <form onSubmit={handleSignIn} className="mt-7 space-y-4">
                  <div>
                    <label
                      htmlFor="signin-email"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      Corporate Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="signin-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        placeholder="qwertyleo00000@gmail.com"
                        className="w-full pl-10 pr-4 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="signin-password"
                        className="block text-sm font-medium text-slate-700"
                      >
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setError(null);
                        }}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="signin-password"
                        type={showSignInPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-3.5 pr-10 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignInPassword(!showSignInPassword)}
                        aria-label="Toggle password visibility"
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showSignInPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <span>Sign In to Vault</span>
                    )}
                  </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-200 text-center">
                  <p className="text-xs text-slate-600 mb-3">
                    Don&apos;t have an active account or vault folder assigned yet?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                      setRegisteredSuccess(false);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4 text-slate-700" />
                    <span>Register New Account</span>
                  </button>
                </div>
              </>
            )}

            {mode === 'register' && (
              <>
                {registeredSuccess ? (
                  <div className="space-y-6 text-center py-4">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                    <div>
                      <h3 className="font-display text-xl font-bold text-slate-900">
                        Registration Submitted
                      </h3>
                      <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                        Your account registration and company details have been sent to our Company Secretary team for verification and folder assignment. You will be able to sign in once approved.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin');
                        setRegisteredSuccess(false);
                        setError(null);
                      }}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                        Register New Account
                      </h2>
                      <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                        Submit your details and company information for verification by our Company Secretary department.
                      </p>
                    </div>

                    {error && (
                      <div
                        role="alert"
                        className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                      >
                        {error}
                      </div>
                    )}

                    <form onSubmit={handleRegister} className="mt-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Full Name (Director / Officer)
                        </label>
                        <input
                          type="text"
                          required
                          value={regFullName}
                          onChange={(e) => setRegFullName(e.target.value)}
                          placeholder="Tan Sri Ahmad Razak"
                          className="w-full px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Corporate Email Address
                        </label>
                        <input
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="director@company.com.my"
                          className="w-full px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Company Name (e.g., ABC Sdn. Bhd.)
                        </label>
                        <input
                          type="text"
                          required
                          value={regCompanyName}
                          onChange={(e) => setRegCompanyName(e.target.value)}
                          placeholder="ALPHA TECH SOLUTIONS SDN. BHD."
                          className="w-full px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          SSM Registration No. / MyCoID
                        </label>
                        <input
                          type="text"
                          required
                          value={regMyCoId}
                          onChange={(e) => setRegMyCoId(e.target.value)}
                          placeholder="202301018899 (1512345-A)"
                          className="w-full px-3.5 py-2 text-sm font-mono text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            type={showRegPassword ? 'text' : 'password'}
                            required
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="••••••••••••"
                            className="w-full pl-3 pr-10 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Confirm Password
                        </label>
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          required
                          value={regConfirmPassword}
                          onChange={(e) => setRegConfirmPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>

                      {/* Live Password Strength Checklist */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
                        <p className="font-semibold text-slate-700">Password Security Requirements:</p>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${hasMinLength ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                            <Check className="w-3 h-3" />
                          </div>
                          <span className={hasMinLength ? 'text-emerald-800 font-medium' : 'text-slate-600'}>
                            At least 12 characters long
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${hasUpper ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                            <Check className="w-3 h-3" />
                          </div>
                          <span className={hasUpper ? 'text-emerald-800 font-medium' : 'text-slate-600'}>
                            Contains uppercase letter (A–Z)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${hasLower ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                            <Check className="w-3 h-3" />
                          </div>
                          <span className={hasLower ? 'text-emerald-800 font-medium' : 'text-slate-600'}>
                            Contains lowercase letter (a–z)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordsMatch ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                            <Check className="w-3 h-3" />
                          </div>
                          <span className={passwordsMatch ? 'text-emerald-800 font-medium' : 'text-slate-600'}>
                            Passwords match
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 space-y-2">
                        <button
                          type="submit"
                          disabled={loading || !hasMinLength || !hasUpper || !hasLower || !passwordsMatch}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Submit Registration Request</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMode('signin');
                            setError(null);
                          }}
                          className="w-full py-2 px-4 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                        >
                          Back to Sign In
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </>
            )}

            {mode === 'forgot' && (
              <>
                <div>
                  <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                    Reset Password
                  </h2>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    Enter your registered email address. If an active account exists, we will send you a recovery token.
                  </p>
                </div>

                {error && (
                  <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {error}
                  </div>
                )}

                {forgotSent ? (
                  <div className="mt-6 space-y-5 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                    <p className="text-sm text-slate-700">
                      If an active account exists for that email, recovery instructions have been sent (check server console logs if SMTP is unconfigured).
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset');
                        setResetEmail(forgotEmail);
                      }}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
                    >
                      Enter Recovery Token
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin');
                        setForgotSent(false);
                        setError(null);
                      }}
                      className="w-full py-2 px-4 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotSubmit} className="mt-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Corporate Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="director@company.com.my"
                        className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>

                    <div className="pt-2 space-y-2">
                      <button
                        type="submit"
                        disabled={loading || !forgotEmail}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Send Recovery Instructions</span>}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('signin');
                          setError(null);
                        }}
                        className="w-full py-2 px-4 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                      >
                        Back to Sign In
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {mode === 'reset' && (
              <>
                <div>
                  <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                    Set New Password
                  </h2>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    Enter your email, recovery token, and new secure password.
                  </p>
                </div>

                {error && (
                  <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {error}
                  </div>
                )}

                {resetSuccess ? (
                  <div className="mt-6 space-y-5 text-center">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                    <p className="text-sm text-slate-700">
                      Password has been reset successfully. You can now sign in with your new password.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin');
                        setResetSuccess(false);
                        setError(null);
                      }}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-slate-800 cursor-pointer"
                    >
                      Sign In Now
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleResetSubmit} className="mt-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Corporate Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="director@company.com.my"
                        className="w-full px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Recovery Token (from email / console)
                      </label>
                      <input
                        type="text"
                        required
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        placeholder="Enter 32-byte recovery token"
                        className="w-full px-3.5 py-2 text-xs font-mono text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        required
                        value={resetPasswordInput}
                        onChange={(e) => setResetPasswordInput(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        required
                        value={resetConfirmPasswordInput}
                        onChange={(e) => setResetConfirmPasswordInput(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>

                    {/* Live Password Strength Checklist */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
                      <p className="font-semibold text-slate-700">Password Security Requirements:</p>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${resetHasMinLength ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                          <Check className="w-3 h-3" />
                        </div>
                        <span className={resetHasMinLength ? 'text-emerald-800 font-medium' : 'text-slate-600'}>
                          At least 12 characters long
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${resetHasUpper ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                          <Check className="w-3 h-3" />
                        </div>
                        <span className={resetHasUpper ? 'text-emerald-800 font-medium' : 'text-slate-600'}>
                          Contains uppercase letter (A–Z)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${resetHasLower ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                          <Check className="w-3 h-3" />
                        </div>
                        <span className={resetHasLower ? 'text-emerald-800 font-medium' : 'text-slate-600'}>
                          Contains lowercase letter (a–z)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${resetPasswordsMatch ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                          <Check className="w-3 h-3" />
                        </div>
                        <span className={resetPasswordsMatch ? 'text-emerald-800 font-medium' : 'text-slate-600'}>
                          Passwords match
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 space-y-2">
                      <button
                        type="submit"
                        disabled={loading || !resetHasMinLength || !resetHasUpper || !resetHasLower || !resetPasswordsMatch}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Reset Password</span>}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('signin');
                          setError(null);
                        }}
                        className="w-full py-2 px-4 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                      >
                        Back to Sign In
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Need urgent vault access? Contact your Company Secretary on{' '}
            <span className="font-mono text-slate-700">+60 11-3676 8398</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

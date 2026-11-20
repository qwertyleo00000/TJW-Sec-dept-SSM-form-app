import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import type { AuthSessionResponse } from '../types';
import { registerNewAccount, requestOtp, verifyOtp } from '../lib/api';
import { VaultEmblem } from './BrandMark';

interface LoginScreenProps {
  onAuthenticated: (session: AuthSessionResponse) => void;
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [recipientName, setRecipientName] = useState<string | null>(null);

  // Registration form state
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCompanyName, setRegCompanyName] = useState('');
  const [regMyCoId, setRegMyCoId] = useState('');
  const [registeredSuccess, setRegisteredSuccess] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await requestOtp(email);
      setRecipientName(result.fullName);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send OTP.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await verifyOtp(email, otp);
      onAuthenticated(session);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Invalid verification code.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await registerNewAccount({
        fullName: regFullName,
        email: regEmail,
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

      {/* Right Authentication / Registration Canvas */}
      <div className="lg:col-span-7 flex items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-md">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 shadow-sm">
            {mode === 'signin' ? (
              <>
                <div>
                  <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                    {step === 'email' ? 'Sign in to your vault' : 'Enter verification code'}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {step === 'email'
                      ? 'Enter your registered corporate email address to receive a 6-digit One-Time Passcode (OTP).'
                      : `We sent a 6-digit verification code to ${recipientName ?? email}.`}
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

                {step === 'email' ? (
                  <form onSubmit={handleRequestOtp} className="mt-7 space-y-5">
                    <div>
                      <label
                        htmlFor="corporate-email"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Registered Corporate Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="corporate-email"
                          type="email"
                          required
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="director@company.com.my"
                          className="w-full pl-10 pr-4 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !email.trim()}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60 transition-colors cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending OTP...</span>
                        </>
                      ) : (
                        <>
                          <span>Send 6-Digit OTP</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="mt-7 space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="otp-code"
                          className="block text-sm font-medium text-slate-700"
                        >
                          6-Digit One-Time Passcode
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setStep('email');
                            setOtp('');
                            setError(null);
                          }}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
                        >
                          Change email
                        </button>
                      </div>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="otp-code"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          required
                          autoFocus
                          value={otp}
                          onChange={(e) =>
                            setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                          }
                          placeholder="123456"
                          className="w-full pl-10 pr-4 py-2.5 text-base font-mono tabular-nums tracking-[0.25em] text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60 transition-colors cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Verifying Code...</span>
                        </>
                      ) : (
                        <>
                          <span>Verify &amp; Open Vault</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}

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
            ) : registeredSuccess ? (
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
                    setStep('email');
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

                <form onSubmit={handleRegisterSubmit} className="mt-6 space-y-4">
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
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
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
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
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
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
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
                      className="w-full px-3.5 py-2.5 text-sm font-mono text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  <div className="pt-2 space-y-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting Registration...</span>
                        </>
                      ) : (
                        <span>Submit Registration Request</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin');
                        setError(null);
                      }}
                      className="w-full py-2 px-4 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
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

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

// Inline logo mark — three brand-colour tiles
function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-end gap-[4px]" style={{ height: size }}>
      <div
        className="flex items-center justify-center rounded-[8px] text-white font-black"
        style={{
          width: size, height: size, fontSize: size * 0.5,
          background: 'linear-gradient(145deg,#F5B942,#D97810)',
          boxShadow: '0 6px 18px rgba(232,148,26,.55),inset 0 1px 0 rgba(255,255,255,.22)',
        }}
      >G</div>
      <div
        className="flex items-center justify-center rounded-[8px] text-white font-black"
        style={{
          width: size, height: size, fontSize: size * 0.5,
          background: 'linear-gradient(145deg,#2fc8e0,#0c7689)',
          boxShadow: '0 6px 18px rgba(56,86,212,.55),inset 0 1px 0 rgba(255,255,255,.22)',
        }}
      >2</div>
      <div
        className="flex items-center justify-center rounded-[8px]"
        style={{
          width: size, height: size,
          background: 'linear-gradient(145deg,#5DD49F,#35A478)',
          boxShadow: '0 6px 18px rgba(77,184,138,.55),inset 0 1px 0 rgba(255,255,255,.22)',
        }}
      >
        <svg viewBox="0 0 16 16" fill="none" style={{ width: size * 0.56, height: size * 0.56 }}>
          <rect x="1.5" y="9" width="3" height="5.5" rx="0.8" fill="white" opacity=".65" />
          <rect x="6.5" y="5.5" width="3" height="9" rx="0.8" fill="white" opacity=".82" />
          <rect x="11.5" y="2" width="3" height="12.5" rx="0.8" fill="white" />
        </svg>
      </div>
    </div>
  );
}

export function Login() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const ok = await login(email, password);
    if (ok) {
      navigate('/', { replace: true });
    } else {
      setError('The email or password you entered is incorrect. Please try again.');
    }
  };

  const handleForgotPassword = () => {
    setToast('Password reset link sent. Check your inbox.');
    setTimeout(() => setToast(''), 4000);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #060D1F 0%, #0D1C3A 55%, #081529 100%)' }}
    >
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Orange glow — top-left */}
        <div style={{
          position: 'absolute', top: '-10%', left: '-8%',
          width: 520, height: 520, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,148,26,.18) 0%, transparent 70%)',
        }} />
        {/* Blue glow — bottom-right */}
        <div style={{
          position: 'absolute', bottom: '-12%', right: '-8%',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,86,212,.2) 0%, transparent 70%)',
        }} />
        {/* Green glow — top-right */}
        <div style={{
          position: 'absolute', top: '10%', right: '5%',
          width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(77,184,138,.12) 0%, transparent 70%)',
        }} />
        {/* Subtle grid overlay */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-2xl">
          <CheckCircle2 size={16} className="shrink-0" />
          {toast}
        </div>
      )}

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Brand header */}
        <div className="mb-10 flex flex-col items-center text-center">
          <LogoMark size={40} />
          <h1 className="mt-5 text-3xl font-extrabold text-white tracking-tight">Gap2Action</h1>
          <p className="mt-1.5 text-sm tracking-[0.12em] uppercase font-medium"
             style={{ color: 'rgba(255,255,255,.38)' }}>
            Assess · Understand · Advance
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-8"
          style={{
            background: 'rgba(255,255,255,.05)',
            border: '1px solid rgba(255,255,255,.10)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 24px 64px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.05) inset',
          }}
        >
          <h2 className="text-xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-sm mb-7" style={{ color: 'rgba(255,255,255,.45)' }}>
            Sign in to continue to your workspace
          </p>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form id="login-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'rgba(255,255,255,.55)' }}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@gap2action.com"
                className="flex h-11 w-full rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/30 transition-all outline-none"
                style={{
                  background: 'rgba(255,255,255,.07)',
                  border: '1px solid rgba(255,255,255,.12)',
                  // focus handled via JS-free approach; let browser ring show via outline
                }}
                onFocus={e => e.currentTarget.style.border = '1px solid rgba(91,120,232,.7)'}
                onBlur={e => e.currentTarget.style.border = '1px solid rgba(255,255,255,.12)'}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'rgba(255,255,255,.55)' }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs font-semibold transition-colors"
                  style={{ color: 'rgba(91,120,232,.85)' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'rgba(91,120,232,1)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(91,120,232,.85)'}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex h-11 w-full rounded-xl px-4 pr-11 py-2 text-sm text-white placeholder:text-white/30 transition-all outline-none"
                  style={{
                    background: 'rgba(255,255,255,.07)',
                    border: '1px solid rgba(255,255,255,.12)',
                  }}
                  onFocus={e => e.currentTarget.style.border = '1px solid rgba(91,120,232,.7)'}
                  onBlur={e => e.currentTarget.style.border = '1px solid rgba(255,255,255,.12)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'rgba(255,255,255,.35)' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,.7)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.35)'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2.5">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded cursor-pointer accent-[#0c93ac]"
              />
              <label htmlFor="remember" className="text-sm cursor-pointer select-none"
                style={{ color: 'rgba(255,255,255,.5)' }}>
                Keep me signed in
              </label>
            </div>
          </form>

          {/* Submit */}
          <div className="mt-7">
            <button
              type="submit"
              form="login-form"
              disabled={isLoading}
              className="relative flex w-full items-center justify-center gap-2.5 rounded-xl py-3 text-sm font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
              style={{
                background: 'linear-gradient(120deg, #13b4cf 0%, #2e7de0 38%, #7b2ff7 100%)',
                boxShadow: '0 6px 22px rgba(56,86,212,.45)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(56,86,212,.6)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 22px rgba(56,86,212,.45)';
              }}
            >
              {isLoading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                <>Sign in <ArrowRight size={16} /></>
              )}
            </button>
          </div>

          {/* Demo credentials */}
          <div className="mt-6 rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }}>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2.5"
              style={{ color: 'rgba(255,255,255,.35)' }}>Demo credentials</p>
            <div className="space-y-1.5 font-mono text-[11px]" style={{ color: 'rgba(255,255,255,.45)' }}>
              <div className="flex items-center gap-2">
                <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                  style={{ background: 'rgba(56,86,212,.25)', color: 'rgba(91,120,232,.9)' }}>Admin</span>
                <span>admin@gap2action.com / password123</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                  style={{ background: 'rgba(77,184,138,.2)', color: 'rgba(77,184,138,.9)' }}>Assessor</span>
                <span>assessor@gap2action.com / password123</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                  style={{ background: 'rgba(232,148,26,.2)', color: 'rgba(232,148,26,.9)' }}>Respondent</span>
                <span>respondent@gap2action.com / password123</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer tagline */}
        <p className="mt-8 text-center text-xs" style={{ color: 'rgba(255,255,255,.22)' }}>
          © 2026 Gap2Action · All rights reserved
        </p>
      </div>
    </div>
  );
}

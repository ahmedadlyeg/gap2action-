import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function Login() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPw, setShowPw]         = useState(false);
  const [error, setError]           = useState('');
  const [toast, setToast]           = useState('');

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

  const BRAND = 'linear-gradient(120deg, #13b4cf 0%, #2e7de0 38%, #7b2ff7 70%, #e0218a 100%)';

  return (
    <div className="min-h-screen flex" style={{ background: '#f4f6f8' }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-2xl">
          <CheckCircle2 size={16} className="shrink-0" />
          {toast}
        </div>
      )}

      {/* ── Left hero panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between"
        style={{
          width: 440,
          minHeight: '100vh',
          flexShrink: 0,
          background: BRAND,
          padding: '48px 44px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle noise overlay */}
        <div style={{
          position: 'absolute', inset: 0, opacity: .06,
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
          backgroundSize: '180px',
        }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,255,255,.95)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, background: BRAND }} />
            </div>
            <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: '-.02em', color: '#fff' }}>
              Gap2Action
            </span>
          </div>
        </div>

        {/* Centre copy */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 36, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-.03em', color: '#fff', marginBottom: 16 }}>
            Assess.<br />Understand.<br />Advance.
          </div>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.72)', lineHeight: 1.65, maxWidth: 300 }}>
            Close the gap between where you are and where you need to be — with structured maturity assessments that drive real action.
          </p>
        </div>

        {/* Bottom feature pills */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { icon: '📊', text: 'Framework-based maturity assessments' },
            { icon: '📋', text: 'Actionable recommendations & task tracking' },
            { icon: '📈', text: 'Progress visibility across the organisation' },
          ].map(f => (
            <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,.14)', borderRadius: 12, padding: '10px 14px', backdropFilter: 'blur(6px)' }}>
              <span style={{ fontSize: 18 }}>{f.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.9)' }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Mobile-only logo */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, background: '#fff' }} />
              </div>
              <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: '-.02em', color: '#161c25' }}>Gap2Action</span>
            </div>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: '-.025em', color: '#161c25', marginBottom: 6 }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 14, color: '#6b7888' }}>Sign in to continue to your workspace</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm"
              style={{ background: '#fff1f1', border: '1px solid #fca5a5', color: '#b91c1c' }}>
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b7888', marginBottom: 6 }}>
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
                style={{
                  width: '100%', height: 44, borderRadius: 12, padding: '0 14px',
                  fontSize: 14, color: '#161c25', background: '#fff',
                  border: '1.5px solid #dbe1e8', outline: 'none',
                  boxSizing: 'border-box', transition: 'border-color .15s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#13b4cf'}
                onBlur={e => e.currentTarget.style.borderColor = '#dbe1e8'}
              />
            </div>

            {/* Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label htmlFor="password" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b7888' }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  style={{ fontSize: 12, fontWeight: 600, color: '#0c93ac', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Forgot password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%', height: 44, borderRadius: 12, padding: '0 42px 0 14px',
                    fontSize: 14, color: '#161c25', background: '#fff',
                    border: '1.5px solid #dbe1e8', outline: 'none',
                    boxSizing: 'border-box', transition: 'border-color .15s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#13b4cf'}
                  onBlur={e => e.currentTarget.style.borderColor = '#dbe1e8'}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9aa5b1', display: 'flex' }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded cursor-pointer accent-[#0c93ac]"
              />
              <label htmlFor="remember" style={{ fontSize: 13, color: '#6b7888', cursor: 'pointer', userSelect: 'none' }}>
                Keep me signed in
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%', height: 46, borderRadius: 12, border: 'none',
                background: BRAND,
                boxShadow: '0 4px 18px rgba(123,47,247,.35)',
                color: '#fff', fontWeight: 700, fontSize: 15,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? .7 : 1,
                transition: 'box-shadow .2s, opacity .2s',
              }}
              onMouseEnter={e => { if (!isLoading) (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(123,47,247,.5)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 18px rgba(123,47,247,.35)'; }}
            >
              {isLoading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                <>Sign in <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div style={{ marginTop: 28, background: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid #dbe1e8' }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#9aa5b1', marginBottom: 10 }}>Demo credentials</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#6b7888' }}>
              {[
                { role: 'Admin',      bg: 'rgba(19,180,207,.12)', fg: '#0c7689',  email: 'admin@gap2action.com' },
                { role: 'Assessor',   bg: 'rgba(77,184,138,.14)', fg: '#0f8a4b',  email: 'assessor@gap2action.com' },
                { role: 'Respondent', bg: 'rgba(232,148,26,.14)', fg: '#b46a10',  email: 'respondent@gap2action.com' },
              ].map(c => (
                <div key={c.role} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ padding: '2px 7px', borderRadius: 6, fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', background: c.bg, color: c.fg, flexShrink: 0 }}>{c.role}</span>
                  <span>{c.email} / password123</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: '#c3cdd7' }}>
            © 2026 Gap2Action · All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}

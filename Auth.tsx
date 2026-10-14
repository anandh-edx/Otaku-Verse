import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { errMsg, USERNAME_RE } from '../lib/util'
import { Notice } from '../components/ui'

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-full place-items-center px-4 py-10">
      <div className="card w-full max-w-md p-6">
        <Link to="/" className="mb-4 flex items-center justify-center gap-2 font-display text-xl font-extrabold text-white"><Sparkles className="h-5 w-5 text-violet-400" />Otaku Verse</Link>
        <h1 className="mb-4 text-center font-display text-xl font-bold">{title}</h1>
        {children}
      </div>
    </div>
  )
}
const safePath = (p: unknown) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : '/home')

function GoogleButton() {
  const [err, setErr] = useState('')
  return (
    <>
      <button type="button" className="btn-ghost w-full" onClick={async () => {
        setErr('')
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/home` } })
        if (error) setErr(errMsg(error))
      }}>
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6C12.3 13.5 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.4 28.8A14.5 14.5 0 0 1 9.5 24c0-1.7.3-3.3.9-4.8l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6z"/><path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.7 2.3-7.7 2.3-6.4 0-11.7-4-13.6-9.8l-7.8 6C6.5 42.6 14.6 48 24 48z"/></svg>
        Continue with Google
      </button>
      {err && <div className="mt-2"><Notice kind="error">{err} (Google provider must be enabled in Supabase.)</Notice></div>}
    </>
  )
}
const Or = () => <div className="my-4 flex items-center gap-3 text-xs text-slate-500"><span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" /></div>

export function SignIn() {
  const nav = useNavigate(); const loc = useLocation()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setErr(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : errMsg(error))
    else nav(safePath((loc.state as { from?: string } | null)?.from), { replace: true })
  }
  return (
    <Shell title="Welcome back">
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label" htmlFor="e">Email</label><input id="e" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="label" htmlFor="p">Password</label><input id="p" type="password" required autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {err && <Notice kind="error">{err}</Notice>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <div className="mt-2 text-right text-xs"><Link to="/forgot-password" className="text-cyan-300">Forgot password?</Link></div>
      <Or /><GoogleButton />
      <p className="mt-4 text-center text-sm text-slate-400">New here? <Link to="/signup" className="text-cyan-300">Create an account</Link></p>
    </Shell>
  )
}

export function SignUp() {
  const nav = useNavigate()
  const [f, setF] = useState({ email: '', password: '', confirm: '', username: '', display: '' })
  const [terms, setTerms] = useState(false)
  const [avail, setAvail] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [sent, setSent] = useState(false)
  const seq = useRef(0)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }))

  useEffect(() => {
    const u = f.username.trim()
    if (!u) { setAvail('idle'); return }
    if (!USERNAME_RE.test(u)) { setAvail('invalid'); return }
    setAvail('checking')
    const id = ++seq.current
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('check_username_available', { name: u })
      if (id !== seq.current) return
      setAvail(error ? 'idle' : data ? 'ok' : 'taken')
    }, 350)
    return () => clearTimeout(t)
  }, [f.username])

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('')
    if (!USERNAME_RE.test(f.username.trim())) return setErr('Username must be 3–20 characters: letters, numbers, underscore.')
    if (avail === 'taken') return setErr('That username is taken or reserved.')
    if (f.password.length < 8) return setErr('Password must be at least 8 characters.')
    if (f.password !== f.confirm) return setErr('Passwords do not match.')
    if (!terms) return setErr('Please accept the terms and community guidelines.')
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.password,
      options: { emailRedirectTo: `${location.origin}/onboarding`, data: { username: f.username.trim(), display_name: f.display.trim() || undefined, terms_accepted: true } },
    })
    setBusy(false)
    if (error) return setErr(errMsg(error))
    if (data.session) nav('/onboarding', { replace: true })
    else setSent(true) // email confirmation is enabled in Supabase
  }
  if (sent) return <Shell title="Check your email"><Notice kind="success">We sent a confirmation link to {f.email}. Open it to finish creating your account.</Notice></Shell>
  const hint = { idle: '', checking: 'Checking…', ok: 'Available ✓', taken: 'Taken or reserved', invalid: '3–20 letters, numbers or _' }[avail]
  return (
    <Shell title="Join Otaku Verse">
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label" htmlFor="u">Username</label><input id="u" required autoComplete="username" className="input" value={f.username} onChange={set('username')} maxLength={20} />
          <p className={`mt-1 text-xs ${avail === 'ok' ? 'text-emerald-400' : avail === 'taken' || avail === 'invalid' ? 'text-red-300' : 'text-slate-500'}`} aria-live="polite">{hint}</p></div>
        <div><label className="label" htmlFor="dn">Display name (optional)</label><input id="dn" className="input" maxLength={40} value={f.display} onChange={set('display')} /></div>
        <div><label className="label" htmlFor="em">Email</label><input id="em" type="email" required autoComplete="email" className="input" value={f.email} onChange={set('email')} /></div>
        <div><label className="label" htmlFor="pw">Password</label><input id="pw" type="password" required minLength={8} autoComplete="new-password" className="input" value={f.password} onChange={set('password')} /></div>
        <div><label className="label" htmlFor="pc">Confirm password</label><input id="pc" type="password" required autoComplete="new-password" className="input" value={f.confirm} onChange={set('confirm')} /></div>
        <label className="flex items-start gap-2 text-xs text-slate-400"><input type="checkbox" className="mt-0.5 accent-violet-500" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>I accept the terms and the <Link to="/guidelines" target="_blank" className="text-cyan-300">community guidelines</Link>.</span></label>
        {err && <Notice kind="error">{err}</Notice>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <Or /><GoogleButton />
      <p className="mt-4 text-center text-sm text-slate-400">Have an account? <Link to="/signin" className="text-cyan-300">Sign in</Link></p>
    </Shell>
  )
}

export function Forgot() {
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ k: 'error' | 'success'; t: string } | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/reset-password` })
    setBusy(false)
    setMsg(error ? { k: 'error', t: errMsg(error) } : { k: 'success', t: 'If an account exists for that email, a reset link is on its way.' })
  }
  return (
    <Shell title="Reset your password">
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label" htmlFor="fe">Email</label><input id="fe" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        {msg && <Notice kind={msg.k}>{msg.t}</Notice>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
      </form>
      <p className="mt-4 text-center text-sm"><Link to="/signin" className="text-cyan-300">Back to sign in</Link></p>
    </Shell>
  )
}

export function Reset() {
  const nav = useNavigate()
  const [ready, setReady] = useState(false); const [pw, setPw] = useState(''); const [pc, setPc] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((ev, s) => { if (ev === 'PASSWORD_RECOVERY' || s) setReady(true) })
    return () => sub.subscription.unsubscribe()
  }, [])
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('')
    if (pw.length < 8) return setErr('Password must be at least 8 characters.')
    if (pw !== pc) return setErr('Passwords do not match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setErr(errMsg(error))
    setDone(true); setTimeout(() => nav('/home'), 1200)
  }
  return (
    <Shell title="Choose a new password">
      {!ready ? <Notice kind="info">Open this page from the link in your reset email. If it expired, <Link to="/forgot-password" className="underline">request a new one</Link>.</Notice> : done ? <Notice kind="success">Password updated. Redirecting…</Notice> : (
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label" htmlFor="np">New password</label><input id="np" type="password" required minLength={8} autoComplete="new-password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <div><label className="label" htmlFor="nc">Confirm</label><input id="nc" type="password" required autoComplete="new-password" className="input" value={pc} onChange={(e) => setPc(e.target.value)} /></div>
          {err && <Notice kind="error">{err}</Notice>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
        </form>
      )}
    </Shell>
  )
}
